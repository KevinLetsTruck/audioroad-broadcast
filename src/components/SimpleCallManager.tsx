/**
 * Simple Call Manager
 * 
 * Shows queued callers and active calls
 * Host can connect/disconnect multiple calls simultaneously
 */

import { useState, useEffect } from 'react';
import { useBroadcast } from '../contexts/BroadcastContext';

interface SimpleCallManagerProps {
  episodeId: string;
}

export default function SimpleCallManager({ episodeId }: SimpleCallManagerProps) {
  const broadcast = useBroadcast();
  const [queuedCalls, setQueuedCalls] = useState<any[]>([]);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, [episodeId]);

  const fetchQueue = async () => {
    try {
      const response = await fetch(`/api/calls?episodeId=${episodeId}&status=approved`);
      const calls = await response.json();
      
      // Filter active, recent calls
      const now = Date.now();
      const active = calls.filter((c: any) => {
        if (c.endedAt) return false;
        if (c.status === 'completed') return false;
        const age = now - new Date(c.incomingAt).getTime();
        return age < 4 * 60 * 60 * 1000; // Last 4 hours
      });
      
      setQueuedCalls(active);
    } catch (error) {
      console.error('Error fetching queue:', error);
    }
  };

  const connectToCall = async (call: any) => {
    try {
      const callerName = call.caller?.name || 'Caller';
      
      // Check if this is the FIRST connection
      const isFirstConnection = broadcast.activeCalls.size === 0;
      
      if (isFirstConnection) {
        // First participant: Host joins conference WITH them
        console.log('🎙️ [MULTI] First participant - host joining conference');
        await broadcast.connectToCall(call.id, callerName, episodeId, 'host');
        console.log('✅ [MULTI] Host in conference with:', callerName);
      } else {
        // Subsequent participants: They're already in conference MUTED
        // Just unmute them in Twilio
        console.log('📡 [MULTI] Additional participant - unmuting in conference:', callerName);
        
        const response = await fetch(`/api/participants/${call.id}/on-air`, { method: 'PATCH' });
        if (!response.ok) {
          throw new Error('Failed to unmute participant');
        }
        console.log('✅ [MULTI] Participant unmuted:', callerName);
      }
      
      // Refresh to show updated state
      setTimeout(fetchQueue, 500);
    } catch (error) {
      console.error('Failed to connect:', error);
      alert('Failed to connect to participant');
    }
  };

  const disconnectCall = async (callId: string) => {
    if (!confirm('End this call? The caller will be disconnected.')) {
      return;
    }

    try {
      console.log('📴 [MULTI] Disconnecting participant:', callId);
      
      // Check how many participants are currently on-air
      const onAirCalls = queuedCalls.filter(c => c.participantState === 'on-air');
      
      if (onAirCalls.length === 1 && broadcast.activeCalls.size > 0) {
        // This is the last on-air participant - disconnect host too
        console.log('📴 [MULTI] Last participant - disconnecting host from conference');
        await broadcast.disconnectCall(callId);
      } else {
        // Multiple participants - just mute/remove this one
        console.log('⏸️ [MULTI] Other participants still active - muting this one');
        await fetch(`/api/participants/${callId}/hold`, { method: 'PATCH' });
      }
      
      // Mark as completed in database
      await fetch(`/api/calls/${callId}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ airDuration: 0 })
      });
      
      console.log('✅ [MULTI] Participant disconnected');
      setTimeout(fetchQueue, 500);
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  // Separate calls by state
  const onAirCalls = queuedCalls.filter(c => c.participantState === 'on-air');
  const queuedNotOnAir = queuedCalls.filter(c => c.participantState !== 'on-air');

  return (
    <div className="space-y-4">
      {/* Active Calls - Currently Broadcasting */}
      {onAirCalls.length > 0 && (
        <div className="bg-red-900/30 border-2 border-red-500 rounded-lg p-4">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
            🎙️ ACTIVE - ON AIR ({onAirCalls.length})
          </h3>
          <div className="space-y-2">
            {onAirCalls.map((call) => {
              const connectedAt = call.onAirAt || call.connectedAt || call.incomingAt;
              const minutesConnected = Math.floor((Date.now() - new Date(connectedAt).getTime()) / 1000 / 60);
              
              return (
                <div key={call.id} className="bg-gray-800 rounded p-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{call.caller?.name || 'Caller'}</div>
                    {call.topic && <div className="text-sm text-gray-400">{call.topic}</div>}
                    <div className="text-xs text-gray-500">
                      On air: {minutesConnected} min
                    </div>
                  </div>
                  <button
                    onClick={() => disconnectCall(call.id)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-semibold"
                  >
                    End Call
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Queue - Approved, Waiting to Connect */}
      {queuedNotOnAir.length > 0 && (
        <div className="bg-blue-900/30 border-2 border-blue-500 rounded-lg p-4">
          <h3 className="text-lg font-bold mb-3">
            📋 QUEUE - APPROVED CALLERS ({queuedNotOnAir.length})
          </h3>
          <div className="space-y-2">
            {queuedNotOnAir.map((call, index) => (
              <div key={call.id} className="bg-gray-800 rounded p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <div>
                    <div className="font-semibold">{call.caller?.name || 'Unknown'}</div>
                    {call.topic && <div className="text-sm text-gray-400">{call.topic}</div>}
                  </div>
                </div>
                <button
                  onClick={() => connectToCall(call)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-semibold"
                >
                  Connect
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {queuedNotOnAir.length === 0 && onAirCalls.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-xl mb-2">No callers in queue</p>
          <p className="text-sm">Approved callers will appear here</p>
        </div>
      )}
    </div>
  );
}

