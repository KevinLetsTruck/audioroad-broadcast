/**
 * Participant Board
 * 
 * Shows all active participants grouped by state (ON AIR, ON HOLD, SCREENING)
 * Allows host to control who's broadcasting
 */

import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useBroadcast } from '../contexts/BroadcastContext';

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
      console.log('📡 Putting participant on air:', callId);
      
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
      
      if (hostNeedsConnection) {
        if (!broadcast.twilioDevice) {
          throw new Error('Twilio device not initialized. Please start a show first.');
        }
        console.log('🔌 Connecting host to Twilio conference to hear callers...');
        try {
          await broadcast.connectToCall(callId, callerName, episodeId, 'host');
          await new Promise(resolve => setTimeout(resolve, 1500));
          console.log('✅ Host connected to conference');
        } catch (error) {
          console.warn('⚠️ Host connection attempt failed (may already be connected):', error);
          // Continue anyway - host might already be connected
        }
      } else {
        console.log(`✅ Host already connected to conference (${broadcast.activeCalls.size} active call(s))`);
      }
      
      const response = await fetch(`/api/participants/${callId}/on-air`, { method: 'PATCH' });
      if (!response.ok) {
        throw new Error('Failed to put participant on air');
      }
      
      fetchParticipants();
    } catch (error) {
      console.error('Error putting on air:', error);
      alert(`Failed to put participant on air: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const putOnHold = async (callId: string) => {
    try {
      console.log('⏸️ Putting participant on hold:', callId);
      await fetch(`/api/participants/${callId}/hold`, { method: 'PATCH' });
      fetchParticipants();
    } catch (error) {
      console.error('Error putting on hold:', error);
      alert('Failed to put participant on hold');
    }
  };

  const moveToScreening = async (callId: string) => {
    try {
      console.log('🔍 Moving to screening:', callId);
      await fetch(`/api/participants/${callId}/screening`, { method: 'PATCH' });
      fetchParticipants();
    } catch (error) {
      console.error('Error moving to screening:', error);
      alert('Failed to move to screening');
    }
  };

  const muteParticipant = async (callId: string) => {
    try {
      console.log('🔇 Muting participant:', callId);
      await fetch(`/api/participants/${callId}/mute`, { method: 'PATCH' });
      fetchParticipants();
    } catch (error) {
      console.error('Error muting participant:', error);
      alert('Failed to mute participant');
    }
  };

  const unmuteParticipant = async (callId: string) => {
    try {
      console.log('🔊 Unmuting participant:', callId);
      await fetch(`/api/participants/${callId}/unmute`, { method: 'PATCH' });
      fetchParticipants();
    } catch (error) {
      console.error('Error unmuting participant:', error);
      alert('Failed to unmute participant');
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
      alert('Failed to end call');
    }
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
            {participants.onAir.map((p) => (
              <div key={p.id} className="bg-gray-800 rounded p-3 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getRoleIcon(p.participantRole)}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{p.caller?.name || 'Unknown'}</span>
                        {p.isMutedInConference && (
                          <span className="text-xs text-gray-400" title="Muted">
                            🔇
                          </span>
                        )}
                      </div>
                      {p.topic && <div className="text-xs text-gray-400">{p.topic}</div>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
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
            ))}
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
            {participants.onHold.map((p) => (
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
            ))}
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

