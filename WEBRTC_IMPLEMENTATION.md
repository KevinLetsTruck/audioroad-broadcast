# WebRTC Broadcast System Implementation

**Started:** November 12, 2025  
**Status:** Phase 1 - Infrastructure Setup (In Progress)  
**Timeline:** 3 weeks total

---

## What We're Building

A production-grade WebRTC broadcast system that replaces Twilio conferences with full audio routing control.

### Why This Solves The Problem

**Twilio Limitation:** Participants are locked in conferences via TwiML. Moving between conferences requires hanging up and calling back.

**WebRTC Solution:** Participants join audio "rooms" that we fully control. Can move between rooms instantly, toggle mute/unmute infinitely, no call interruption.

---

## Architecture Overview

```
Phone Call → Twilio Phone Number
           ↓
    Twilio Media Streams (WebSocket)
           ↓
    Media Bridge (converts muLaw ↔ RTP)
           ↓
    Janus Gateway (SFU - routes audio)
           ↓
    WebRTC Connections (browser/guests)
```

### Three Audio Rooms

**1. Screening Room (`screening-{episodeId}`)**
- Screener (WebRTC from browser)
- ONE caller at a time (bridged from phone)
- Private, isolated from live room

**2. Live Room (`live-{episodeId}`)**
- Host (WebRTC from browser)
- On-air callers (send + receive audio)
- Approved callers waiting (receive only, send muted)
- Guests (WebRTC from browser)

**3. Technical: No separate "hold" room**
- "Hold" = participant in Live Room with send muted
- They hear host + show but cannot talk

---

## Phase 1: Infrastructure (Days 1-2) ✅ IN PROGRESS

### What's Been Created

**Server-side:**
- `server/services/janusGateway.ts` - Janus WebSocket client
- `server/services/webrtcRoomManager.ts` - Room management API
- `server/services/twilioMediaBridge.ts` - PSTN ↔ WebRTC bridge

**Docker:**
- `janus/Dockerfile` - Janus Gateway container
- `janus/config/janus.jcfg` - Janus configuration
- `docker-compose.janus.yml` - Local development setup

### What's Needed Next

