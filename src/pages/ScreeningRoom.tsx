import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useTwilioCall } from '../hooks/useTwilioCall';

export default function ScreeningRoom() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeEpisode, setActiveEpisode] = useState<any>(null);
  const [incomingCalls, setIncomingCalls] = useState<any[]>([]);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [screenerNotes, setScreenerNotes] = useState({
    name: '',
    location: '',
    topic: '',
    truckerType: 'OTR',
    priority: 'normal',
    notes: ''
  });

  // Stable identity for screener (prevents device loop)
  const [screenerIdentity] = useState(`screener-${Date.now()}`);

  // Twilio Device for screener
  const {
    isReady: screenerReady,
    isConnected: screenerConnected,
    isMuted,
    formattedDuration,
    makeCall: connectToCall,
    hangUp: endCall,
    toggleMute
  } = useTwilioCall({
    identity: screenerIdentity,
    onCallConnected: () => {
      console.log('✅ Screener audio connected to caller!');
    },
    onCallDisconnected: () => {
      console.log('📴 Screener audio disconnected');
      
      // Check if this was due to caller hanging up
      // If activeCall exists but no longer in queue, caller hung up
      if (activeCall) {
        setTimeout(() => {
          // Check if call still exists
          fetch(`/api/calls/${activeCall.id}`)
            .then(res => res.json())
            .then(call => {
              if (call.status === 'completed' || call.endedAt) {
                console.log('🔴 Caller hung up - closing screening form');
                alert('Caller has disconnected');
                setActiveCall(null);
                setScreenerNotes({
                  name: '',
                  location: '',
                  topic: '',
                  truckerType: 'OTR',
                  priority: 'normal',
                  notes: ''
                });
                fetchQueuedCalls();
              }
            })
            .catch(err => console.error('Error checking call status:', err));
        }, 1000);
      }
    },
    onError: (error) => {
      console.error('❌ Screener audio error:', error);
    }
  });

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

    socket.on('call:approved', (data) => {
      console.log('✅ Call approved:', data);
      // Remove from queue if it was picked up by this screener
      if (activeCall && activeCall.id === data.id) {
        setActiveCall(null);
      }
      fetchQueuedCalls();
    });

    socket.on('call:rejected', (data) => {
      console.log('❌ Call rejected:', data);
      // Remove from queue
      if (activeCall && activeCall.id === data.id) {
        setActiveCall(null);
      }
      fetchQueuedCalls();
    });

    socket.on('call:completed', (data) => {
      console.log('📴 Call completed:', data);
      
      // If this is the call being screened, close the form
      if (activeCall && data.callId === activeCall.id) {
        console.log('🔴 Active call completed - closing form');
        alert('Caller has hung up');
        setActiveCall(null);
        setScreenerNotes({
          name: '',
          location: '',
          topic: '',
          truckerType: 'OTR',
          priority: 'normal',
          notes: ''
        });
        if (screenerConnected) {
          endCall();
        }
      }
      
      fetchQueuedCalls(); // Refresh the list
    });

    socket.on('call:hungup', (data) => {
      console.log('📴 Caller hung up event:', data);
      
      // Close form if this is active call
      if (activeCall && data.callId === activeCall.id) {
        setActiveCall(null);
        setScreenerNotes({
          name: '',
          location: '',
          topic: '',
          truckerType: 'OTR',
          priority: 'normal',
          notes: ''
        });
        if (screenerConnected) {
          endCall();
        }
      }
    });

    // Auto-refresh every 5 seconds to catch missed events
    const refreshInterval = setInterval(() => {
      fetchQueuedCalls();
    }, 5000);

    return () => {
      socket.off('call:incoming');
      socket.off('call:approved');
      socket.off('call:rejected');
      socket.off('call:completed');
      socket.off('call:hungup');
      clearInterval(refreshInterval);
    };
  }, [socket, activeEpisode]);

  const fetchQueuedCalls = async () => {
    if (!activeEpisode) return;
    
    try {
      const response = await fetch(`/api/calls?episodeId=${activeEpisode.id}&status=queued`);
      const data = await response.json();
      
      // Filter out any that shouldn't be shown
      const activeCalls = data.filter((call: any) => 
        call.status === 'queued' && !call.endedAt
      );
      
      console.log('📋 Active queued calls:', activeCalls.length, '(filtered from', data.length, 'total)');
      setIncomingCalls(activeCalls);
    } catch (error) {
      console.error('Error fetching queued calls:', error);
    }
  };

  const handlePickUpCall = async (call: any) => {
    // Prevent picking up multiple calls
    if (activeCall) {
      alert('You are already screening a call. Please finish it first.');
      return;
    }

    console.log('📞 Picking up call:', call.id);
    
    // CLEAR form first to prevent data from previous call
    setScreenerNotes({
      name: '',
      location: '',
      topic: '',
      truckerType: 'OTR',
      priority: 'normal',
      notes: ''
    });
    
    // Then set active call (triggers form display)
    setActiveCall(call);
    
    // Then pre-fill any known information (brief delay to ensure clean state)
    setTimeout(() => {
      setScreenerNotes({
        name: call.caller?.name || '',
        location: call.caller?.location || '',
        topic: call.topic || '',
        truckerType: call.caller?.truckerType || 'OTR',
        priority: 'normal',
        notes: ''
      });
    }, 100);
    
    // Connect screener's audio to the caller
    if (!screenerReady) {
      alert('⚠️ Phone system not ready. Please wait a moment and try again.');
      setActiveCall(null);
      return;
    }

    console.log('🎙️ Connecting screener to caller...');
    try {
      await connectToCall({ 
        callId: call.id,
        callerId: call.callerId,
        role: 'screener'
      });
      console.log('✅ Audio connection initiated');
    } catch (error) {
      console.error('❌ Error connecting to caller:', error);
      alert('Failed to connect audio. Please try again.');
      setActiveCall(null);
    }
  };

  const handleApproveAndQueue = async () => {
    if (!activeCall) return;
    
    if (!screenerNotes.name || !screenerNotes.topic) {
      alert('⚠️ Please fill in at least Name and Topic before approving');
      return;
    }

    try {
      // End screener's audio connection
      if (screenerConnected) {
        console.log('📴 Ending screener audio connection');
        endCall();
      }

      // Update caller info
      const callerResponse = await fetch(`/api/callers/${activeCall.callerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: screenerNotes.name,
          location: screenerNotes.location,
          truckerType: screenerNotes.truckerType
        })
      });

      if (!callerResponse.ok) {
        throw new Error('Failed to update caller info');
      }

      // Update call with screening info and approve
      const callResponse = await fetch(`/api/calls/${activeCall.id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: screenerNotes.topic,
          screenerNotes: screenerNotes.notes,
          priority: screenerNotes.priority
        })
      });

      if (!callResponse.ok) {
        throw new Error('Failed to approve call');
      }

      console.log('✅ Call approved and added to host queue');
      
      // Reset FIRST, then alert (prevents form flash)
      setActiveCall(null);
      const resetNotes = {
        name: '',
        location: '',
        topic: '',
        truckerType: 'OTR',
        priority: 'normal',
        notes: ''
      };
      setScreenerNotes(resetNotes);
      
      // Force immediate refresh
      fetchQueuedCalls();
      
      // Then show success message
      alert('✅ Call approved! Caller is now in host queue.');
    } catch (error) {
      console.error('❌ Error approving call:', error);
      alert('❌ Failed to approve call. Please try again.');
    }
  };

  const handleRejectCall = async () => {
    if (!activeCall) return;

    if (!confirm('Reject this call? The caller will be disconnected.')) {
      return;
    }

    try {
      // End screener's audio connection first
      if (screenerConnected) {
        endCall();
      }

      // Reject the call in database and end caller's Twilio call
      const response = await fetch(`/api/calls/${activeCall.id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Rejected by screener'
        })
      });

      if (response.ok) {
        console.log('✅ Call rejected successfully');
        alert('Call rejected and ended');
      }

      setActiveCall(null);
      setScreenerNotes({
        name: '',
        location: '',
        topic: '',
        truckerType: 'OTR',
        priority: 'normal',
        notes: ''
      });
      fetchQueuedCalls();
    } catch (error) {
      console.error('Error rejecting call:', error);
      alert('Error rejecting call - check console');
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
                      try {
                        await fetch(`/api/calls/${call.id}/reject`, { method: 'PATCH' });
                      } catch (error) {
                        console.error('Error rejecting call:', error);
                      }
                    }
                    fetchQueuedCalls();
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
            {/* Active Screening Session */}
            {activeCall && (
              <div className="bg-green-900/30 border-2 border-green-500 rounded-lg p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-green-400 mb-2">
                      🎙️ Screening Call: {activeCall.caller?.name || 'Unknown Caller'}
                    </h2>
                    <div className="flex items-center gap-3">
                      {screenerConnected ? (
                        <>
                          <span className="inline-block w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                          <p className="text-green-300 font-semibold">🎙️ Audio Connected</p>
                        </>
                      ) : (
                        <>
                          <span className="inline-block w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></span>
                          <p className="text-yellow-300">⏳ Connecting audio...</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {screenerConnected && (
                      <>
                        <div className="text-2xl font-mono font-bold text-green-400">
                          {formattedDuration}
                        </div>
                        <button
                          onClick={toggleMute}
                          className={`px-6 py-3 rounded-lg font-bold transition-colors ${
                            isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
                          }`}
                        >
                          {isMuted ? '🔇 Unmute' : '🔊 Mute'}
                        </button>
                        <button
                          onClick={endCall}
                          className="px-6 py-3 bg-orange-600 hover:bg-orange-700 rounded-lg font-bold"
                        >
                          📞 End Audio
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Screening Form */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-300">Name *</label>
                    <input
                      type="text"
                      value={screenerNotes.name}
                      onChange={(e) => setScreenerNotes({ ...screenerNotes, name: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-green-500"
                      placeholder="Caller's name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-300">Location</label>
                    <input
                      type="text"
                      value={screenerNotes.location}
                      onChange={(e) => setScreenerNotes({ ...screenerNotes, location: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-green-500"
                      placeholder="City, State"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold mb-2 text-gray-300">What do they want to discuss? *</label>
                    <textarea
                      value={screenerNotes.topic}
                      onChange={(e) => setScreenerNotes({ ...screenerNotes, topic: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-green-500"
                      placeholder="Brief description of their topic..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-300">Trucker Type</label>
                    <select
                      value={screenerNotes.truckerType}
                      onChange={(e) => setScreenerNotes({ ...screenerNotes, truckerType: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-green-500"
                    >
                      <option value="OTR">OTR (Over The Road)</option>
                      <option value="Regional">Regional</option>
                      <option value="Local">Local</option>
                      <option value="Owner-Operator">Owner-Operator</option>
                      <option value="Fleet">Fleet Manager</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-300">Priority</label>
                    <select
                      value={screenerNotes.priority}
                      onChange={(e) => setScreenerNotes({ ...screenerNotes, priority: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-green-500"
                    >
                      <option value="normal">Normal</option>
                      <option value="high">High Priority</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold mb-2 text-gray-300">Notes for Host</label>
                    <textarea
                      value={screenerNotes.notes}
                      onChange={(e) => setScreenerNotes({ ...screenerNotes, notes: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-green-500"
                      placeholder="Any additional context for the host..."
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <button
                    onClick={handleApproveAndQueue}
                    disabled={!screenerNotes.name || !screenerNotes.topic}
                    className="flex-1 px-8 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-xl transition-colors"
                  >
                    ✓ Approve & Add to Host Queue
                  </button>
                  <button
                    onClick={handleRejectCall}
                    className="px-8 py-4 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-xl transition-colors"
                  >
                    ✗ Reject & End Call
                  </button>
                </div>
              </div>
            )}

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

                      <div className="mt-4">
                        <button
                          onClick={() => handlePickUpCall(call)}
                          disabled={!!activeCall || !screenerReady}
                          className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-colors"
                        >
                          {!screenerReady ? '⏳ Phone System Loading...' : activeCall ? '🔒 Screening Another Call' : '📞 Pick Up & Screen This Call'}
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

