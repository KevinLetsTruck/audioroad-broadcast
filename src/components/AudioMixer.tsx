import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface AudioMixerProps {
  episodeId: string;
}

interface AudioTrack {
  id: string;
  label: string;
  volume: number;
  muted: boolean;
  type: 'host' | 'caller' | 'cohost';
}

export default function AudioMixer({ episodeId }: AudioMixerProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [tracks, setTracks] = useState<AudioTrack[]>([
    { id: 'host', label: 'Host Mic', volume: 80, muted: false, type: 'host' },
    { id: 'caller', label: 'Caller', volume: 75, muted: true, type: 'caller' },
    { id: 'cohost', label: 'Co-host', volume: 75, muted: true, type: 'cohost' },
  ]);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);
    newSocket.emit('join:episode', episodeId);

    return () => {
      newSocket.close();
    };
  }, [episodeId]);

  const setVolume = (trackId: string, volume: number) => {
    setTracks(prev =>
      prev.map(track =>
        track.id === trackId ? { ...track, volume } : track
      )
    );

    socket?.emit('audio:volume', {
      episodeId,
      userId: trackId,
      volume
    });
  };

  const toggleMute = (trackId: string) => {
    setTracks(prev =>
      prev.map(track =>
        track.id === trackId ? { ...track, muted: !track.muted } : track
      )
    );

    const track = tracks.find(t => t.id === trackId);
    socket?.emit('audio:mute', {
      episodeId,
      userId: trackId,
      muted: !track?.muted
    });
  };

  return (
    <div className="space-y-4">
      {tracks.map(track => (
        <div
          key={track.id}
          className="bg-gray-800 p-4 rounded-lg border border-gray-700"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleMute(track.id)}
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-colors ${
                  track.muted
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {track.muted ? '🔇' : '🔊'}
              </button>
              <div>
                <h4 className="font-semibold">{track.label}</h4>
                <p className="text-xs text-gray-400">
                  {track.muted ? 'Muted' : `Volume: ${track.volume}%`}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-2xl font-bold">
                {track.muted ? '--' : track.volume}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 w-8">0</span>
            <input
              type="range"
              min="0"
              max="100"
              value={track.volume}
              onChange={(e) => setVolume(track.id, parseInt(e.target.value))}
              disabled={track.muted}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
            <span className="text-sm text-gray-400 w-8">100</span>
          </div>

          {/* Visual level meter (simplified) */}
          <div className="mt-3 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                track.muted ? 'bg-gray-600' : 'bg-green-500'
              }`}
              style={{ width: track.muted ? '0%' : `${track.volume}%` }}
            />
          </div>
        </div>
      ))}

      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: #0ea5e9;
          cursor: pointer;
          border-radius: 50%;
        }
        
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #0ea5e9;
          cursor: pointer;
          border-radius: 50%;
          border: none;
        }
      `}</style>
    </div>
  );
}

