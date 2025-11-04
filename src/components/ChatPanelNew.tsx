import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

interface ChatPanelProps {
  episodeId: string;
  userRole: string;
}

interface ChatMessage {
  id: string;
  senderName: string;
  message: string;
  createdAt: Date;
}

export default function ChatPanelNew({ episodeId, userRole }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    // Fetch messages
    fetch(`/api/chat?episodeId=${episodeId}`)
      .then(r => r.json())
      .then(data => setMessages(data.slice(-15))) // Only last 15
      .catch(err => console.error('Chat error:', err));

    // Socket for real-time
    const socket = io();
    socket.emit('join:episode', episodeId);
    socket.on('chat:message', (msg: ChatMessage) => {
      setMessages(prev => [...prev.slice(-14), msg]); // Keep only 15 max
    });

    return () => {
      socket.close();
    };
  }, [episodeId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        episodeId,
        senderId: userRole,
        senderName: userRole,
        senderRole: userRole,
        message: newMessage
      })
    });

    setNewMessage('');
  };

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      maxHeight: '100%',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '12px', 
        background: '#1f2937', 
        borderBottom: '1px solid #374151',
        flexShrink: 0
      }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Team Chat</h3>
      </div>

      {/* Messages - FIXED HEIGHT */}
      <div style={{ 
        flex: 1,
        overflowY: 'auto',
        padding: '12px',
        background: '#111827',
        maxHeight: 'calc(100% - 120px)' // Explicit max height
      }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{
            background: '#1f2937',
            padding: '8px',
            borderRadius: '4px',
            marginBottom: '8px',
            fontSize: '13px'
          }}>
            <div style={{ fontWeight: 600, marginBottom: '4px', color: '#60a5fa' }}>
              {msg.senderName}
            </div>
            <div style={{ color: '#d1d5db' }}>{msg.message}</div>
          </div>
        ))}
      </div>

      {/* Form - FIXED AT BOTTOM */}
      <form onSubmit={send} style={{ 
        padding: '12px', 
        background: '#1f2937', 
        borderTop: '1px solid #374151',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Message..."
            style={{
              flex: 1,
              padding: '8px',
              background: '#111827',
              border: '1px solid #374151',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '13px'
            }}
          />
          <button
            type="submit"
            style={{
              padding: '8px 16px',
              background: '#3b82f6',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

