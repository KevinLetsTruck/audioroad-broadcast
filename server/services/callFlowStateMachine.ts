import { EventEmitter } from 'events';
import {
  PrismaClient,
  Prisma,
  CallPhase as PrismaCallPhase,
  CallSession as PrismaCallSession,
} from '@prisma/client';

export const CALL_PHASES = [
  'incoming',
  'screening',
  'live_muted',
  'live_on_air',
  'disconnected',
] as const;

export type CallPhase = (typeof CALL_PHASES)[number];

export const CALL_PHASE_TRANSITIONS: Record<CallPhase, CallPhase[]> = {
  incoming: ['screening', 'disconnected'],
  screening: ['live_muted', 'disconnected'],
  live_muted: ['live_on_air', 'screening', 'disconnected'],
  live_on_air: ['live_muted', 'disconnected'],
  disconnected: [],
};

export interface CallSessionState {
  sessionId: string;
  callId: string;
  phase: CallPhase;
  currentRoom: string;
  twilioCallSid: string;
  twilioStreamSid?: string | null;
  livekitParticipantId?: string | null;
  sendMuted: boolean;
  recvMuted: boolean;
  metadata?: Record<string, unknown> | null;
  lastTransitionAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCallSessionInput {
  callId: string;
  initialPhase?: CallPhase;
  currentRoom: string;
  twilioCallSid: string;
  twilioStreamSid?: string | null;
  livekitParticipantId?: string | null;
  sendMuted?: boolean;
  recvMuted?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface TransitionUpdate {
  targetPhase: CallPhase;
  currentRoom?: string;
  twilioStreamSid?: string | null;
  livekitParticipantId?: string | null;
  sendMuted?: boolean;
  recvMuted?: boolean;
  metadata?: Record<string, unknown> | null;
}

const toJsonInput = (
  value?: Record<string, unknown> | null,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.JsonNull;
  }
  return value as Prisma.JsonObject;
};

export class CallFlowStateMachine extends EventEmitter {
  private readonly prisma: PrismaClient;
  private readonly sessions = new Map<string, CallSessionState>();
  private initialized = false;

  constructor(prisma: PrismaClient) {
    super();
    this.prisma = prisma;
  }

  /**
   * Load all existing call sessions from the database into memory.
   * Should be invoked during server startup.
   */
  async initialize(): Promise<number> {
    const records = await this.prisma.callSession.findMany();
    this.sessions.clear();

    for (const record of records) {
      const normalized = this.normalize(record);
      this.sessions.set(normalized.callId, normalized);
    }

    this.initialized = true;
    const count = this.sessions.size;
    this.emit('initialized', { count });
    return count;
  }

  /**
   * Retrieve a call session by call ID.
   */
  getSession(callId: string): CallSessionState | undefined {
    return this.sessions.get(callId);
  }

