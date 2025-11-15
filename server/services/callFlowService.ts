import { PrismaClient, Call, Prisma, Caller } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import CallFlowStateMachine, {
  CallPhase,
  CallSessionState,
} from './callFlowStateMachine.js';
import LiveKitRoomManager from './livekitRoomManager.js';
import TwilioMediaBridge from './twilioMediaBridge.js';
import { emitToEpisode } from './socketService.js';
import {
  moveParticipantToLiveConference,
  removeFromConference,
} from './conferenceService.js';

export type CallTransitionIntent =
  | 'queue'
  | 'start-screening'
  | 'approve'
  | 'put-on-air'
  | 'put-on-hold'
  | 'return-to-screening'
  | 'complete'
  | 'reject';

export interface ApproveCallPayload {
  screenerNotes?: string | null;
  topic?: string | null;
  priority?: string;
}

export interface CompleteCallPayload {
  recordingUrl?: string | null;
  recordingSid?: string | null;
  duration?: number | null;
  airDuration?: number | null;
}

type CallWithRelations = Call & {
  episode: {
    id: string;
    status: string;
    liveConferenceSid: string | null;
    screeningConferenceSid: string | null;
  };
  caller: Caller;
};

interface CallFlowServiceDeps {
  prisma: PrismaClient;
  stateMachine: CallFlowStateMachine;
  io: SocketIOServer;
  livekit?: LiveKitRoomManager | null;
  mediaBridge?: TwilioMediaBridge | null;
}

export interface TransitionResult {
  call: CallWithRelations;
  session: CallSessionState | null;
  queuePosition?: number;
}

const LIVE_ROOM_PREFIX = 'live';
const SCREENING_ROOM_PREFIX = 'screening';
const LOBBY_ROOM_PREFIX = 'lobby';

export class CallFlowService {
  private readonly prisma: PrismaClient;
  private readonly stateMachine: CallFlowStateMachine;
  private readonly io: SocketIOServer;
  private readonly livekit?: LiveKitRoomManager | null;
  private readonly mediaBridge?: TwilioMediaBridge | null;

  constructor({ prisma, stateMachine, io, livekit, mediaBridge }: CallFlowServiceDeps) {
    this.prisma = prisma;
    this.stateMachine = stateMachine;
    this.io = io;
    this.livekit = livekit ?? null;
    this.mediaBridge = mediaBridge ?? null;
  }

  async registerIncomingCall(callId: string): Promise<TransitionResult> {
    const call = await this.getCall(callId);
    const session = await this.ensureSessionForCall(call, 'incoming', {
      currentRoom: this.buildLobbyRoom(call.episodeId),
      sendMuted: true,
      recvMuted: false,
    });
    this.emitCallUpdated(call, session, { events: ['call:incoming'] });
    return { call, session };
  }

  async queueCall(callId: string): Promise<TransitionResult> {
    const call = await this.updateCall(callId, {
      status: 'queued',
      queuedAt: new Date(),
    });

    const session = await this.ensureSessionForCall(call, 'incoming', {
      currentRoom: this.buildLobbyRoom(call.episodeId),
      sendMuted: true,
      recvMuted: false,
    });

    this.emitCallUpdated(call, session, { events: ['call:queued'] });

    return { call, session };
  }

  async startScreening(callId: string, screenerUserId?: string): Promise<TransitionResult> {
    console.log(`🎬 [CALL-FLOW] startScreening() called for call: ${callId}`);
    
    try {
      const call = await this.updateCall(callId, {
        status: 'screening',
        screenedAt: new Date(),
        screenerUserId: screenerUserId ?? undefined,
        participantState: 'screening',
      });

      console.log(`📝 [CALL-FLOW] Call updated: status=${call.status}, twilioCallSid=${call.twilioCallSid}`);

      const screeningRoom = this.buildScreeningRoom(call.episodeId, call.id);
      console.log(`🏠 [CALL-FLOW] Screening room: ${screeningRoom}`);
      
      const session = await this.transitionSession(call, {
        targetPhase: 'screening',
        currentRoom: screeningRoom,
        sendMuted: false,
        recvMuted: false,
      });

      console.log(`📊 [CALL-FLOW] Session created: phase=${session.phase}, room=${session.currentRoom}`);

      // Move the Twilio media stream to the screening room
      console.log(`🔄 [CALL-FLOW] About to move stream...`);
      console.log(`   mediaBridge exists: ${!!this.mediaBridge}`);
      console.log(`   twilioCallSid: ${call.twilioCallSid}`);
      
      if (this.mediaBridge && call.twilioCallSid) {
        try {
          console.log(`🚀 [CALL-FLOW] Calling moveStreamToRoom(${call.twilioCallSid}, ${screeningRoom})`);
          await this.mediaBridge.moveStreamToRoom(call.twilioCallSid, screeningRoom);
          console.log(`✅ [CALL-FLOW] Moved call ${callId} to screening room: ${screeningRoom}`);
        } catch (error) {
          console.error(`❌ [CALL-FLOW] Failed to move stream to screening room:`, error);
          console.error(`   Error details:`, error);
        }
      } else {
        console.warn(`⚠️ [CALL-FLOW] Cannot move stream - mediaBridge: ${!!this.mediaBridge}, twilioCallSid: ${call.twilioCallSid}`);
      }

      this.emitCallUpdated(call, session, { events: ['call:screening'] });

      return { call, session };
      
    } catch (error) {
      console.error(`❌ [CALL-FLOW] startScreening() FAILED for call ${callId}:`, error);
      console.error(`   Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
      console.error(`   Error message: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.stack) {
        console.error(`   Stack trace:`, error.stack);
      }
      throw error; // Re-throw so the route handler can catch it
    }
  }

