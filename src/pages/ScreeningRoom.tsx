import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useBroadcast } from '../contexts/BroadcastContext';
import ChatPanel from '../components/ChatPanel';
import DocumentUploadWidget from '../components/DocumentUploadWidget';

export default function ScreeningRoom() {
  const broadcast = useBroadcast(); // Use global broadcast context
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeEpisode, setActiveEpisode] = useState<any>(null);
  const [incomingCalls, setIncomingCalls] = useState<any[]>([]);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [screenerNotes, setScreenerNotes] = useState({
    name: '',
    location: '',
    topic: '',
    truckerType: 'OTR',
    priority: 'normal',
    notes: ''
  });

  // Check if Twilio device is ready (use global or initialize if needed)
  const [localDeviceReady, setLocalDeviceReady] = useState(false);
  const screenerReady = broadcast.twilioDevice !== null || localDeviceReady;
  const screenerConnected = activeCall !== null;
  
  // Initialize session Twilio device (one per session, reused for all roles)
  useEffect(() => {
    if (!broadcast.twilioDevice && !localDeviceReady) {
      console.log('📞 [SCREENER] Initializing session device');
      const sessionId = `session-${Date.now()}`;
      broadcast.initializeTwilio(sessionId)
        .then(() => {
          setLocalDeviceReady(true);
          console.log('✅ [SCREENER] Session device ready');
        })
        .catch(err => {
          console.error('❌ [SCREENER] Failed to initialize:', err);
        });
    }
  }, [broadcast.twilioDevice]);

  useEffect(() => {
    console.log('🚀 ScreeningRoom mounted - initializing...');
    
    // Use episode from broadcast context first
    const contextEpisodeId = broadcast.state.episodeId;
    
    if (contextEpisodeId) {
      fetch(`/api/episodes/${contextEpisodeId}`)
        .then(res => res.json())
        .then(episode => {
          setActiveEpisode(episode);
          console.log('✅ Active episode loaded from context:', episode.title, 'ID:', episode.id);
        })
        .catch(err => console.error('❌ Error fetching episode:', err));
    } else {
      // Fallback: fetch active episode
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
    }

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

    console.log('🔌 [SCREENER] Joining episode room:', activeEpisode.id);
    socket.emit('join:episode', activeEpisode.id);

    // Wait for join confirmation
    socket.on('joined:episode', (data) => {
      console.log('✅ [SCREENER] Successfully joined episode room:', data.episodeId);
      // Now fetch existing calls
      fetchQueuedCalls();
    });

    socket.on('call:incoming', (data) => {
      console.log('📞 [SCREENER] Incoming call event received:', data);
      // Refresh immediately
      fetchQueuedCalls();
      // And again after 1 second to catch any database lag
      setTimeout(fetchQueuedCalls, 1000);
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

    socket.on('call:completed', async (data) => {
      console.log('📴 Call completed:', data);
      
      // If this is the call being screened, close the form
      if (activeCall && data.callId === activeCall.id) {
        console.log('🔴 Active call completed - closing form');
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
          await broadcast.disconnectCurrentCall();
        }
      }
      
      fetchQueuedCalls(); // Refresh the list
    });

    socket.on('call:hungup', async (data) => {
      console.log('📴 Caller hung up event:', data);
      console.log('   Current active call:', activeCall?.id);
      console.log('   Hung up call ID:', data.callId);
      
      // Close form if this is active call (check both callId formats)
      const isActiveCall = activeCall && (
        data.callId === activeCall.id || 
        data.id === activeCall.id ||
        data.callId === activeCall.twilioCallSid
      );
      
      if (isActiveCall) {
        console.log('🔴 Active call hung up - closing form and disconnecting');
        
        // Disconnect screener audio immediately
        if (screenerConnected) {
          try {
            await broadcast.disconnectCurrentCall();
            console.log('✓ Screener disconnected');
          } catch (error) {
            console.error('Error disconnecting screener:', error);
          }
        }
        
        // Clear the form
        setActiveCall(null);
        setScreenerNotes({
          name: '',
          location: '',
          topic: '',
          truckerType: 'OTR',
          priority: 'normal',
          notes: ''
        });
      }
      
      // Always refresh the call list to remove hung up calls
      fetchQueuedCalls();
    });

    socket.on('participant:state-changed', (data) => {
      console.log('🔄 [SCREENER] Participant state changed:', data);
      // Refresh call list when host sends call back to screening
      fetchQueuedCalls();
    });

    socket.on('call:screening', async (data) => {
      console.log('🔍 [SCREENER] Call sent back to screening from host:', data);
      
      // CRITICAL: If this is our active call being sent back, clear it
      if (activeCall && (data.id === activeCall.id || data.callId === activeCall.id)) {
        console.log('🔴 Active call sent back to screening - clearing active state');
        
        // CRITICAL: Disconnect screener audio FIRST before clearing state
        if (screenerConnected) {
          try {
            await broadcast.disconnectCurrentCall();
            console.log('✅ Screener disconnected from call');
          } catch (e) {
            console.error('⚠️ Error disconnecting screener:', e);
          }
        }
        
        // Now clear state
        setActiveCall(null);
      }
      
      // Immediately refresh to show the call
      fetchQueuedCalls();
    });
    
    socket.on('episode:lines-opened', (episode) => {
      console.log('📞 [SCREENER] Lines opened event:', episode);
      setActiveEpisode(episode);
    });
    
    socket.on('episode:start', (episode) => {
      console.log('🎙️ [SCREENER] Episode started event:', episode);
      setActiveEpisode(episode);
    });

    // Auto-refresh every 2 seconds to catch missed events (more frequent!)
    const refreshInterval = setInterval(() => {
      fetchQueuedCalls();
    }, 2000);

    return () => {
      socket.off('call:incoming');
      socket.off('call:approved');
      socket.off('call:rejected');
      socket.off('call:completed');
      socket.off('call:hungup');
      socket.off('participant:state-changed');
      socket.off('call:screening');
      socket.off('episode:lines-opened');
      socket.off('episode:start');
      clearInterval(refreshInterval);
    };
  }, [socket, activeEpisode]);

  const fetchQueuedCalls = async () => {
    if (!activeEpisode) return;
    
    try {
      // Fetch all queued and screening calls (not completed/rejected)
      // Note: Fetch ALL calls for episode, then filter client-side for both queued AND screening
      const response = await fetch(`/api/calls?episodeId=${activeEpisode.id}`);
      const data = await response.json();
      
      // Filter out any that shouldn't be shown:
      // - Must be queued or screening status
      // - Must not have endedAt set (caller hung up)
      // - Must not be completed or rejected
      const activeCalls = data.filter((call: any) => {
        const isActive = (call.status === 'queued' || call.status === 'screening') && 
                         !call.endedAt && 
                         call.status !== 'completed' && 
                         call.status !== 'rejected';
        
        if (!isActive && call.endedAt) {
          console.log(`🗑️ Filtering out completed call: ${call.id} (status: ${call.status}, endedAt: ${call.endedAt})`);
        }
        
        return isActive;
      });
      
      console.log('📋 Active queued calls:', activeCalls.length, '(filtered from', data.length, 'total)');
      setIncomingCalls(activeCalls);
    } catch (error) {
      console.error('Error fetching queued calls:', error);
    }
  };

  const handlePickUpCall = async (call: any) => {
    console.log('📞 Picking up call:', call.id);
    
    // SIMPLIFIED: If we have an active call, disconnect it first (don't destroy device)
    if (activeCall) {
      console.warn('⚠️ Active call exists - disconnecting before pickup');
      try {
        await broadcast.disconnectCurrentCall();
        setActiveCall(null);
        // Brief wait for disconnect
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('✅ Previous call disconnected');
      } catch (e) {
        console.error('❌ Failed to disconnect:', e);
      }
    }
    
    // Update call status to 'screening' in database
    try {
      await fetch(`/api/calls/${call.id}/screen`, {
        method: 'PATCH'
      });
      console.log('✅ Call status updated to screening');
    } catch (error) {
      console.error('⚠️ Error updating call status:', error);
      // Continue anyway
    }
    
    // Set active call first (this will cause DocumentUploadWidget to re-render with new callerId)
    setActiveCall(call);
    
    // IMMEDIATELY clear and populate with fresh data (no delay)
    setScreenerNotes({
      name: call.caller?.name || '',
      location: call.caller?.location || '',
      topic: call.topic || '',
      truckerType: call.caller?.truckerType || 'OTR',
      priority: 'normal',
      notes: ''
    });
    
    // Refresh queues to remove this call from "Queued for Host" list
    fetchQueuedCalls();
    
    // Connect screener's audio to the caller using global device
    if (!screenerReady) {
      console.error('⚠️ Phone system not ready');
      setActiveCall(null);
      return;
    }

    console.log('🎙️ Connecting screener to caller...');
    try {
      const callerName = call.caller?.name || 'Caller';
      
      // Connect screener to conference
      await broadcast.connectToCall(call.id, callerName, activeEpisode.id, 'screener');
      console.log('✅ Screener audio connection initiated');
      
      // Wait a moment for screener to fully connect to conference
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // CRITICAL: Unmute caller so screener can talk to them
      console.log('📞 Unmuting caller for screening...');
      try {
        // Use on-air endpoint to unmute (removes hold and unmutes)
        const onAirRes = await fetch(`/api/participants/${call.id}/on-air`, { method: 'PATCH' });
        if (onAirRes.ok) {
          console.log('✅ Caller unmuted for screening');
        } else {
          const errorText = await onAirRes.text();
          console.error('⚠️ on-air endpoint failed:', onAirRes.status, errorText);
        }
        
        // Extra safety: Wait then verify they're actually unmuted
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('✅ Screening connection complete');
      } catch (holdError) {
        console.error('⚠️ Failed to unmute caller:', holdError);
      }
    } catch (error) {
      console.error('❌ Error connecting to caller:', error);
      setActiveCall(null);
    }
  };

  const handleApproveAndQueue = async () => {
    if (!activeCall) return;
    
    if (!screenerNotes.name || !screenerNotes.topic) {
      console.warn('⚠️ Name and Topic required before approving');
      return; // Silently prevent - button should be disabled anyway
    }

    setApproving(true);
    try {
      const callToApprove = activeCall;
      
      // NOTE: In conference mode, DON'T disconnect the call!
      // The caller stays in the conference (muted in HOLD state)
      // Only disconnect screener's local audio connection
      if (screenerConnected) {
        console.log('📴 Screener ending local connection (caller stays in conference)');
        // Disconnect only the screener's Twilio Device connection
        if (broadcast.twilioDevice) {
          broadcast.twilioDevice.disconnectAll();
        }
      }
      
      // Clear active call FIRST to trigger document widget unmount
      setActiveCall(null);

      // Update caller info
      const callerResponse = await fetch(`/api/callers/${callToApprove.callerId}`, {
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
      const callResponse = await fetch(`/api/calls/${callToApprove.id}/approve`, {
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
      
      // Clear form data
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
      
      console.log('✅ Call approved and queued for host');
    } catch (error) {
      console.error('❌ Error approving call:', error);
    } finally {
      setApproving(false);
    }
  };

  const handleRejectCall = async () => {
    if (!activeCall) return;

    // No confirmation popup - just reject immediately
    console.log('🚫 Rejecting call:', activeCall.id);

    setRejecting(true);
    try{
      // End screener's audio connection first
      if (screenerConnected) {
        await broadcast.disconnectCurrentCall();
      }

      const callToReject = activeCall;
      
      // Clear active call FIRST to unmount document widget
      setActiveCall(null);

      // Reject the call in database and end caller's Twilio call
      const response = await fetch(`/api/calls/${callToReject.id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Rejected by screener'
        })
      });

      if (response.ok) {
        console.log('✅ Call rejected successfully');
      }

      // Clear form
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
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Single Header Bar */}
      <div className="px-6 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            {activeEpisode && <span className="inline-block w-3 h-3 bg-red-500 rounded-full animate-pulse" />}
            <h2 className="text-lg font-bold">Call Screening Room</h2>
            {activeEpisode && <span className="text-sm text-gray-500">{activeEpisode.title}</span>}
          </div>
          
          {!activeCall && activeEpisode && (
            <>
              <div className="h-6 w-px bg-gray-600"></div>
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold text-gray-300">Queued for Host</h3>
                <span className="text-xl font-bold text-green-400">{incomingCalls.filter(c => c.status !== 'rejected').length}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Layout: Content + Chat - 50/50 Split */}
      <div className="flex-1 flex">
        {/* Left: Screening Content - 50% */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">

            {/* Active Screening Session - Compact */}
            {activeCall && activeEpisode && (
              <div className="bg-green-900/30 border-2 border-green-500 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {screenerConnected ? (
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    ) : (
                      <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                    )}
                    <span className="text-sm text-gray-400">
                      {screenerConnected ? 'Connected' : 'Connecting...'}
                    </span>
                  </div>
        </div>

                {/* Compact Screening Form - Single Line */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <input
                    type="text"
                    value={screenerNotes.name}
                    onChange={(e) => setScreenerNotes({ ...screenerNotes, name: e.target.value })}
                    className="px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-green-500 text-sm"
                    placeholder="Name *"
                  />
                  <input
                    type="text"
                    value={screenerNotes.location}
                    onChange={(e) => setScreenerNotes({ ...screenerNotes, location: e.target.value })}
                    className="px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-green-500 text-sm"
                    placeholder="Location"
                  />
                  <input
                    type="text"
                    value={screenerNotes.topic}
                    onChange={(e) => setScreenerNotes({ ...screenerNotes, topic: e.target.value })}
                    className="px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-green-500 text-sm"
                    placeholder="Topic *"
                  />
                </div>

                {/* Document Upload - Compact */}
                {activeCall.callerId && (
                  <div className="mb-3">
                    <DocumentUploadWidget
                      key={activeCall.id}
                      callerId={activeCall.callerId}
                      callId={activeCall.id}
                      maxFiles={3}
                    />
                  </div>
                )}

                {/* Compact Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleApproveAndQueue}
                    disabled={!screenerNotes.name || !screenerNotes.topic || approving || rejecting}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm font-semibold transition-colors"
                  >
                    {approving ? '⏳ Approving...' : '✓ Approve'}
                  </button>
                  <button
                    onClick={handleRejectCall}
                    disabled={approving || rejecting}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm font-semibold transition-colors"
                  >
                    {rejecting ? '⏳ Rejecting...' : '✗ Reject'}
                  </button>
                </div>
              </div>
            )}

            {/* Queued Calls - Only show if no active call being screened */}
            {!activeCall && activeEpisode && (
              <div>
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

                      {/* Don't show button if THIS call is being screened */}
                      {activeCall && activeCall.id === call.id ? null : (
                        <div className="mt-4">
                          <button
                            onClick={() => handlePickUpCall(call)}
                            disabled={!!activeCall || !screenerReady}
                            className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-colors"
                          >
                            {!screenerReady ? '⏳ Phone System Loading...' : activeCall ? '🔒 Screening Another Call' : '📞 Pick Up & Screen This Call'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              </div>
            )}

            {!activeEpisode && (
          <div className="text-center py-16 bg-gray-800 rounded-lg">
            <p className="text-gray-400 text-lg">No active episode</p>
            <p className="text-gray-500 text-sm mt-2">Start a show to begin screening calls</p>
          </div>
        )}

          </div>
        </div>

        {/* Right: Chat Sidebar - 50% */}
        <div className="flex-1 border-l border-gray-700">
          {activeEpisode && <ChatPanel episodeId={activeEpisode.id} userRole="screener" />}
        </div>
      </div>
    </div>
  );
}

