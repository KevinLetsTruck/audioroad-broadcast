import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

export default function ScreeningRoom() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeEpisode, setActiveEpisode] = useState<any>(null);
  const [incomingCalls, setIncomingCalls] = useState<any[]>([]);

  useEffect(() => {
    console.log('🚀 ScreeningRoom mounted - initializing...');
    
    // Fetch active episode
    fetch('/api/episodes?status=live')
      .then(res => res.json())
      .then(episodes => {
        console.log('📺 Episodes response:', episodes);
        if (episodes.length > 0) {
          setActiveEpisode(episodes[0]);
          console.log('✅ Active episode loaded:', episodes[0].title, 'ID:', episodes[0].id);
        } else {
          console.log('⚠️ No live episodes found');
        }
      })
      .catch(err => console.error('❌ Error fetching episodes:', err));

    // Setup socket connection
    console.log('🔌 Creating Socket.IO connection...');
    const newSocket = io();
    setSocket(newSocket);
    
    newSocket.on('connect', () => {
      console.log('✅ Socket connected, ID:', newSocket.id);
    });
    
    newSocket.on('disconnect', () => {
      console.log('📴 Socket disconnected');
    });

    return () => {
      console.log('🧹 ScreeningRoom unmounting, closing socket');
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (!socket || !activeEpisode) return;

    console.log('🔌 Joining episode room:', activeEpisode.id);
    socket.emit('join:episode', activeEpisode.id);

    // Fetch existing queued calls
    fetchQueuedCalls();

    socket.on('call:incoming', (data) => {
      console.log('📞 Incoming call received:', data);
      fetchQueuedCalls(); // Refresh the list
    });

    socket.on('call:completed', () => {
      fetchQueuedCalls(); // Refresh the list
    });

    return () => {
      socket.off('call:incoming');
      socket.off('call:completed');
    };
  }, [socket, activeEpisode]);

  const fetchQueuedCalls = async () => {
    if (!activeEpisode) return;
    
    try {
      const response = await fetch(`/api/calls?episodeId=${activeEpisode.id}&status=queued`);
      const data = await response.json();
      console.log('📋 Queued calls:', data.length);
      setIncomingCalls(data);
    } catch (error) {
      console.error('Error fetching queued calls:', error);
    }
  };

  const handleApprove = async (call: any) => {
    try {
      await fetch(`/api/calls/${call.id}/approve`, {
        method: 'PATCH'
      });
      fetchQueuedCalls();
    } catch (error) {
      console.error('Error approving call:', error);
    }
  };

  const handleReject = async (call: any) => {
    try {
      await fetch(`/api/calls/${call.id}/reject`, {
        method: 'PATCH'
      });
      fetchQueuedCalls();
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  };

  return (
    <div className="min-h-[calc(100vh-73px)] p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">Call Screening Room</h1>
            {activeEpisode && (
              <p className="text-gray-400">
                {activeEpisode.title} • Live Now • Episode ID: {activeEpisode.id}
              </p>
            )}
            {!activeEpisode && (
              <p className="text-yellow-400">No live episode - start a show to receive calls</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                console.log('🔄 Manual refresh clicked');
                fetchQueuedCalls();
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
            >
              🔄 Refresh Queue
            </button>
            {incomingCalls.length > 0 && (
              <button
                onClick={async () => {
                  if (confirm(`Clear all ${incomingCalls.length} test calls from queue?`)) {
                    for (const call of incomingCalls) {
                      await handleReject(call);
                    }
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold"
              >
                🗑️ Clear All ({incomingCalls.length})
              </button>
            )}
            <div className="text-right">
              <p className="text-sm text-gray-400">Calls in Queue</p>
              <p className="text-4xl font-bold text-green-400">{incomingCalls.length}</p>
            </div>
          </div>
        </div>

        {activeEpisode ? (
          <div className="space-y-6">
            {/* Demo Mode for Testing */}
            <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">🎭 Demo Mode</h3>
              <button
                onClick={() => {
                  // Simulate a call for testing
                  const mockCall = {
                    id: `mock-${Date.now()}`,
                    caller: {
                      name: 'Test Caller',
                      phoneNumber: '+15555551234',
                      location: 'Test City, ST'
                    },
                    topic: 'Test topic',
                    status: 'queued',
                    incomingAt: new Date()
                  };
                  setIncomingCalls([...incomingCalls, mockCall]);
                }}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold transition-colors"
              >
                📞 Simulate Incoming Call
              </button>
              <p className="text-sm text-gray-400 mt-2">
                Callers will appear here when they click "Call Now"
              </p>
            </div>

            {/* Queued Calls */}
            <div>
              <h3 className="text-xl font-semibold mb-4">Queued for Host</h3>
              <div className="text-right mb-4">
                <span className="text-3xl font-bold text-green-400">{incomingCalls.filter(c => c.status !== 'rejected').length}</span>
              </div>

              {incomingCalls.length === 0 ? (
                <div className="text-center py-16 bg-gray-800 rounded-lg">
                  <div className="text-6xl mb-6">☎️</div>
                  <h3 className="text-2xl font-bold mb-4">Waiting for incoming calls...</h3>
                  <p className="text-gray-400">
                    Callers will appear here when they click "Call Now"
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {incomingCalls.map((call) => (
                    <div
                      key={call.id}
                      className="bg-gray-800 border border-gray-700 rounded-lg p-6"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="text-xl font-bold">{call.caller?.name || 'Unknown Caller'}</h4>
                          <p className="text-sm text-gray-400">
                            {call.caller?.location || 'Location not provided'}
                          </p>
                          {call.caller?.phoneNumber && (
                            <p className="text-sm text-gray-500">{call.caller.phoneNumber}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-400">
                            {new Date(call.incomingAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>

                      {call.topic && (
                        <div className="mt-4 bg-gray-900 p-4 rounded">
                          <p className="text-sm font-semibold text-gray-300 mb-1">Topic:</p>
                          <p className="text-gray-300">{call.topic}</p>
                        </div>
                      )}

                      <div className="mt-4 flex gap-3">
                        <button
                          onClick={() => handleApprove(call)}
                          className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold transition-colors"
                        >
                          ✓ Approve & Queue for Host
                        </button>
                        <button
                          onClick={() => handleReject(call)}
                          className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition-colors"
                        >
                          ✗ Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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

