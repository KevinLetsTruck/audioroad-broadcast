import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface CallQueueProps {
  episodeId: string;
  onSelectCaller?: (caller: any) => void;
}

export default function CallQueue({ episodeId, onSelectCaller }: CallQueueProps) {
  const [calls, setCalls] = useState<any[]>([]);
  const [, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    fetchCalls();

    const newSocket = io();
    setSocket(newSocket);
    newSocket.emit('join:episode', episodeId);

    newSocket.on('call:approved', (call) => {
      setCalls(prev => [...prev, call]);
    });

    newSocket.on('call:onair', (call) => {
      setCalls(prev => prev.filter(c => c.id !== call.id));
    });

    newSocket.on('call:completed', (call) => {
      setCalls(prev => prev.filter(c => c.id !== call.id));
    });

    return () => {
      newSocket.close();
    };
  }, [episodeId]);

  const fetchCalls = async () => {
    try {
      const response = await fetch(`/api/calls?episodeId=${episodeId}&status=approved`);
      const data = await response.json();
      setCalls(data);
    } catch (error) {
      console.error('Error fetching calls:', error);
    }
  };

  const takeCall = async (call: any) => {
    try {
      await fetch(`/api/calls/${call.id}/onair`, {
        method: 'PATCH'
      });
      if (onSelectCaller) {
        onSelectCaller(call.caller);
      }
    } catch (error) {
      console.error('Error taking call:', error);
    }
  };

  return (
    <div className="p-4">
      <h3 className="font-semibold mb-4 text-lg">
        Call Queue ({calls.length})
      </h3>

      {calls.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No calls in queue</p>
      ) : (
        <div className="space-y-3">
          {calls.map(call => (
            <div
              key={call.id}
              className="bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-primary-500 transition-colors cursor-pointer"
              onClick={() => onSelectCaller && onSelectCaller(call.caller)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-semibold">{call.caller.name || 'Unknown'}</h4>
                  <p className="text-sm text-gray-400">{call.caller.phoneNumber}</p>
                </div>
                {call.priority === 'high' && (
                  <span className="px-2 py-1 bg-orange-600 rounded text-xs">HIGH</span>
                )}
                {call.priority === 'urgent' && (
                  <span className="px-2 py-1 bg-red-600 rounded text-xs animate-pulse">URGENT</span>
                )}
              </div>

              {call.topic && (
                <p className="text-sm text-gray-300 mb-3 line-clamp-2">{call.topic}</p>
              )}

              {call.screenerNotes && (
                <p className="text-xs text-gray-500 mb-3">Note: {call.screenerNotes}</p>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  takeCall(call);
                }}
                className="w-full py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-semibold transition-colors"
              >
                Take Call On-Air
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