  async approveCall(callId: string, payload: ApproveCallPayload = {}): Promise<TransitionResult> {
    const call = await this.getCall(callId);

    const queuePosition = await this.calculateQueuePosition(call);
    const data: Prisma.CallUpdateInput = {
      status: 'approved',
      approvedAt: new Date(),
      screenerNotes: payload.screenerNotes ?? undefined,
      topic: payload.topic ?? undefined,
      priority: payload.priority ?? 'normal',
      participantState: 'hold',
      isMutedInConference: true,
      isOnHold: false,
    };

    const updatedCall = await this.updateCall(callId, data);

    const liveRoom = this.buildLiveRoom(updatedCall.episodeId);
    const session = await this.transitionSession(updatedCall, {
      targetPhase: 'live_muted',
      currentRoom: liveRoom,
      sendMuted: true,
      recvMuted: false,
    });

    // Move the Twilio media stream to the live room
    if (this.mediaBridge && updatedCall.twilioCallSid) {
      try {
        await this.mediaBridge.moveStreamToRoom(updatedCall.twilioCallSid, liveRoom);
        console.log(`✅ [CALL-FLOW] Moved call ${callId} to live room: ${liveRoom}`);
      } catch (error) {
        console.error(`❌ [CALL-FLOW] Failed to move stream to live room:`, error);
      }
    }

    // Move Twilio participant if possible (legacy conference support)
    if (
      updatedCall.twilioCallSid &&
      updatedCall.episode.liveConferenceSid &&
      updatedCall.status === 'approved'
    ) {
      try {
        await moveParticipantToLiveConference(updatedCall.twilioCallSid, updatedCall.episodeId);
      } catch (error) {
        console.error('❌ [CALL-FLOW] Failed to move caller to live conference:', error);
      }
    }

    emitToEpisode(this.io, updatedCall.episodeId, 'participant:state-changed', {
      callId: updatedCall.id,
      state: 'hold',
    });

    this.emitCallUpdated(updatedCall, session, {
      events: ['call:approved'],
      extra: { queuePosition },
    });
    return { call: updatedCall, session, queuePosition };
  }

  async putOnAir(callId: string): Promise<TransitionResult> {
    const call = await this.updateCall(callId, {
      status: 'on-air',
      onAirAt: new Date(),
      participantState: 'on-air',
      isMutedInConference: false,
    });

    const session = await this.transitionSession(call, {
      targetPhase: 'live_on_air',
      currentRoom: this.buildLiveRoom(call.episodeId),
      sendMuted: false,
      recvMuted: false,
    });

    this.emitCallUpdated(call, session, { events: ['call:onair'] });

    return { call, session };
  }

  async putOnHold(callId: string): Promise<TransitionResult> {
    const call = await this.updateCall(callId, {
      status: 'approved',
      participantState: 'hold',
      isMutedInConference: true,
    });

    const session = await this.transitionSession(call, {
      targetPhase: 'live_muted',
      currentRoom: this.buildLiveRoom(call.episodeId),
      sendMuted: true,
      recvMuted: false,
    });

    this.emitCallUpdated(call, session);
    emitToEpisode(this.io, call.episodeId, 'participant:state-changed', {
      callId: call.id,
      state: 'hold',
    });

    return { call, session };
  }

