/**
 * Participant Board
 * 
 * Shows all active participants grouped by state (ON AIR, ON HOLD, SCREENING)
 * Allows host to control who's broadcasting
 */

import { useState } from 'react';
import { useBroadcast } from '../contexts/BroadcastContext';
import { CallBuckets, CallSnapshot } from '../hooks/useEpisodeCallState';

interface ParticipantBoardProps {
  episodeId: string;
  callBuckets: CallBuckets;
  refreshCalls: () => Promise<void>;
}

export default function ParticipantBoard({ episodeId, callBuckets, refreshCalls }: ParticipantBoardProps) {
  const broadcast = useBroadcast();
  const [actionInProgress, setActionInProgress] = useState(false);

  const handleAction = async (action: () => Promise<void>) => {
    setActionInProgress(true);
    try {
      await action();
      await refreshCalls();
    } finally {
      setActionInProgress(false);
    }
  };

  const findSnapshot = (callId: string): CallSnapshot | undefined => {
    return [...callBuckets.liveOnAir, ...callBuckets.liveMuted, ...callBuckets.screening].find(
      (snapshot) => snapshot.call?.id === callId,
    );
  };

  const putOnAir = async (callId: string) => {
    await handleAction(async () => {
      const snapshot = findSnapshot(callId);
      const call = snapshot?.call;
      const callerName = call?.caller?.name || 'Caller';

      // Check if host needs to connect (only for Twilio Device mode)
      if (!broadcast.useWebRTC) {
        const hostNeedsConnection =
          !broadcast.twilioDevice ||
          broadcast.activeCalls.size === 0 ||
          !Array.from(broadcast.activeCalls.values()).some(
            (activeCall) => activeCall.twilioCall && activeCall.twilioCall.status() !== 'closed',
          );

        if (hostNeedsConnection) {
          if (!broadcast.twilioDevice) {
            throw new Error('Twilio device not initialized. Start the show first.');
          }
          await broadcast.connectToCall(callId, callerName, episodeId, 'host');
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } else {
        // WebRTC mode: No pre-check needed
        // The host should have joined the live room, and the server will handle the state transition
        console.log('🎤 [ON-AIR] WebRTC mode - sending on-air request to server');
      }

      const response = await fetch(`/api/participants/${callId}/on-air`, { method: 'PATCH' });
      if (!response.ok) {
        throw new Error('Failed to put participant on air');
      }
    });
  };

  const putOnHold = async (callId: string) => {
    await handleAction(async () => {
      const response = await fetch(`/api/participants/${callId}/hold`, { method: 'PATCH' });
      if (!response.ok) {
        throw new Error('Failed to move participant to hold');
      }
    });
  };

  const moveToScreening = async (callId: string) => {
    await handleAction(async () => {
      const response = await fetch(`/api/participants/${callId}/screening`, { method: 'PATCH' });
      if (!response.ok) {
        throw new Error('Failed to move participant to screening');
      }
    });
  };

  const muteParticipant = async (callId: string, muted: boolean) => {
    await handleAction(async () => {
      const endpoint = muted ? 'mute' : 'unmute';
      const response = await fetch(`/api/participants/${callId}/${endpoint}`, { method: 'PATCH' });
      if (!response.ok) {
        throw new Error('Failed to toggle mute');
      }
    });
  };

  const endCall = async (callId: string) => {
    await handleAction(async () => {
      const response = await fetch(`/api/calls/${callId}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ airDuration: 0 }),
      });
      if (!response.ok) {
        throw new Error('Failed to complete call');
      }
    });
  };

  const renderParticipantCard = (snapshot: CallSnapshot, actions: React.ReactNode) => {
    const call = snapshot.call;
    if (!call) return null;
    const session = snapshot.session;
    const phaseLabel = session?.phase?.replace(/_/g, ' ').toUpperCase();

    return (
      <div key={call.id} className="bg-gray-800 rounded p-3 flex items-center justify-between">
        <div className="flex-1">
          <div className="font-semibold text-white">{call.caller?.name || 'Unknown Caller'}</div>
          <div className="text-xs text-gray-400">
            {call.caller?.location ? call.caller.location : 'Location unknown'}
          </div>
          {call.topic && <div className="text-xs text-gray-300 mt-1">Topic: {call.topic}</div>}
          <div className="text-xs text-blue-300 mt-1 flex flex-col gap-1">
            {phaseLabel && <span>Phase: {phaseLabel}</span>}
            {session?.currentRoom && <span>Room: {session.currentRoom}</span>}
            <span>
              Send Muted: {session?.sendMuted ? 'Yes' : 'No'} | Recv Muted:{' '}
              {session?.recvMuted ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
    );
  };

  const renderOnAirSection = () => {
    const snapshots = callBuckets.liveOnAir;
    return (
      <div className="bg-red-900/30 border-2 border-red-500 rounded-lg p-4">
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
          ON AIR ({snapshots.length})
        </h3>
        {snapshots.length === 0 ? (
          <p className="text-sm text-gray-400">No participants on air</p>
        ) : (
          <div className="space-y-2">
            {snapshots.map((snapshot) =>
              renderParticipantCard(
                snapshot,
                <>
                  <button
                    onClick={() => muteParticipant(snapshot.call.id, false)}
                    disabled={actionInProgress || !snapshot.call.isMutedInConference}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-semibold disabled:opacity-50"
                  >
                    🔊 Unmute
                  </button>
                  <button
                    onClick={() => muteParticipant(snapshot.call.id, true)}
                    disabled={actionInProgress || snapshot.call.isMutedInConference}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs font-semibold disabled:opacity-50"
                  >
                    🔇 Mute
                  </button>
                  <button
                    onClick={() => putOnHold(snapshot.call.id)}
                    disabled={actionInProgress}
                    className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs font-semibold disabled:opacity-50"
                  >
                    ⏸️ Hold
                  </button>
                  <button
                    onClick={() => endCall(snapshot.call.id)}
                    disabled={actionInProgress}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-semibold disabled:opacity-50"
                  >
                    End
                  </button>
                </>,
              ),
            )}
          </div>
        )}
      </div>
    );
  };

  const renderOnHoldSection = () => {
    const snapshots = callBuckets.liveMuted;
    return (
      <div className="bg-yellow-900/30 border-2 border-yellow-600 rounded-lg p-4">
        <h3 className="text-lg font-bold mb-3">⏸️ ON HOLD ({snapshots.length})</h3>
        {snapshots.length === 0 ? (
          <p className="text-sm text-gray-400">No participants on hold</p>
        ) : (
          <div className="space-y-2">
            {snapshots.map((snapshot) =>
              renderParticipantCard(
                snapshot,
                <>
                  <button
                    onClick={() => putOnAir(snapshot.call.id)}
                    disabled={actionInProgress}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-semibold disabled:opacity-50"
                  >
                    📡 On Air
                  </button>
                  <button
                    onClick={() => moveToScreening(snapshot.call.id)}
                    disabled={actionInProgress}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-semibold disabled:opacity-50"
                  >
                    Screen
                  </button>
                  <button
                    onClick={() => endCall(snapshot.call.id)}
                    disabled={actionInProgress}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-semibold disabled:opacity-50"
                  >
                    End
                  </button>
                </>,
              ),
            )}
          </div>
        )}
      </div>
    );
  };

  const renderScreeningSection = () => {
    const snapshots = callBuckets.screening;
    return (
      <div className="bg-blue-900/30 border-2 border-blue-500 rounded-lg p-4">
        <h3 className="text-lg font-bold mb-3">🔍 SCREENING ({snapshots.length})</h3>
        {snapshots.length === 0 ? (
          <p className="text-sm text-gray-400">No calls being screened</p>
        ) : (
          <div className="space-y-2">
            {snapshots.map((snapshot) =>
              renderParticipantCard(
                snapshot,
                <>
                  <button
                    onClick={() => putOnHold(snapshot.call.id)}
                    disabled={actionInProgress}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-semibold disabled:opacity-50"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => endCall(snapshot.call.id)}
                    disabled={actionInProgress}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-semibold disabled:opacity-50"
                  >
                    ✗ Reject
                  </button>
                </>,
              ),
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {renderOnAirSection()}
      {renderOnHoldSection()}
      {renderScreeningSection()}
    </div>
  );
}

