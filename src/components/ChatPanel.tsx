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
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [smsReply, setSmsReply] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMessages();

    const newSocket = io();
    setSocket(newSocket);
    
    // Wait for connection before joining room
    newSocket.on('connect', () => {
      console.log('💬 [CHAT] Socket connected, joining episode:', episodeId);
    newSocket.emit('join:episode', episodeId);
    });

    // Listen for join confirmation
    newSocket.on('joined:episode', (data) => {
      console.log('✅ [CHAT] Successfully joined episode room:', data.episodeId);
    });

    newSocket.on('chat:message', (message: ChatMessage) => {
      console.log('💬 [CHAT] Received message:', message);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('📎 Uploading file:', file.name, file.size, 'bytes');
    setUploading(true);
    
    try {
      // First, ensure a system caller exists for this episode
      const callerResponse = await fetch('/api/callers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: `episode-${episodeId}`,
          name: 'Team Chat Files'
        })
      });
      
      const caller = await callerResponse.json();
      console.log('📁 Using caller:', caller.id);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', 'other');
      formData.append('callerId', caller.id);

      console.log('📤 Sending to /api/analysis/document...');
      const response = await fetch('/api/analysis/document', {
        method: 'POST',
        body: formData
      });

      console.log('📥 Upload response status:', response.status);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(error.error || `Upload failed with status ${response.status}`);
      }

      const doc = await response.json();
      console.log('✅ File uploaded:', doc);
      
      // Send chat message with file attachment
      console.log('💬 Sending chat message with attachment...');
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId,
          senderId: 'current-user',
          senderName: userRole === 'host' ? 'Host' : 'User',
          senderRole: userRole,
          message: `📎 Shared: ${file.name}`,
          attachmentUrl: doc.fileUrl,
          attachmentName: file.name
        })
      });

      if (!chatResponse.ok) {
        throw new Error('Failed to send chat message');
      }

      const chatMsg = await chatResponse.json();
      console.log('✅ File shared in chat:', chatMsg);
      
      // Manually add to messages for immediate display
      setMessages(prev => [...prev, { ...chatMsg, attachmentName: file.name }]);
      
    } catch (error) {
      console.error('❌ Error uploading file:', error);
      alert(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      console.log('💬 [CHAT] Sending message to episode:', episodeId);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId,
          senderId: 'current-user',
          senderName: userRole === 'host' ? 'Host' : 'Screener',
          senderRole: userRole,
          message: newMessage
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      console.log('✅ [CHAT] Message sent successfully');
      setNewMessage('');
    } catch (error) {
      console.error('❌ [CHAT] Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const handleSendSmsReply = async () => {
    if (!smsReply.trim() || !replyingTo) return;
    
    try {
      await fetch('/api/chat/sms-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: replyingTo.senderId,
          message: smsReply,
          episodeId
        })
      });
      
      setSmsReply('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Failed to send SMS reply:', error);
      alert('Failed to send SMS reply');
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

      <form onSubmit={sendMessage} className="p-4 border-t border-gray-700">
        {replyingTo && (
          <div className="mb-3 p-3 bg-gray-800/50 border border-gray-700 rounded">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-400">
                📱 Replying to: <span className="text-blue-400">{replyingTo.senderName}</span>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={smsReply}
                onChange={(e) => setSmsReply(e.target.value)}
                placeholder="Type SMS reply..."
                className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendSmsReply();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleSendSmsReply}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
              >
                Send SMS
              </button>
            </div>
          </div>
        )}
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-primary-500 text-sm"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 rounded text-sm"
            title="Upload file"
          >
            {uploading ? '⏳' : '📎'}
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded font-semibold text-sm"
          >
            Send
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
          className="hidden"
        />
      </form>
    </div>
  );
}

