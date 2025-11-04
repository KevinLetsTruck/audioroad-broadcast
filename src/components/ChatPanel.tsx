import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface ChatPanelProps {
  episodeId: string;
  userRole: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  message: string;
  messageType?: string;
  twilioSid?: string;
  recipientId?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  createdAt: Date;
}

export default function ChatPanel({ episodeId, userRole }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [, setSocket] = useState<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();

    const newSocket = io();
    setSocket(newSocket);
    newSocket.emit('join:episode', episodeId);

    newSocket.on('chat:message', (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
    });

    return () => {
      newSocket.close();
    };
  }, [episodeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/chat?episodeId=${episodeId}`);
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId,
          senderId: 'current-user',
          senderName: userRole === 'host' ? 'Host' : 'User',
          senderRole: userRole,
          message: newMessage
        })
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };


  const getRoleColor = (role: string) => {
    switch (role) {
      case 'host': return 'text-red-400';
      case 'co-host': return 'text-orange-400';
      case 'screener': return 'text-blue-400';
      case 'producer': return 'text-purple-400';
      case 'caller': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  // Show only last 20 messages to prevent performance issues
  const visibleMessages = messages.slice(-20);

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header - Fixed */}
      <div className="p-3 bg-gray-800 border-b border-gray-700">
        <h3 className="font-semibold text-sm">Team Chat</h3>
      </div>

      {/* Messages - Scrollable */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: 'calc(100% - 140px)' }}>
        {visibleMessages.map((msg) => (
          <div key={msg.id} className="bg-gray-800 p-3 rounded">
            <div className="flex items-baseline gap-2 mb-1">
              <span className={`font-semibold text-sm ${getRoleColor(msg.senderRole)}`}>
                {msg.senderName}
              </span>
              {msg.messageType === 'sms' && (
                <span className="inline-flex items-center gap-1 text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                  📱 SMS
                </span>
              )}
              <span className="text-xs text-gray-500">
                {new Date(msg.createdAt).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-sm text-gray-300">{msg.message}</p>
            {msg.attachmentUrl && (
              msg.attachmentUrl.startsWith('file://') ? (
                <div className="inline-block mt-2 px-3 py-1.5 bg-gray-700 rounded text-xs">
                  📎 {msg.attachmentName || 'File'} <span className="text-yellow-400">(Preview only - S3 not configured)</span>
                </div>
              ) : (
                <a
                  href={msg.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={msg.attachmentName}
                  className="inline-block mt-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 rounded text-xs font-semibold cursor-pointer"
                >
                  📎 Download {msg.attachmentName || 'File'}
                </a>
              )
            )}
            {msg.messageType === 'sms' && msg.senderId !== 'host' && (
              <button
                onClick={() => setReplyingTo(msg)}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Reply via SMS
              </button>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form - Fixed at bottom */}
      <form onSubmit={sendMessage} className="p-3 border-t border-gray-700 bg-gray-800">
        {/* Simplified - removed SMS reply feature for cleaner UI */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Message team..."
            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-primary-500 text-sm"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded font-semibold text-sm"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

