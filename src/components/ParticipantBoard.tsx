/**
 * Participant Board
 * 
 * Shows all active participants grouped by state (ON AIR, ON HOLD, SCREENING)
 * Allows host to control who's broadcasting
 */

import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useBroadcast } from '../contexts/BroadcastContext';

interface CallerHistory {
  totalCalls: number;
  previousCalls: any[];
  documentsCount: number;
  aiSummary: string | null;
  sentiment: string | null;
  isFavorite: boolean;
}

interface Participant {
  id: string;
  caller: {
    name: string;
    location?: string;
  };
  topic?: string;
  participantState: 'screening' | 'hold' | 'on-air';
  participantRole: 'caller' | 'guest' | 'co-host';
  isMutedInConference: boolean;
  connectedAt: Date;
}

interface ParticipantBoardProps {
  episodeId: string;
}

export default function ParticipantBoard({ episodeId }: ParticipantBoardProps) {
  const broadcast = useBroadcast();
  const [participants, setParticipants] = useState<{
    onAir: Participant[];
    onHold: Participant[];
    screening: Participant[];
  }>({
    onAir: [],
    onHold: [],
    screening: []
  });
  
  const [expandedCallerId, setExpandedCallerId] = useState<string | null>(null);
  const [callerHistories, setCallerHistories] = useState<Record<string, CallerHistory>>({});

  useEffect(() => {
    fetchParticipants();
    
    // Set up WebSocket for real-time updates
    const newSocket = io();

    newSocket.on('participant:state-changed', () => {
      console.log('🔔 Participant state changed - refreshing');
      fetchParticipants();
    });

    // Poll every 3 seconds as backup
    const interval = setInterval(fetchParticipants, 3000);

    return () => {
      newSocket.close();
      clearInterval(interval);
    };
  }, [episodeId]);

  const fetchParticipants = async () => {
    try {
      const response = await fetch(`/api/participants/${episodeId}`);
      const data = await response.json();
      setParticipants(data);
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const putOnAir = async (callId: string) => {
    try {
      console.log('📡 [PARTICIPANT-BOARD] Putting participant on air:', callId);
      console.log('   Episode ID:', episodeId);
      console.log('   Twilio device:', broadcast.twilioDevice ? 'Ready' : 'Not initialized');
      console.log('   Active calls:', broadcast.activeCalls.size);
      
      const participant = [...participants.onAir, ...participants.onHold, ...participants.screening]
        .find(p => p.id === callId);
      const callerName = participant?.caller?.name || 'Caller';
      
      // Ensure host is connected to Twilio conference to hear callers
      // All callers for the same episode join the same conference (episode-${episodeId})
      // The host only needs ONE connection per episode to hear all callers
      // Check if host is already connected by checking Twilio device state
      const hostNeedsConnection = !broadcast.twilioDevice || 
        broadcast.activeCalls.size === 0 ||
        !Array.from(broadcast.activeCalls.values()).some(call => {
          // Check if there's an active call for this episode
          // Since all calls for same episode use same conference, any call means host is connected
          return call.twilioCall && call.twilioCall.status() !== 'closed';
        });
      
      console.log('   Host needs connection?', hostNeedsConnection);
      
      if (hostNeedsConnection) {
        if (!broadcast.twilioDevice) {
          const errorMsg = 'Twilio device not initialized. Please start a show first.';
          console.error('❌ [PARTICIPANT-BOARD]', errorMsg);
          alert(errorMsg);
          return;
        }
        console.log('🔌 [PARTICIPANT-BOARD] Connecting host to Twilio conference...');
        try {
          await broadcast.connectToCall(callId, callerName, episodeId, 'host');
          await new Promise(resolve => setTimeout(resolve, 1500));
          console.log('✅ [PARTICIPANT-BOARD] Host connected to conference');
        } catch (error) {
          console.error('❌ [PARTICIPANT-BOARD] Host connection failed:', error);
          alert(`Failed to connect to caller: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return;
        }
      } else {
        console.log(`✅ [PARTICIPANT-BOARD] Host already connected (${broadcast.activeCalls.size} active call(s))`);
      }
      
      console.log('📡 [PARTICIPANT-BOARD] Calling API to put on air...');
      const response = await fetch(`/api/participants/${callId}/on-air`, { method: 'PATCH' });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [PARTICIPANT-BOARD] API call failed:', response.status, errorText);
        alert(`Failed to put participant on air: ${errorText}`);
        return;
      }
      
      console.log('✅ [PARTICIPANT-BOARD] Successfully put on air');
      fetchParticipants();
    } catch (error) {
      console.error('❌ [PARTICIPANT-BOARD] Error in putOnAir:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const putOnHold = async (callId: string) => {
    try {
      console.log('⏸️ Putting participant on hold:', callId);
      await fetch(`/api/participants/${callId}/hold`, { method: 'PATCH' });
      fetchParticipants();
    } catch (error) {
      console.error('Error putting on hold:', error);
    }
  };

  const moveToScreening = async (callId: string) => {
    try {
      console.log('🔍 Moving to screening:', callId);
      await fetch(`/api/participants/${callId}/screening`, { method: 'PATCH' });
      fetchParticipants();
    } catch (error) {
      console.error('Error moving to screening:', error);
    }
  };

  const muteParticipant = async (callId: string) => {
    try {
      console.log('🔇 Muting participant:', callId);
      await fetch(`/api/participants/${callId}/mute`, { method: 'PATCH' });
      fetchParticipants();
    } catch (error) {
      console.error('Error muting participant:', error);
    }
  };

  const unmuteParticipant = async (callId: string) => {
    try {
      console.log('🔊 Unmuting participant:', callId);
      await fetch(`/api/participants/${callId}/unmute`, { method: 'PATCH' });
      fetchParticipants();
    } catch (error) {
      console.error('Error unmuting participant:', error);
    }
  };

  const endCall = async (callId: string) => {
    if (!confirm('End this call? The participant will be disconnected.')) return;
    
    try {
      console.log('📴 Ending call:', callId);
      await fetch(`/api/calls/${callId}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ airDuration: 0 })
      });
      console.log('✅ Call ended successfully');
      fetchParticipants();
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  const fetchCallerHistory = async (participant: Participant) => {
    // Get the actual caller record to find their ID
    try {
      console.log('📊 Fetching history for caller:', participant.caller?.name);
      
      // Find the call to get callerId
      const callResponse = await fetch(`/api/calls/${participant.id}`);
      if (!callResponse.ok) return;
      
      const call = await callResponse.json();
      const callerId = call.callerId;
      
      if (!callerId) return;
      
      // Fetch full caller details with history
      const callerResponse = await fetch(`/api/callers/${callerId}`);
      if (!callerResponse.ok) return;
      
      const callerData = await callerResponse.json();
      
      // Filter out current call from history
      const previousCalls = callerData.calls
        ?.filter((c: any) => c.id !== participant.id)
        .slice(0, 3) || [];
      
      setCallerHistories(prev => ({
        ...prev,
        [callerId]: {
          totalCalls: callerData.totalCalls || 0,
          previousCalls,
          documentsCount: callerData._count?.documents || 0,
          aiSummary: callerData.aiSummary,
          sentiment: callerData.sentiment,
          isFavorite: callerData.isFavorite || false
        }
      }));
      
      console.log('✅ Loaded caller history:', callerData.name, 'Total calls:', callerData.totalCalls);
    } catch (error) {
      console.error('Error fetching caller history:', error);
    }
  };

  const toggleCallerHistory = async (participant: Participant) => {
    // Get callerId from the participant
    const call = await fetch(`/api/calls/${participant.id}`).then(r => r.json());
    const callerId = call.callerId;
    
    if (expandedCallerId === callerId) {
      // Collapse
      setExpandedCallerId(null);
    } else {
      // Expand and fetch history if we don't have it yet
      setExpandedCallerId(callerId);
      if (!callerHistories[callerId]) {
        await fetchCallerHistory(participant);
      }
    }
  };

  const getCallBadge = (participant: Participant) => {
    // Check if we have history loaded
    const call = participants.onHold.find(p => p.id === participant.id) ||
                 participants.onAir.find(p => p.id === participant.id) ||
                 participants.screening.find(p => p.id === participant.id);
    
    // This is a placeholder - we'll get the actual count from the history
    return null; // Will be populated after fetching history
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'co-host': return '🎙️';
      case 'guest': return '👤';
      case 'caller': return '📞';
      default: return '📞';
    }
  };

  return (
    <div className="space-y-4">
      {/* ON AIR Section */}
      <div className="bg-red-900/30 border-2 border-red-500 rounded-lg p-4">
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
          ON AIR ({participants.onAir.length})
        </h3>
        
        {participants.onAir.length === 0 ? (
          <p className="text-sm text-gray-400">No participants on air</p>
        ) : (
          <div className="space-y-2">
            {participants.onAir.map((p) => {
              const callerId = (p as any).callerId;
              const history = callerId ? callerHistories[callerId] : null;
              const isExpanded = callerId && expandedCallerId === callerId;
              
              return (
                <div key={p.id} className="bg-gray-800 rounded p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getRoleIcon(p.participantRole)}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{p.caller?.name || 'Unknown'}</span>
                            {p.isMutedInConference && (
                              <span className="text-xs text-gray-400" title="Muted">🔇</span>
                            )}
                            {history && history.totalCalls > 1 && (
                              <span className="px-2 py-0.5 bg-blue-600 rounded text-xs font-bold">
                                {history.totalCalls}{history.totalCalls === 2 ? 'nd' : history.totalCalls === 3 ? 'rd' : 'th'} call
                              </span>
                            )}
                            {history && history.isFavorite && (
                              <span className="text-yellow-400" title="VIP Caller">⭐</span>
                            )}
                          </div>
                          {p.caller?.location && (
                            <div className="text-xs text-gray-500">{p.caller.location}</div>
                          )}
                          {p.topic && <div className="text-xs text-gray-400">{p.topic}</div>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {callerId && (
                        <button
                          onClick={() => toggleCallerHistory(p)}
                          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                          title="View caller history"
                        >
                          {isExpanded ? '▲' : '▼'}
                        </button>
                      )}
                      {p.isMutedInConference ? (
                        <button
                          onClick={() => unmuteParticipant(p.id)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-semibold"
                          title="Unmute participant"
                        >
                          🔊 Unmute
                        </button>
                      ) : (
                        <button
                          onClick={() => muteParticipant(p.id)}
                          className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs font-semibold"
                          title="Mute participant"
                        >
                          🔇 Mute
                        </button>
                      )}
                      <button
                        onClick={() => putOnHold(p.id)}
                        className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs font-semibold"
                      >
                        ⏸️ Hold
                      </button>
                      <button
                        onClick={() => endCall(p.id)}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-semibold"
                      >
                        End
                      </button>
                    </div>
                  </div>
                  
                  {/* Expandable Caller History */}
                  {isExpanded && history && (
                    <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                      {/* AI Summary */}
                      {history.aiSummary && (
                        <div className="bg-blue-900/30 border border-blue-600 rounded p-2">
                          <div className="text-xs font-semibold text-blue-300 mb-1">💡 AI Insights</div>
                          <p className="text-xs text-gray-300">{history.aiSummary}</p>
                        </div>
                      )}
                      
                      {/* Previous Calls */}
                      {history.previousCalls && history.previousCalls.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-gray-400 mb-1">📅 Previous Calls</div>
                          <div className="space-y-1">
                            {history.previousCalls.map((call: any) => (
                              <div key={call.id} className="bg-gray-900 rounded p-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-300">
                                    {new Date(call.incomingAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                  {call.airDuration && (
                                    <span className="text-green-400">{Math.floor(call.airDuration / 60)}m on-air</span>
                                  )}
                                </div>
                                {call.topic && (
                                  <div className="text-gray-500 mt-1">"{call.topic}"</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Stats */}
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>📄 {history.documentsCount} documents</span>
                        {history.sentiment && (
                          <span>
                            {history.sentiment === 'positive' && '😊 Positive'}
                            {history.sentiment === 'neutral' && '😐 Neutral'}
                            {history.sentiment === 'negative' && '😔 Negative'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ON HOLD Section */}
      <div className="bg-yellow-900/30 border-2 border-yellow-600 rounded-lg p-4">
        <h3 className="text-lg font-bold mb-3">
          ⏸️ ON HOLD ({participants.onHold.length})
        </h3>
        
        {participants.onHold.length === 0 ? (
          <p className="text-sm text-gray-400">No participants on hold</p>
        ) : (
          <div className="space-y-2">
            {participants.onHold.map((p) => {
              const callerId = (p as any).callerId;
              const history = callerId ? callerHistories[callerId] : null;
              const isExpanded = callerId && expandedCallerId === callerId;
              
              return (
                <div key={p.id} className="bg-gray-800 rounded p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getRoleIcon(p.participantRole)}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{p.caller?.name || 'Unknown'}</span>
                            {history && history.totalCalls > 1 && (
                              <span className="px-2 py-0.5 bg-blue-600 rounded text-xs font-bold">
                                {history.totalCalls}{history.totalCalls === 2 ? 'nd' : history.totalCalls === 3 ? 'rd' : 'th'} call
                              </span>
                            )}
                            {history && history.isFavorite && (
                              <span className="text-yellow-400" title="VIP Caller">⭐</span>
                            )}
                          </div>
                          {p.caller?.location && (
                            <div className="text-xs text-gray-500">{p.caller.location}</div>
                          )}
                          {p.topic && <div className="text-xs text-gray-400">{p.topic}</div>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {callerId && (
                        <button
                          onClick={() => toggleCallerHistory(p)}
                          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                          title="View caller history"
                        >
                          {isExpanded ? '▲' : '▼'}
                        </button>
                      )}
                      <button
                        onClick={() => putOnAir(p.id)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-semibold"
                      >
                        📡 On Air
                      </button>
                      <button
                        onClick={() => moveToScreening(p.id)}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-semibold"
                      >
                        Screen
                      </button>
                      <button
                        onClick={() => endCall(p.id)}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-semibold"
                      >
                        End
                      </button>
                    </div>
                  </div>
                  
                  {/* Expandable Caller History */}
                  {isExpanded && history && (
                    <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                      {/* AI Summary */}
                      {history.aiSummary && (
                        <div className="bg-blue-900/30 border border-blue-600 rounded p-2">
                          <div className="text-xs font-semibold text-blue-300 mb-1">💡 AI Insights</div>
                          <p className="text-xs text-gray-300">{history.aiSummary}</p>
                        </div>
                      )}
                      
                      {/* Previous Calls */}
                      {history.previousCalls && history.previousCalls.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-gray-400 mb-1">📅 Previous Calls</div>
                          <div className="space-y-1">
                            {history.previousCalls.map((call: any) => (
                              <div key={call.id} className="bg-gray-900 rounded p-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-300">
                                    {new Date(call.incomingAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                  {call.airDuration && (
                                    <span className="text-green-400">{Math.floor(call.airDuration / 60)}m on-air</span>
                                  )}
                                </div>
                                {call.topic && (
                                  <div className="text-gray-500 mt-1">"{call.topic}"</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Stats */}
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>📄 {history.documentsCount} documents</span>
                        {history.sentiment && (
                          <span>
                            {history.sentiment === 'positive' && '😊 Positive'}
                            {history.sentiment === 'neutral' && '😐 Neutral'}
                            {history.sentiment === 'negative' && '😔 Negative'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SCREENING Section */}
      <div className="bg-blue-900/30 border-2 border-blue-500 rounded-lg p-4">
        <h3 className="text-lg font-bold mb-3">
          🔍 SCREENING ({participants.screening.length})
        </h3>
        
        {participants.screening.length === 0 ? (
          <p className="text-sm text-gray-400">No calls being screened</p>
        ) : (
          <div className="space-y-2">
            {participants.screening.map((p) => (
              <div key={p.id} className="bg-gray-800 rounded p-3 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getRoleIcon(p.participantRole)}</span>
                    <div>
                      <div className="font-semibold">{p.caller?.name || 'Unknown'}</div>
                      {p.topic && <div className="text-xs text-gray-400">{p.topic}</div>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => putOnHold(p.id)}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-semibold"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => endCall(p.id)}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-semibold"
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
  );
}

