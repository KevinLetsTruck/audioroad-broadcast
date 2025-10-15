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
  createdAt: Date;
}

export default function ChatPanel({ episodeId, userRole }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
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
          senderId: 'current-user', // TODO: Get from auth
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
      case 'caller': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 bg-gray-800 border-b border-gray-700">
        <h3 className="font-semibold">Team Chat</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className="bg-gray-800 p-3 rounded">
            <div className="flex items-baseline gap-2 mb-1">
              <span className={`font-semibold text-sm ${getRoleColor(msg.senderRole)}`}>
                {msg.senderName}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(msg.createdAt).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-sm text-gray-300">{msg.message}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-primary-500 text-sm"
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

