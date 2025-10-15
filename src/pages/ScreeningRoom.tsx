import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import LiveCallScreener from '../components/LiveCallScreener';

export default function ScreeningRoom() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeEpisode, setActiveEpisode] = useState<any>(null);

  useEffect(() => {
    // Fetch active episode
    fetch('/api/episodes?status=live')
      .then(res => res.json())
      .then(episodes => {
        if (episodes.length > 0) {
          setActiveEpisode(episodes[0]);
        }
      });

    // Setup socket connection
    const newSocket = io();
    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (!socket || !activeEpisode) return;

    socket.emit('join:episode', activeEpisode.id);

    socket.on('call:incoming', () => {
      // Call incoming
    });

    socket.on('call:completed', () => {
      // Call completed
    });

    return () => {
      socket.off('call:incoming');
      socket.off('call:completed');
    };
  }, [socket, activeEpisode]);

  const handleCallQueued = (callData: any) => {
    console.log('Call queued:', callData);
  };

  return (
    <div className="min-h-[calc(100vh-73px)] p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Call Screening Room</h1>
          {activeEpisode && (
            <p className="text-gray-400">
              {activeEpisode.show?.name} • Episode {activeEpisode.episodeNumber}
            </p>
          )}
          {!activeEpisode && (
            <p className="text-yellow-400">No live episode - start a show to receive calls</p>
          )}
        </div>

        {activeEpisode ? (
          <LiveCallScreener 
            episodeId={activeEpisode.id}
            onCallQueued={handleCallQueued}
          />
        ) : (
          <div className="text-center py-16 bg-gray-800 rounded-lg">
            <p className="text-gray-400 text-lg">No active episode</p>
            <p className="text-gray-500 text-sm mt-2">Start a show to begin screening calls</p>
          </div>
        )}
      </div>
    </div>
  );
}