  async returnToScreening(callId: string): Promise<TransitionResult> {
    const call = await this.updateCall(callId, {
      status: 'screening',
      participantState: 'screening',
      isMutedInConference: false,
    });

    const screeningRoom = this.buildScreeningRoom(call.episodeId, call.id);
    const session = await this.transitionSession(call, {
      targetPhase: 'screening',
      currentRoom: screeningRoom,
      sendMuted: false,
      recvMuted: false,
    });

    // Move the Twilio media stream back to the screening room
    if (this.mediaBridge && call.twilioCallSid) {
      try {
        await this.mediaBridge.moveStreamToRoom(call.twilioCallSid, screeningRoom);
        console.log(`✅ [CALL-FLOW] Moved call ${callId} back to screening room: ${screeningRoom}`);
      } catch (error) {
        console.error(`❌ [CALL-FLOW] Failed to move stream back to screening room:`, error);
      }
    }

    this.emitCallUpdated(call, session, { events: ['call:screening'] });
    emitToEpisode(this.io, call.episodeId, 'participant:state-changed', {
      callId: call.id,
      state: 'screening',
    });

    return { call, session };
  }

  async rejectCall(callId: string, reason?: string): Promise<TransitionResult> {
    const call = await this.getCall(callId);

    if (call.twilioCallSid && call.twilioCallSid.startsWith('CA')) {
      try {
        const { endCall } = await import('./twilioService.js');
        await endCall(call.twilioCallSid);
      } catch (error) {
        console.error('⚠️ [CALL-FLOW] Error ending Twilio call:', error);
      }
    }

    const updatedCall = await this.updateCall(callId, {
      status: 'rejected',
      endedAt: new Date(),
      screenerNotes: reason ?? undefined,
    });

    const session = await this.transitionSession(updatedCall, {
      targetPhase: 'disconnected',
    });

    this.emitCallUpdated(updatedCall, session, { events: ['call:rejected'] });

    return { call: updatedCall, session };
  }

  async completeCall(callId: string, payload: CompleteCallPayload = {}): Promise<TransitionResult> {
    const call = await this.getCall(callId);

    if (call.twilioConferenceSid && call.twilioCallSid) {
      try {
        await removeFromConference(call.twilioCallSid, call.episodeId);
      } catch (error) {
        console.error('⚠️ [CALL-FLOW] Error removing caller from conference:', error);
        await this.endTwilioCallDirectly(call.twilioCallSid);
      }
    } else if (call.twilioCallSid && call.twilioCallSid.startsWith('CA')) {
      await this.endTwilioCallDirectly(call.twilioCallSid);
    }

    const queueDuration =
      call.queuedAt && call.onAirAt
        ? Math.floor((call.onAirAt.getTime() - call.queuedAt.getTime()) / 1000)
        : null;

    const calculatedAirDuration =
      call.onAirAt !== null ? Math.floor((Date.now() - call.onAirAt.getTime()) / 1000) : null;

    const updatedCall = await this.updateCall(callId, {
      status: 'completed',
      endedAt: new Date(),
      recordingUrl: payload.recordingUrl ?? undefined,
      recordingSid: payload.recordingSid ?? undefined,
      totalDuration: payload.duration ?? undefined,
      airDuration: payload.airDuration ?? calculatedAirDuration ?? payload.duration ?? undefined,
      queueDuration: queueDuration ?? undefined,
    });

    await this.prisma.caller.update({
      where: { id: updatedCall.callerId },
      data: {
        lastCallDate: new Date(),
        totalCalls: {
          increment: 1,
        },
      },
    });

    const session = await this.stateMachine.complete(updatedCall.id);

    this.emitCallUpdated(updatedCall, session, { events: ['call:completed'] });

    return {
      call: updatedCall,
      session: session ?? null,
    };
  }

  private async transitionSession(
    call: CallWithRelations,
    update: {
      targetPhase: CallPhase;
      currentRoom?: string;
      sendMuted?: boolean;
      recvMuted?: boolean;
      twilioStreamSid?: string | null;
      livekitParticipantId?: string | null;
      metadata?: Record<string, unknown> | null;
    },
  ): Promise<CallSessionState> {
    const session = await this.ensureSessionForCall(call);
    if (session.phase === update.targetPhase) {
      return this.stateMachine.patch(call.id, {
        currentRoom: update.currentRoom,
        sendMuted: update.sendMuted,
        recvMuted: update.recvMuted,
        twilioStreamSid: update.twilioStreamSid,
        livekitParticipantId: update.livekitParticipantId,
        metadata: update.metadata,
      });
    }

    return this.stateMachine.transition(call.id, {
      targetPhase: update.targetPhase,
      currentRoom: update.currentRoom,
      sendMuted: update.sendMuted,
      recvMuted: update.recvMuted,
      twilioStreamSid: update.twilioStreamSid,
      livekitParticipantId: update.livekitParticipantId,
      metadata: update.metadata,
    });
  }