1. **Deploy Janus to Railway/Render**
   - Create separate service for Janus
   - Configure public IP and ports
   - Get WebSocket URL (wss://janus.yourapp.com)

2. **Complete Media Bridge**
   - muLaw ↔ PCM conversion
   - RTP packet handling
   - Jitter buffer implementation

3. **Create Media Stream endpoint**
   - `/api/twilio/media-stream` - WebSocket endpoint
   - Twilio calls this for each phone call
   - Routes to Media Bridge

4. **Test Janus connection**
   - Server connects to Janus on startup
   - Creates test room
   - Verifies WebSocket stability

---

## Phase 2: Host Connection (Day 3)

### What Needs to Be Built

**Browser-side WebRTC client:**
- `src/services/webrtcClient.ts`
- `src/services/janusClient.ts`  
- Replaces Twilio Device SDK for host

**Context integration:**
- Modify `BroadcastContext.tsx`
- Add WebRTC state management
- Keep mixer for recording

**What this achieves:**
- Host connects via WebRTC (not Twilio Device)
- Host mic goes to Janus Live Room
- Host hears participants in Live Room

---

## Phase 3: PSTN Bridge (Days 4-5)

### Bidirectional Audio

**Phone → WebRTC:**
1. Twilio sends muLaw audio via Media Stream WebSocket
2. Server converts muLaw → PCM (16-bit, 16kHz)
3. Package as RTP
4. Send to Janus room
5. Janus distributes to WebRTC participants

**WebRTC → Phone:**
1. Janus sends RTP audio to server
2. Server extracts PCM
3. Convert PCM → muLaw (8kHz, 8-bit)
4. Send via Media Stream WebSocket
5. Twilio plays to phone caller

### Audio Processing

**Codecs:**
- Twilio: muLaw (G.711)
- WebRTC: Opus
- Server handles conversion

**Libraries needed:**
```bash
npm install --save audio-buffer
npm install --save pcm-convert  
npm install --save @fonoster/mu-law
```

---

## Phase 4: Screening Room (Days 6-7)

### Implementation

**When screener clicks "Pick Up":**
1. Create screening room: `screening-{episodeId}-{callId}`
2. Screener joins via WebRTC
3. Move caller's Media Stream to screening room
4. Both hear each other, isolated

**Database tracking:**
```typescript
call.activeRoom = 'screening-{episodeId}-{callId}'
call.connectionType = 'media-stream' // vs 'webrtc'
```

---

## Phase 5: Live Room + Transitions (Days 8-10)

### State Transitions

**Approve → Move to Live:**
```typescript
await roomManager.moveParticipant(
  call.id,
  'screening-{episodeId}-{callId}',
  'live-{episodeId}',
  true // Start muted
);
```

**Put On Air:**
```typescript
await roomManager.muteParticipant(call.id, false);
```

**Put On Hold:**
```typescript
await roomManager.muteParticipant(call.id, true);
// Still in Live Room, hearing show
```

**Back to Screening:**
```typescript
await roomManager.moveParticipant(
  call.id,
  'live-{episodeId}',
  'screening-{episodeId}-{callId}',
  false
);
```

All transitions are instant, no audio drops, infinite toggles.

---

## Phase 6: Edge Cases (Days 11-12)

**Handle:**
- Caller hangs up (clean up Media Stream + room)
- Network issues (auto-reconnect Media Stream)
- Browser refresh (restore WebRTC state)
- Janus server restart (reconnect all)
- Multiple screeners
- Bandwidth limits

---

## Phase 7: Optimization (Days 13-14)

**Audio Quality:**
- Echo cancellation
- Noise suppression
- Automatic gain control
- Jitter buffer tuning

**Latency:**
- Target <200ms end-to-end
- Optimize codec settings
- Tune buffer sizes

---

## Infrastructure Costs

**Janus Server (Railway Pro):** $25/month
- 2GB RAM
- 2 vCPUs
- Dedicated instance

**TURN Server:** $0 (use Twilio's)

**Total New Cost:** ~$25/month

---

## Migration Strategy

### Keep (Don't Change)
- Database schema
- Authentication
- UI components
- Twilio phone number
- Recording (modify to use WebRTC audio)
- AI features

### Replace
- Host Twilio Device → WebRTC
- Twilio conferences → Janus rooms
- Conference participant API → Room manager API

### Add New
- Janus Gateway server
- Media Stream bridge
- WebRTC signaling (Socket.IO)
- Browser WebRTC client

---

## Testing Protocol

**After each phase:**
1. Unit tests for new code
2. Integration test with previous phases
3. Audio quality check
4. Latency measurement

**Final acceptance test:**
- Complete show simulation
- Multiple state transitions
- 5+ concurrent callers
- Browser refresh during call
- Network interruption recovery

---

## Rollback Plan

**If WebRTC fails:**
- Keep all infrastructure code
- Document what didn't work
- Fall back to current Twilio system
- Lessons learned for future

**Rollback tag:** `pre-webrtc-rebuild`

---

## Current Status

**Completed:**
- ✅ Janus Gateway client (janusGateway.ts)
- ✅ Room Manager (webrtcRoomManager.ts)
- ✅ Media Bridge skeleton (twilioMediaBridge.ts)
- ✅ Docker configuration
- ✅ Documentation

**Next immediate steps:**
1. Deploy Janus to Railway as separate service
2. Install audio processing libraries
3. Implement muLaw ↔ PCM conversion
4. Create Media Stream WebSocket endpoint
5. Test Janus connectivity

---

## Expected Timeline

**Week 1 (Days 1-7):**
- Infrastructure setup
- Host WebRTC connection
- PSTN bridge working
- Screening room functional

**Week 2 (Days 8-14):**
- Live room transitions
- Toggle functionality
- Edge case handling

**Week 3 (Days 15-21):**
- Optimization
- Full testing
- Production deployment

---

## Confidence: 85%

**Why confident:**
- Proven architecture (used by major platforms)
- Full control over audio routing
- Can test each phase independently

**Main risks:**
- Audio quality tuning (takes iteration)
- Janus learning curve (well-documented though)
- Integration with existing code

**Mitigation:**
- Incremental development
- Test after each phase
- Keep Twilio fallback available

---

This is the right solution for a professional broadcast platform. It will take time, but it will work.

