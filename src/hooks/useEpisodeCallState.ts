import { useCallback, useEffect, useMemo, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export type CallPhase = 'incoming' | 'screening' | 'live_muted' | 'live_on_air' | 'disconnected';

export interface CallSessionSnapshot {
  callId: string;
  phase: CallPhase;
  currentRoom: string;
  sendMuted: boolean;
  recvMuted: boolean;
  twilioCallSid?: string;
  twilioStreamSid?: string | null;
  livekitParticipantId?: string | null;
  lastTransitionAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CallSnapshot {
  call: any;
  session: CallSessionSnapshot | null;
}

export interface CallBuckets {
  incoming: CallSnapshot[];
  screening: CallSnapshot[];
  liveMuted: CallSnapshot[];
  liveOnAir: CallSnapshot[];
}

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolvePhaseFromStatus = (status: string | undefined): CallPhase => {
  switch ((status || '').toLowerCase()) {
    case 'screening':
      return 'screening';
    case 'approved':
    case 'hold':
    case 'queued':
      return 'live_muted';
    case 'on-air':
      return 'live_on_air';
    default:
      return 'incoming';
  }
};

const normalizeCallSnapshot = (rawCall: any, rawSession?: any | null): CallSnapshot => {
  if (!rawCall) {
    return { call: null, session: null };
  }

  const { session: sessionFromCall, ...callData } = rawCall;
  const call = {
    ...callData,
    incomingAt: toDate(callData.incomingAt),
    queuedAt: toDate(callData.queuedAt),
    screenedAt: toDate(callData.screenedAt),
    approvedAt: toDate(callData.approvedAt),
    onAirAt: toDate(callData.onAirAt),
    endedAt: toDate(callData.endedAt),
    createdAt: toDate(callData.createdAt),
    updatedAt: toDate(callData.updatedAt),
  };

  const sessionSource = rawSession ?? sessionFromCall ?? null;
  let session: CallSessionSnapshot | null = null;

  if (sessionSource) {
    session = {
      callId: sessionSource.callId ?? call.id,
      phase: sessionSource.phase as CallPhase,
      currentRoom: sessionSource.currentRoom,
      sendMuted: Boolean(sessionSource.sendMuted),
      recvMuted: Boolean(sessionSource.recvMuted),
      twilioCallSid: sessionSource.twilioCallSid ?? call.twilioCallSid,
      twilioStreamSid: sessionSource.twilioStreamSid ?? null,
      livekitParticipantId: sessionSource.livekitParticipantId ?? null,
      lastTransitionAt: toDate(sessionSource.lastTransitionAt) ?? new Date(),
      createdAt: toDate(sessionSource.createdAt) ?? new Date(),
      updatedAt: toDate(sessionSource.updatedAt) ?? new Date(),
    };
  }

  return { call, session };
};

const shouldTrackCall = (snapshot: CallSnapshot): boolean => {
  if (!snapshot.call) return false;
  const status = (snapshot.call.status || '').toLowerCase();
  if (['completed', 'rejected', 'missed'].includes(status)) {
    return false;
  }
  if (snapshot.session?.phase === 'disconnected') {
    return false;
  }
  return true;
};

const resolvePhase = (snapshot: CallSnapshot): CallPhase => {
  if (snapshot.session) {
    return snapshot.session.phase;
  }
  return resolvePhaseFromStatus(snapshot.call?.status);
};

const buildCallMap = (rawCalls: any[]): Map<string, CallSnapshot> => {
  const map = new Map<string, CallSnapshot>();
  rawCalls.forEach((rawCall) => {
    const snapshot = normalizeCallSnapshot(rawCall, rawCall?.session ?? null);
    if (snapshot.call?.id && shouldTrackCall(snapshot)) {
      map.set(snapshot.call.id, snapshot);
    }
  });
  return map;
};

const createEmptyBuckets = (): CallBuckets => ({
  incoming: [],
  screening: [],
  liveMuted: [],
  liveOnAir: [],
});

export const useEpisodeCallState = (episodeId: string | null) => {
  const [callMap, setCallMap] = useState<Map<string, CallSnapshot>>(new Map());
  const [loading, setLoading] = useState(false);

  const applyCallData = useCallback((rawCalls: any[]) => {
    setCallMap(buildCallMap(rawCalls));
  }, []);

  const refresh = useCallback(async () => {
    if (!episodeId) {
      setCallMap(new Map());
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/calls?episodeId=${episodeId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch calls');
      }
      const data = await response.json();
      applyCallData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to refresh calls:', error);
    } finally {
      setLoading(false);
    }
  }, [episodeId, applyCallData]);

  const handleCallUpdated = useCallback((payload: any) => {
    const rawCall = payload?.call ?? payload;
    const rawSession = payload?.session ?? payload?.call?.session ?? null;
    if (!rawCall) return;

    setCallMap((prev) => {
      const next = new Map(prev);
      const snapshot = normalizeCallSnapshot(rawCall, rawSession);
      if (snapshot.call?.id && shouldTrackCall(snapshot)) {
        next.set(snapshot.call.id, snapshot);
      } else if (snapshot.call?.id) {
        next.delete(snapshot.call.id);
      }
      return next;
    });
  }, []);

  const handleCallRemoved = useCallback((payload: any) => {
    const id = payload?.id ?? payload?.callId ?? payload?.call?.id;
    if (!id) return;

    setCallMap((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!episodeId) return;

    const socket: Socket = io();
    socket.emit('join:episode', episodeId);

    socket.on('call:updated', handleCallUpdated);
    socket.on('call:completed', handleCallRemoved);
    socket.on('call:rejected', handleCallRemoved);
    socket.on('call:incoming', handleCallUpdated);
    socket.on('call:queued', handleCallUpdated);
    socket.on('call:screening', handleCallUpdated);
    socket.on('call:approved', handleCallUpdated);
    socket.on('call:onair', handleCallUpdated);

    return () => {
      socket.off('call:updated', handleCallUpdated);
      socket.off('call:completed', handleCallRemoved);
      socket.off('call:rejected', handleCallRemoved);
      socket.off('call:incoming', handleCallUpdated);
      socket.off('call:queued', handleCallUpdated);
      socket.off('call:screening', handleCallUpdated);
      socket.off('call:approved', handleCallUpdated);
      socket.off('call:onair', handleCallUpdated);
      socket.close();
    };
  }, [episodeId, handleCallUpdated, handleCallRemoved]);

  const callList = useMemo(() => {
    return Array.from(callMap.values()).sort((a, b) => {
      const aTime = toDate(a.call?.incomingAt)?.getTime() ?? 0;
      const bTime = toDate(b.call?.incomingAt)?.getTime() ?? 0;
      return bTime - aTime;
    });
  }, [callMap]);

  const buckets = useMemo<CallBuckets>(() => {
    const grouped = createEmptyBuckets();
    callList.forEach((snapshot) => {
      const phase = resolvePhase(snapshot);
      switch (phase) {
        case 'screening':
          grouped.screening.push(snapshot);
          break;
        case 'live_muted':
          grouped.liveMuted.push(snapshot);
          break;
        case 'live_on_air':
          grouped.liveOnAir.push(snapshot);
          break;
        default:
          grouped.incoming.push(snapshot);
          break;
      }
    });
    return grouped;
  }, [callList]);

  return {
    loading,
    callMap,
    callList,
    buckets,
    refresh,
  } as const;
};
