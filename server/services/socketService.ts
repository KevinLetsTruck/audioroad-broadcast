import { Server as SocketIOServer, Socket } from 'socket.io';

interface CallEvent {
  episodeId: string;
  callId: string;
  callerId: string;
  status: string;
  data?: any;
}

interface ChatMessageEvent {
  episodeId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId?: string;
  message: string;
  timestamp: Date;
}

interface AudioLevelEvent {
  episodeId: string;
  userId: string;
  level: number;
}

/**
 * Initialize Socket.IO event handlers
 */
export function initializeSocketHandlers(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    console.log('🔌 Client connected:', socket.id);

    // Join episode room
    socket.on('join:episode', (episodeId: string) => {
      socket.join(`episode:${episodeId}`);
      console.log(`✅ [SOCKET] Client ${socket.id} joined episode:${episodeId}`);
      console.log(`📊 [SOCKET] Rooms for this socket:`, Array.from(socket.rooms));
      
      // Confirm join to the client
      socket.emit('joined:episode', { episodeId, socketId: socket.id });
      
      // Notify others in the room
      socket.to(`episode:${episodeId}`).emit('user:joined', {
        socketId: socket.id,
        timestamp: new Date()
      });
    });

    // Leave episode room
    socket.on('leave:episode', (episodeId: string) => {
      socket.leave(`episode:${episodeId}`);
      console.log(`👤 Socket ${socket.id} left episode:${episodeId}`);
      
      socket.to(`episode:${episodeId}`).emit('user:left', {
        socketId: socket.id,
        timestamp: new Date()
      });
    });

    // NOTE: Call queue events are emitted by API endpoints only
    // Clients should NOT send these events - they only listen for them
    // This prevents race conditions and ensures single source of truth

    // Chat events
    socket.on('chat:message', (data: ChatMessageEvent) => {
      console.log('💬 Chat message:', data.message.substring(0, 50));
      
      if (data.recipientId) {
        // Direct message - send only to recipient
        io.to(`episode:${data.episodeId}`).emit('chat:message', data);
      } else {
        // Broadcast to everyone in episode
        io.to(`episode:${data.episodeId}`).emit('chat:message', data);
      }
    });

    socket.on('chat:typing', (data: { episodeId: string; userId: string; userName: string }) => {
      socket.to(`episode:${data.episodeId}`).emit('chat:typing', data);
    });

    // Audio level indicators (for VU meters)
    socket.on('audio:level', (data: AudioLevelEvent) => {
      socket.to(`episode:${data.episodeId}`).emit('audio:level', data);
    });

    // Audio control events
    socket.on('audio:mute', (data: { episodeId: string; userId: string; muted: boolean }) => {
      console.log(`🔇 Audio ${data.muted ? 'muted' : 'unmuted'}:`, data.userId);
      io.to(`episode:${data.episodeId}`).emit('audio:mute', data);
    });

    socket.on('audio:volume', (data: { episodeId: string; userId: string; volume: number }) => {
      socket.to(`episode:${data.episodeId}`).emit('audio:volume', data);
    });

    // Soundboard events
    socket.on('soundboard:play', (data: { episodeId: string; assetId: string; assetName: string }) => {
      console.log('🔊 Soundboard play:', data.assetName);
      io.to(`episode:${data.episodeId}`).emit('soundboard:play', data);
    });

    // Episode status events
    socket.on('episode:start', (data: { episodeId: string }) => {
      console.log('🎬 Episode started:', data.episodeId);
      io.to(`episode:${data.episodeId}`).emit('episode:start', data);
    });

    socket.on('episode:end', (data: { episodeId: string }) => {
      console.log('🎬 Episode ended:', data.episodeId);
      io.to(`episode:${data.episodeId}`).emit('episode:end', data);
    });

    // Recording events
    socket.on('recording:start', (data: { episodeId: string }) => {
      console.log('🔴 Recording started:', data.episodeId);
      io.to(`episode:${data.episodeId}`).emit('recording:start', data);
    });

    socket.on('recording:stop', (data: { episodeId: string }) => {
      console.log('⏹️  Recording stopped:', data.episodeId);
      io.to(`episode:${data.episodeId}`).emit('recording:stop', data);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log('🔌 Client disconnected:', socket.id);
    });

    // Error handling
    socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });
  });

  return io;
}

/**
 * Emit event to specific episode room
 */
export function emitToEpisode(io: SocketIOServer, episodeId: string, event: string, data: any) {
  io.to(`episode:${episodeId}`).emit(event, data);
}

/**
 * Emit event to specific user
 */
export function emitToUser(io: SocketIOServer, socketId: string, event: string, data: any) {
  io.to(socketId).emit(event, data);
}