  private emitCallUpdated(
    call: CallWithRelations,
    session: CallSessionState | null,
    options: { events?: string[]; extra?: Record<string, unknown> } = {},
  ): void {
    const payload = {
      id: call.id,
      callId: call.id,
      call,
      session,
      ...(options.extra ?? {}),
    };

    const events = new Set<string>(['call:updated', ...(options.events ?? [])]);
    for (const event of events) {
      emitToEpisode(this.io, call.episodeId, event, payload);
    }
  }

  private async ensureSessionForCall(
    call: CallWithRelations,
    defaultPhase?: CallPhase,
    overrides?: {
      currentRoom?: string;
      twilioStreamSid?: string | null;
      livekitParticipantId?: string | null;
      sendMuted?: boolean;
      recvMuted?: boolean;
      metadata?: Record<string, unknown> | null;
    },
  ): Promise<CallSessionState> {
    const existing = this.stateMachine.getSession(call.id);
    if (existing) {
      return existing;
    }

    const initialPhase = defaultPhase ?? this.mapCallStatusToPhase(call.status);
    const currentRoom =
      overrides?.currentRoom ?? this.buildRoomForPhase(call.episodeId, call.id, initialPhase);

    return this.stateMachine.createSession({
      callId: call.id,
      initialPhase,
      currentRoom,
      twilioCallSid: call.twilioCallSid,
      twilioStreamSid: overrides?.twilioStreamSid ?? null,
      livekitParticipantId: overrides?.livekitParticipantId ?? null,
      sendMuted: overrides?.sendMuted,
      recvMuted: overrides?.recvMuted,
      metadata: overrides?.metadata,
    });
  }

  private async getCall(callId: string): Promise<CallWithRelations> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: {
        episode: true,
        caller: true,
      },
    });

    if (!call) {
      throw new Error(`Call not found: ${callId}`);
    }

    return call;
  }

  private async updateCall(
    callId: string,
    data: Prisma.CallUpdateInput,
  ): Promise<CallWithRelations> {
    const call = await this.prisma.call.update({
      where: { id: callId },
      data,
      include: { episode: true, caller: true },
    });

    return call;
  }

  private buildScreeningRoom(episodeId: string, callId: string): string {
    return `${SCREENING_ROOM_PREFIX}-${episodeId}-${callId}`;
  }

  private buildLiveRoom(episodeId: string): string {
    return `${LIVE_ROOM_PREFIX}-${episodeId}`;
  }

  private buildLobbyRoom(episodeId: string): string {
    return `${LOBBY_ROOM_PREFIX}-${episodeId}`;
  }

  private buildRoomForPhase(episodeId: string, callId: string, phase: CallPhase): string {
    switch (phase) {
      case 'screening':
        return this.buildScreeningRoom(episodeId, callId);
      case 'live_muted':
      case 'live_on_air':
        return this.buildLiveRoom(episodeId);
      default:
        return this.buildLobbyRoom(episodeId);
    }
  }

  private mapCallStatusToPhase(status: string): CallPhase {
    switch (status) {
      case 'screening':
        return 'screening';
      case 'approved':
        return 'live_muted';
      case 'on-air':
        return 'live_on_air';
      case 'completed':
      case 'rejected':
      case 'missed':
        return 'disconnected';
      default:
        return 'incoming';
    }
  }

  private async calculateQueuePosition(call: CallWithRelations): Promise<number> {
    const approvedCalls = await this.prisma.call.findMany({
      where: {
        episodeId: call.episodeId,
        status: 'approved',
        endedAt: null,
        onAirAt: null,
      },
      orderBy: { approvedAt: 'asc' },
    });

    const onAirCalls = await this.prisma.call.count({
      where: {
        episodeId: call.episodeId,
        status: 'on-air',
        endedAt: null,
      },
    });

    const queuePosition = approvedCalls.length + 1 - onAirCalls;
    return Math.max(1, queuePosition);
  }

  private async endTwilioCallDirectly(twilioCallSid: string): Promise<void> {
    try {
      const { endCall } = await import('./twilioService.js');
      await endCall(twilioCallSid);
      console.log('📴 [CALL-FLOW] Ended Twilio call directly:', twilioCallSid);
    } catch (error) {
      console.error('⚠️ [CALL-FLOW] Error ending Twilio call directly:', error);
    }
  }
}

export default CallFlowService;