  /**
   * Return all active sessions currently tracked in memory.
   */
  listSessions(): CallSessionState[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Create a new call session. Persists to the database and caches in memory.
   */
  async createSession(input: CreateCallSessionInput): Promise<CallSessionState> {
    const phase = input.initialPhase ?? 'incoming';

    const record = await this.prisma.callSession.create({
      data: {
        callId: input.callId,
        phase: phase as PrismaCallPhase,
        currentRoom: input.currentRoom,
        twilioCallSid: input.twilioCallSid,
        twilioStreamSid: input.twilioStreamSid,
        livekitParticipantId: input.livekitParticipantId,
        sendMuted: input.sendMuted ?? true,
        recvMuted: input.recvMuted ?? false,
        metadata: toJsonInput(input.metadata),
      },
    });

    const normalized = this.normalize(record);
    this.sessions.set(normalized.callId, normalized);
    this.emit('session-created', normalized);

    return normalized;
  }

  /**
   * Upsert helper used when session may already exist.
   */
  async ensureSession(input: CreateCallSessionInput): Promise<CallSessionState> {
    const existing = this.getSession(input.callId);
    if (existing) {
      return existing;
    }
    return this.createSession(input);
  }

  /**
   * Validate whether a phase transition is allowed according to the state graph.
   */
  isTransitionAllowed(from: CallPhase, to: CallPhase): boolean {
    const allowed = CALL_PHASE_TRANSITIONS[from] ?? [];
    return allowed.includes(to);
  }

  /**
   * Apply a phase transition and persist changes. Throws if transition is invalid.
   */
  async transition(callId: string, update: TransitionUpdate): Promise<CallSessionState> {
    const session = this.sessions.get(callId);

    if (!session) {
      throw new Error(`CallSession not found for callId=${callId}`);
    }

    if (!this.isTransitionAllowed(session.phase, update.targetPhase)) {
      throw new Error(
        `Invalid call phase transition: ${session.phase} → ${update.targetPhase}`,
      );
    }

    const record = await this.prisma.callSession.update({
      where: { callId },
      data: {
        phase: update.targetPhase as PrismaCallPhase,
        currentRoom: update.currentRoom ?? session.currentRoom,
        twilioStreamSid: update.twilioStreamSid ?? session.twilioStreamSid ?? undefined,
        livekitParticipantId:
          update.livekitParticipantId ?? session.livekitParticipantId ?? undefined,
        sendMuted: update.sendMuted ?? session.sendMuted,
        recvMuted: update.recvMuted ?? session.recvMuted,
        metadata: toJsonInput(update.metadata ?? session.metadata ?? undefined),
        lastTransitionAt: new Date(),
      },
    });

    const normalized = this.normalize(record);
    this.sessions.set(callId, normalized);

    this.emit('session-updated', {
      callId,
      from: session.phase,
      to: normalized.phase,
      state: normalized,
    });

    return normalized;
  }

  /**
   * Update non-phase fields on the session without enforcing transitions.
   */
  async patch(callId: string, data: Partial<Omit<TransitionUpdate, 'targetPhase'>>): Promise<CallSessionState> {
    const session = this.sessions.get(callId);

    if (!session) {
      throw new Error(`CallSession not found for callId=${callId}`);
    }

    const record = await this.prisma.callSession.update({
      where: { callId },
      data: {
        currentRoom: data.currentRoom ?? session.currentRoom,
        twilioStreamSid: data.twilioStreamSid ?? session.twilioStreamSid ?? undefined,
        livekitParticipantId:
          data.livekitParticipantId ?? session.livekitParticipantId ?? undefined,
        sendMuted: data.sendMuted ?? session.sendMuted,
        recvMuted: data.recvMuted ?? session.recvMuted,
        metadata: toJsonInput(data.metadata ?? session.metadata ?? undefined),
      },
    });

    const normalized = this.normalize(record);
    this.sessions.set(callId, normalized);
    this.emit('session-updated', { callId, from: session.phase, to: session.phase, state: normalized });

    return normalized;
  }

  /**
   * Remove a session from memory and mark as disconnected.
   */
  async complete(callId: string): Promise<CallSessionState | null> {
    let record: PrismaCallSession | null = null;
    try {
      record = await this.prisma.callSession.update({
        where: { callId },
        data: {
          phase: 'disconnected',
          lastTransitionAt: new Date(),
        },
      });
    } catch (error) {
      // Record may already be gone (call finalized earlier)
      record = await this.prisma.callSession.findUnique({
        where: { callId },
      });
    }

    if (!record) {
      this.sessions.delete(callId);
      return null;
    }

    const normalized = this.normalize(record);
    this.sessions.delete(callId);
    this.emit('session-removed', { callId, previous: normalized });
    return normalized;
  }

  /**
   * Ensure initialize() was called before using the state machine.
   */
  assertInitialized(): void {
    if (!this.initialized) {
      throw new Error('CallFlowStateMachine not initialized. Call initialize() first.');
    }
  }

  private normalize(record: PrismaCallSession): CallSessionState {
    const metadataValue = record.metadata;
    let metadata: Record<string, unknown> | undefined;
    if (metadataValue && typeof metadataValue === 'object' && !Array.isArray(metadataValue)) {
      metadata = metadataValue as Record<string, unknown>;
    }

    return {
      sessionId: record.id,
      callId: record.callId,
      phase: record.phase as CallPhase,
      currentRoom: record.currentRoom,
      twilioCallSid: record.twilioCallSid,
      twilioStreamSid: record.twilioStreamSid ?? undefined,
      livekitParticipantId: record.livekitParticipantId ?? undefined,
      sendMuted: record.sendMuted,
      recvMuted: record.recvMuted,
      metadata,
      lastTransitionAt: record.lastTransitionAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

export default CallFlowStateMachine;

