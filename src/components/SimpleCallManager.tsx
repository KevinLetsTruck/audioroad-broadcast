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
        // Subsequent participants: They're already in conference (from caller side)
        // Just unmute them in Twilio
        console.log('📡 [MULTI] Additional participant - unmuting in conference:', callerName);
        
        try {
          const response = await fetch(`/api/participants/${call.id}/on-air`, { method: 'PATCH' });
          if (response.ok) {
            console.log('✅ [MULTI] Participant unmuted:', callerName);
            
            // Add to local tracking (simulate connected state)
            broadcast.activeCalls.set(call.id, {
              id: `call-${call.id}`,
              callId: call.id,
              callerName,
              topic: call.topic,
              twilioCall: null,
              audioStream: null,
              isOnAir: true,
              connectedAt: new Date()
            });
          } else {
            throw new Error('Failed to unmute participant');
          }
        } catch (err) {
          console.error('Failed to add participant:', err);
          alert('Failed to add participant to conference');
        }
      }
      
      fetchQueue();
    } catch (error) {
      console.error('Failed to connect:', error);
      alert('Failed to connect to participant');
    }
  };

  const disconnectCall = async (callId: string) => {
    try {
      console.log('📴 [MULTI] Disconnecting participant:', callId);
      
      // If this is the LAST active call, disconnect host too
      if (broadcast.activeCalls.size === 1) {
        console.log('📴 [MULTI] Last participant - disconnecting host from conference');
        await broadcast.disconnectCall(callId);
      } else {
        // Multiple participants - just mute/remove this one
        console.log('⏸️ [MULTI] Other participants still active - muting this one');
        
        // Mute them in Twilio
        await fetch(`/api/participants/${callId}/hold`, { method: 'PATCH' });
        
        // Remove from active calls
        broadcast.activeCalls.delete(callId);
      }
      
      // Mark as completed in database
      await fetch(`/api/calls/${callId}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ airDuration: 0 })
      });
      
      console.log('✅ [MULTI] Participant disconnected');
      fetchQueue();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  // Get calls that are NOT yet connected
  const queue = queuedCalls.filter(c => !broadcast.activeCalls.has(c.id));
  
  // Get active calls as array
  const activeCallsArray = Array.from(broadcast.activeCalls.values());

  return (
    <div className="space-y-4">
      {/* Active Calls - Currently Broadcasting */}
      {activeCallsArray.length > 0 && (
        <div className="bg-red-900/30 border-2 border-red-500 rounded-lg p-4">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
            🎙️ ACTIVE - ON AIR ({activeCallsArray.length})
          </h3>
          <div className="space-y-2">
            {activeCallsArray.map((call) => (
              <div key={call.callId} className="bg-gray-800 rounded p-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{call.callerName}</div>
                  {call.topic && <div className="text-sm text-gray-400">{call.topic}</div>}
                  <div className="text-xs text-gray-500">
                    Connected: {Math.floor((Date.now() - call.connectedAt.getTime()) / 1000 / 60)} min
                  </div>
                </div>
                <button
                  onClick={() => disconnectCall(call.callId)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-semibold"
                >
                  End Call
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Queue - Approved, Waiting to Connect */}
      {queue.length > 0 && (
        <div className="bg-blue-900/30 border-2 border-blue-500 rounded-lg p-4">
          <h3 className="text-lg font-bold mb-3">
            📋 QUEUE - APPROVED CALLERS ({queue.length})
          </h3>
          <div className="space-y-2">
            {queue.map((call, index) => (
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
      {queue.length === 0 && activeCallsArray.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-xl mb-2">No callers in queue</p>
          <p className="text-sm">Approved callers will appear here</p>
        </div>
      )}
    </div>
  );
}

