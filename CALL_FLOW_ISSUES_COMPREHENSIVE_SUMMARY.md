# Call Flow Issues - Comprehensive Technical Summary
**Date:** November 13, 2025  
**Project:** AudioRoad Broadcast - Live Radio Call-In System  
**Purpose:** Multi-model planning session to solve persistent audio issues

---

## Table of Contents
1. [System Architecture Evolution](#system-architecture-evolution)
2. [Original Twilio-Only Approach (Failed)](#original-twilio-only-approach-failed)
3. [WebRTC Hybrid Approach (Current)](#webrtc-hybrid-approach-current)
4. [Complete Issue History](#complete-issue-history)
5. [Current Audio Flow](#current-audio-flow)
6. [What Works Now](#what-works-now)
7. [What's Still Broken](#whats-still-broken)
8. [Technical Constraints](#technical-constraints)
9. [Attempted Solutions](#attempted-solutions)
10. [Critical Code Sections](#critical-code-sections)

---

## System Architecture Evolution

### Goal
Enable live radio show hosts/screeners to talk with phone callers (PSTN) in a web browser with:
- **Lobby**: Callers wait in a conference
- **Screening Room**: Screener talks with caller privately (1-on-1)
- **Live Room**: Host talks with approved caller on-air (broadcast)

### Three Approaches Tried
1. **Twilio Device Only** (Abandoned) - Echo/feedback issues
2. **Janus WebRTC + Twilio Media Stream** (Abandoned) - Complex setup, poor documentation
3. **LiveKit WebRTC + Twilio Media Stream** (Current) - Still has audio issues

---

## Original Twilio-Only Approach (Failed)

### Architecture
```
Caller (PSTN) → Twilio Conference → Twilio Device (Browser)
```

### Implementation
- Host/Screener used `@twilio/voice-sdk` (Twilio Device)
- Callers joined via Twilio Voice conferences
- Both sides were on Twilio infrastructure

### Issues Encountered

#### 1. **Echo and Feedback** (Critical)
- **Symptom**: Host heard their own voice echoed back
- **Cause**: Twilio Device in browser picked up computer speakers
- **Attempted Fix**: Echo cancellation settings, but unreliable
- **Result**: Unusable in production

#### 2. **Browser Audio Permission Complexity**
- Twilio Device required multiple permission prompts
- Inconsistent behavior across browsers
- Users confused by permission flow

#### 3. **Limited Control Over Audio Routing**
- Difficult to implement "put on hold" (mute specific participants)
- Conference mixing happened server-side (no client control)
- Hard to route audio differently for screener vs. host

#### 4. **Latency Issues**
- Audio went: Browser → Twilio → Conference → Twilio → Browser
- Double round-trip for screening calls
- Noticeable delay (500-800ms)

### Why We Abandoned It
The echo/feedback problem was insurmountable for a live broadcast environment. Professional radio requires clean, echo-free audio.

---

## WebRTC Hybrid Approach (Current)

### Architecture
```
Caller (PSTN) ←→ Twilio Media Stream (WebSocket) ←→ Server Media Bridge ←→ LiveKit WebRTC ←→ Browser
```

### Components

#### Frontend (Browser)
- **Technology**: LiveKit Client SDK
- **File**: `src/services/livekitClient.ts`
- **Responsibility**: 
  - Capture microphone audio (48kHz, PCM)
  - Send audio to server via HTTP POST
  - Receive phone audio via LiveKit Data Messages
  - Play phone audio through Web Audio API

#### Backend (Server)
- **Technology**: Node.js + Express + LiveKit Server SDK
- **Files**:
  - `server/services/twilioMediaBridge.ts` - Audio conversion
  - `server/services/livekitRoomManager.ts` - Room management
  - `server/index.ts` - WebSocket endpoint for Twilio Media Stream

#### Audio Pipeline

**Phone → Browser (Caller speaks):**
```
1. Caller (PSTN, 8kHz muLaw)
   ↓
2. Twilio Media Stream (WebSocket)
   ↓
3. Server receives base64-encoded muLaw
   ↓
4. Decode base64 → muLaw bytes (Uint8Array)
   ↓
5. Decode muLaw → PCM Int16Array (using alawmulaw library)
   ↓
6. Convert Int16Array → PCM Buffer (writeInt16LE)
   ↓
7. Create RTP packet
   ↓
8. Add to jitter buffer
   ↓
9. Encode PCM to base64
   ↓
10. Send via LiveKit Data Message to browser
    ↓
11. Browser decodes base64 → PCM bytes
    ↓
12. Convert PCM bytes → Float32Array
    ↓
13. Create AudioBuffer
    ↓
14. Play through Web Audio API
```

**Browser → Phone (Host/Screener speaks):**
```
1. Browser captures mic (48kHz PCM) using ScriptProcessorNode
   ↓
2. Browser sends PCM chunks via HTTP POST to /api/audio/send-to-phone
   ↓
3. Server receives 48kHz PCM Buffer
   ↓
4. Downsample 48kHz → 8kHz (6:1 ratio)
   ↓
5. Encode PCM → muLaw (using alawmulaw library)
   ↓
6. Encode muLaw → base64
   ↓
7. Send to Twilio via WebSocket as Media message
   ↓
8. Twilio converts to PSTN audio
   ↓
9. Caller hears it
```

### Room Management

#### Three Room Types
1. **Lobby Room**: `lobby-{episodeId}` - Callers wait here initially
2. **Screening Room**: `screening-{episodeId}-{callId}` - Private screener/caller conversation
3. **Live Room**: `live-{episodeId}` - On-air conversation with host

#### State Transitions
```
Incoming Call → Lobby
   ↓ (Screener picks up)
Screening Room (private)
   ↓ (Screener approves)
Live Room - On Hold (muted)
   ↓ (Host puts on air)
Live Room - On Air (unmuted)
```

---

## Complete Issue History

### Phase 1: WebSocket Connection Issues

#### Issue: Media Stream Disconnected Immediately
- **Symptom**: `Active streams: 0` in logs, WebSocket closed instantly
- **Root Cause**: Race condition - Media Stream WebSocket connected BEFORE call record was created in database
- **Solution**: Implemented retry logic (10 attempts, 500ms delay) in `server/index.ts`
- **Status**: ✅ FIXED

```typescript
let call = null;
let retries = 0;
const maxRetries = 10;

while (!call && retries < maxRetries) {
  call = await prismaForMediaStream.call.findFirst({
    where: { twilioCallSid: callSid }
  });
  if (!call) {
    await new Promise(resolve => setTimeout(resolve, 500));
    retries++;
  }
}
```

### Phase 2: Audio Direction Issues

#### Issue: "Host and Screener on Different Systems"
- **Symptom**: No audio between host and screener
- **Root Cause**: Misunderstanding - host used Twilio Device while screener used WebRTC
- **Solution**: User error - both needed "Use WebRTC" checkbox enabled
- **Status**: ✅ FIXED (user configuration)

#### Issue: Caller Can Hear Host/Screener, But Not Vice Versa
- **Symptom**: One-way audio only (phone → browser works, browser → phone silent)
- **Root Cause**: UNKNOWN - this is the CURRENT ISSUE
- **Status**: ❌ ACTIVE PROBLEM

### Phase 3: Audio Data Problems

#### Issue: Browser Receives All-Zero PCM Bytes
- **Symptom**: `First 10 bytes: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]` in browser console
- **Diagnosis**: Either:
  1. Twilio sending silence
  2. muLaw decode producing zeros
  3. Buffer creation producing zeros
  4. LiveKit not forwarding data correctly
- **Status**: ❌ PARTIALLY RESOLVED (sometimes works, sometimes doesn't)

#### Issue: Room Mapping Mismatch
- **Symptom**: 
  ```
  ❌ [MEDIA-BRIDGE] Room mapping mismatch!
  Looking for: screening-cmhwjyeqz0001xv45po0h648c-cmhwnigu70003swb2n2am9l7p
  Active streams: 1
  - CA3e4ef6ff277b951bfb57ad3aecfdbfec: live-cmhwjyeqz0001xv45po0h648c
  ```
- **Root Cause**: Screener's browser continues sending audio to screening room even after call moved to live room
- **Why It Happens**: Client doesn't update room when call state changes
- **Status**: ❌ ACTIVE PROBLEM - causes audio send failures

#### Issue: No Caller in Room Error
- **Symptom**: `ℹ️ [BROWSER→PHONE] No caller in room: screening-cmhwjyeqz0001xv45po0h648c-cmhwnigu70003swb2n2am9l7p`
- **Root Cause**: Same as room mapping mismatch
- **Status**: ❌ ACTIVE PROBLEM

### Phase 4: Diagnostic Attempts

#### Attempted: Detailed Logging for Audio Conversion
- **What We Added**:
  - Log first 10 muLaw bytes from Twilio
  - Log first 10 PCM Int16 values after decode
  - Log first 20 PCM buffer bytes after write
  - Log 48kHz → 8kHz downsampling samples
  - Log base64 audio snippets
- **Result**: Logs not showing in Railway or too verbose
- **Status**: ⚠️ INCONCLUSIVE

---

## Current Audio Flow

### What Works ✅

1. **WebSocket Connection**
   - Twilio Media Stream connects successfully
   - Stays connected for duration of call
   - Receives media packets consistently

2. **Phone → Browser Audio**
   - ✅ Caller's voice reaches server (muLaw packets received)
   - ✅ Server decodes muLaw → PCM
   - ✅ Server forwards to LiveKit
   - ✅ Browser receives LiveKit data messages
   - ✅ Browser plays audio through Web Audio API
   - ✅ **Screener/Host CAN hear caller**

3. **Browser → Server Audio**
   - ✅ Browser captures microphone
   - ✅ Browser sends PCM audio via HTTP POST
   - ✅ Server receives audio packets
   - ✅ Server logs show audio being processed
   - ✅ 48kHz → 8kHz downsampling executes

4. **Server → Twilio Audio**
   - ✅ Server encodes PCM → muLaw
   - ✅ Server sends media messages to Twilio WebSocket
   - ✅ Twilio receives messages (no errors)
   - ✅ Large amounts of data sent (359KB in test)

### What's Broken ❌

1. **Phone Playback**
   - ❌ **Caller hears SILENCE or GARBLED audio**
   - Server sends data to Twilio successfully
   - Twilio forwards to phone line
   - But audio is inaudible/corrupted

2. **Room Synchronization**
   - ❌ Browser doesn't update room name when call state changes
   - Screener stays in "screening" room, call moves to "live" room
   - Causes "Room mapping mismatch" errors
   - Audio packets sent to wrong room

3. **Audio Quality**
   - ❌ Unknown if downsampling is correct
   - ❌ Unknown if muLaw encoding is correct
   - ❌ No visibility into Twilio's received audio quality

---

## What's Still Broken

### Primary Issue: Browser → Phone Audio Silent/Garbled

#### Symptoms
1. Caller hears nothing or garbled noise when host/screener speaks
2. Server logs show successful transmission:
   ```
   📞 [BROWSER→PHONE] Received 117 audio packets in 5s
   Bytes: 414080 received, 359414 sent
   ```
3. No Twilio errors
4. WebSocket stays connected

#### Potential Root Causes

**A. Sample Rate Conversion Error**
```typescript
// Current downsampling code
const downsampleRatio = 6; // 48000 / 8000
const pcmInt16_8k = new Int16Array(Math.floor(pcmInt16_48k.length / downsampleRatio));
for (let i = 0; i < pcmInt16_8k.length; i++) {
  pcmInt16_8k[i] = pcmInt16_48k[i * downsampleRatio];
}
```
- **Problem**: Naive decimation (just dropping samples) can cause aliasing
- **Should Use**: Low-pass filter before downsampling
- **Effect**: Audio might sound robotic or silent

**B. muLaw Encoding Error**
```typescript
const muLawData = MuLawEncoder(pcmInt16_8k);
```
- **Problem**: `alawmulaw` library might be encoding incorrectly
- **Expected**: Int16 → 8-bit muLaw
- **Possible Issue**: Sign extension, byte order, or amplitude scaling

**C. Twilio Media Format Mismatch**
```typescript
const audioPayload = {
  event: 'media',
  streamSid: connection.streamSid,
  media: {
    payload: muLawData.toString('base64')
  }
};
```
- **Problem**: Twilio expects specific format
- **Possible Issues**:
  - Missing `track` field
  - Wrong `streamSid`
  - Packet size constraints (should be 160 bytes for 20ms)

**D. RTP Timestamp Issues**
```typescript
connection.outgoingSequence = (connection.outgoingSequence + 1) % 65536;
connection.outgoingTimestamp += 160;
```
- **Problem**: Timestamps might be out of sync
- **Effect**: Twilio might drop packets or play at wrong speed

**E. Audio Level Too Low**
```typescript
// No gain adjustment in current code
```
- **Problem**: Browser mic might be quieter than expected
- **Effect**: Audio sent but too quiet to hear

### Secondary Issue: Room Synchronization

#### Symptoms
```
❌ [MEDIA-BRIDGE] Room mapping mismatch!
Looking for: screening-cmhwjyeqz0001xv45po0h648c-cmhwnigu70003swb2n2am9l7p
Active streams: 1
- CA3e4ef6ff277b951bfb57ad3aecfdbfec: live-cmhwjyeqz0001xv45po0h648c
```

#### Root Cause
1. Screener picks up call → joins `screening-{episodeId}-{callId}` room
2. Screener approves call → server moves call to `live-{episodeId}` room
3. **Screener's browser doesn't know about room change**
4. Screener's audio keeps going to `screening` room
5. Server looks for call in `screening` room but it's in `live` room
6. Audio packets rejected

#### Solution Needed
- Browser needs to track current call state
- When call moves to live room, browser should:
  - Stop sending to screening room
  - Either disconnect (if screener) or switch to live room (if also host)

---

## Technical Constraints

### Audio Format Requirements

#### Twilio Media Stream
- **Encoding**: muLaw (G.711)
- **Sample Rate**: 8kHz
- **Bit Depth**: 8-bit (compressed from 16-bit)
- **Packet Size**: 160 bytes per 20ms (320 samples)
- **Format**: Base64-encoded in JSON messages

#### Browser WebRTC
- **Encoding**: PCM (uncompressed)
- **Sample Rate**: 48kHz (Web Audio API default)
- **Bit Depth**: 32-bit float (AudioContext) or 16-bit int (processing)
- **Format**: Float32Array or Int16Array

#### Conversion Requirements
- **48kHz → 8kHz**: 6:1 decimation
- **PCM → muLaw**: Non-linear compression
- **Float32 → Int16**: Scaling and clamping

### Network Constraints

#### Twilio Media Stream WebSocket
- **Protocol**: WebSocket (wss://)
- **Message Rate**: ~50 packets/second (20ms each)
- **Bandwidth**: ~64kbps (muLaw standard)

#### LiveKit Data Messages
- **Protocol**: WebRTC Data Channel
- **Max Message Size**: 64KB (but keep under 16KB for reliability)
- **Ordering**: Not guaranteed (UDP-like)

#### HTTP Audio Forwarding
- **Endpoint**: `/api/audio/send-to-phone`
- **Method**: POST
- **Body**: Base64 PCM chunks
- **Rate**: ~200 requests/second in logs

### Browser Constraints

#### Web Audio API
- **Sample Rate**: Fixed by hardware (usually 48kHz)
- **Buffer Size**: ScriptProcessorNode (deprecated) uses 4096 samples
- **Latency**: ~100ms minimum (buffer + processing + network)

#### ScriptProcessorNode (Deprecated)
```javascript
// Current implementation
const processor = audioContext.createScriptProcessor(4096, 1, 1);
processor.onaudioprocess = (e) => {
  const inputData = e.inputBuffer.getChannelData(0); // Float32Array
  // Convert and send to server
};
```
- **Problem**: Deprecated in favor of AudioWorklet
- **Effect**: May be removed in future browsers
- **Solution**: Migrate to AudioWorklet (more complex)

---

## Attempted Solutions

### 1. Added Retry Logic for WebSocket Connection ✅
- **File**: `server/index.ts`
- **Change**: Wait up to 5 seconds for call record to be created
- **Result**: Fixed immediate disconnection issue

### 2. Added Diagnostic Logging ⚠️
- **Files**: 
  - `server/services/twilioMediaBridge.ts`
  - `server/services/livekitRoomManager.ts`
  - `src/services/livekitClient.ts`
- **Change**: Log byte arrays at each conversion step
- **Result**: Logs too verbose or not showing expected output

### 3. Reduced Room Mapping Error Spam ✅
- **File**: `server/services/twilioMediaBridge.ts`
- **Change**: Only log room mismatch if there are active streams
- **Result**: Cleaner logs, but underlying issue persists

### 4. Added WebSocket Health Monitoring ✅
- **File**: `server/services/twilioMediaBridge.ts`
- **Change**: Alert if connection closes too quickly (<5s)
- **Result**: No early closures detected

### 5. Verified muLaw Library ✅
- **Library**: `alawmulaw` (version in package.json)
- **Functions**: `MuLawDecoder()`, `MuLawEncoder()`
- **Result**: Phone → Browser works (decode works), Browser → Phone broken (encode suspect)

---

## Critical Code Sections

### 1. Twilio Media Stream Endpoint
**File**: `server/index.ts` (lines 248-310)

```typescript
(app as any).ws('/api/twilio/media-stream/stream', async (ws: any, req: any) => {
  const initialHandler = async (message: string) => {
    const msg = JSON.parse(message);
    if (msg.event === 'start') {
      const callSid = msg.start.callSid;
      
      // Retry logic to wait for call record
      let call = null;
      let retries = 0;
      const maxRetries = 10;
      while (!call && retries < maxRetries) {
        call = await prismaForMediaStream.call.findFirst({
          where: { twilioCallSid: callSid }
        });
        if (!call) {
          await new Promise(resolve => setTimeout(resolve, 500));
          retries++;
        }
      }
      
      if (!call) {
        ws.close();
        return;
      }
      
      // Initialize media bridge
      await mediaBridge.startMediaStream(callSid, ws, call.id);
    }
  };
  ws.on('message', initialHandler);
});
```

### 2. Phone → Browser Audio Processing
**File**: `server/services/twilioMediaBridge.ts` (lines 145-210)

```typescript
private async handleIncomingAudio(connection: MediaStreamConnection, payload: string): Promise<void> {
  // 1. Decode base64 → muLaw bytes
  const muLawData = Buffer.from(payload, 'base64');
  
  // 2. Decode muLaw → PCM Int16Array
  const pcmInt16Array = MuLawDecoder(muLawData);
  
  // 3. Convert Int16Array → Buffer
  const pcmData = Buffer.allocUnsafe(pcmInt16Array.length * 2);
  for (let i = 0; i < pcmInt16Array.length; i++) {
    pcmData.writeInt16LE(pcmInt16Array[i], i * 2);
  }
  
  // 4. Create RTP packet
  const rtpPacket = this.createRtpPacket(pcmData, connection.sequence, connection.timestamp);
  
  // 5. Add to jitter buffer
  connection.jitterBuffer.push({
    sequence: connection.sequence,
    timestamp: connection.timestamp,
    data: rtpPacket,
    receivedAt: Date.now()
  });
  
  // 6. Process buffer and forward to LiveKit
  await this.processJitterBuffer(connection);
}
```

### 3. Browser → Phone Audio Processing
**File**: `server/services/twilioMediaBridge.ts` (lines 305-370)

```typescript
private async sendAudioToPhone(roomId: string, pcmAudioData: Buffer): Promise<void> {
  const connection = this.getConnectionByRoom(roomId);
  if (!connection) return;
  
  // 1. Parse 48kHz PCM from buffer
  const pcmInt16_48k = new Int16Array(
    pcmAudioData.buffer,
    pcmAudioData.byteOffset,
    pcmAudioData.length / 2
  );
  
  // 2. Downsample 48kHz → 8kHz
  const downsampleRatio = 6;
  const pcmInt16_8k = new Int16Array(Math.floor(pcmInt16_48k.length / downsampleRatio));
  for (let i = 0; i < pcmInt16_8k.length; i++) {
    pcmInt16_8k[i] = pcmInt16_48k[i * downsampleRatio];
  }
  
  // 3. Encode PCM → muLaw
  const muLawData = MuLawEncoder(pcmInt16_8k);
  
  // 4. Send to Twilio
  const audioPayload = {
    event: 'media',
    streamSid: connection.streamSid,
    media: {
      payload: muLawData.toString('base64')
    }
  };
  
  connection.ws.send(JSON.stringify(audioPayload));
  connection.stats.packetsSent++;
  connection.stats.bytesSent += muLawData.length;
}
```

### 4. Browser Audio Capture
**File**: `src/services/livekitClient.ts` (lines 285-335)

```typescript
private async startAudioCapture(): Promise<void> {
  const audioContext = new AudioContext({ sampleRate: 48000 });
  const source = audioContext.createMediaStreamSource(this.localAudioStream!);
  
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  
  processor.onaudioprocess = async (e) => {
    const inputData = e.inputBuffer.getChannelData(0); // Float32Array
    
    // Convert Float32 → Int16
    const int16Data = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]));
      int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Convert Int16 → Buffer → Base64
    const buffer = Buffer.from(int16Data.buffer);
    const base64Audio = buffer.toString('base64');
    
    // Send to server
    await fetch(`${API_BASE_URL}/api/audio/send-to-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio: base64Audio,
        roomId: this.currentRoomId
      })
    });
  };
  
  source.connect(processor);
  processor.connect(audioContext.destination);
}
```

### 5. Browser Audio Playback
**File**: `src/services/livekitClient.ts` (lines 250-283)

```typescript
private async playPhoneAudio(pcmBytes: Uint8Array, sampleRate: number): Promise<void> {
  const audioContext = new AudioContext();
  
  // Convert PCM bytes → Int16Array
  const int16Array = new Int16Array(
    pcmBytes.buffer,
    pcmBytes.byteOffset,
    pcmBytes.length / 2
  );
  
  // Convert Int16 → Float32
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
  }
  
  // Create audio buffer
  const audioBuffer = audioContext.createBuffer(1, float32Array.length, sampleRate);
  audioBuffer.getChannelData(0).set(float32Array);
  
  // Play
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start(0);
}
```

---

## Questions for Multi-Model Analysis

### Primary Questions
1. **Why is browser → phone audio silent/garbled?**
   - Is the downsampling algorithm correct?
   - Is the muLaw encoding correct?
   - Is the Twilio media format correct?
   - Should we add a low-pass filter before downsampling?

2. **How should we fix room synchronization?**
   - Should browser track call state and update room automatically?
   - Should server reject audio from wrong rooms?
   - Should we use a single room per call instead of screening/live split?

3. **Is ScriptProcessorNode the issue?**
   - Should we migrate to AudioWorklet?
   - Is the 4096 buffer size causing problems?
   - Is the lack of buffering causing packet loss?

### Technical Questions
4. **Audio Processing:**
   - Should we use a proper resampling library (like `libsamplerate` or `speex`)?
   - Should we add a low-pass filter at 4kHz before downsampling to 8kHz?
   - Should we apply gain adjustment to normalize audio levels?

5. **Packet Sizing:**
   - Should we chunk audio into exact 160-byte muLaw packets for Twilio?
   - Should we add padding if packets are too small?
   - Should we buffer audio to match Twilio's 20ms timing?

6. **Error Handling:**
   - Should we add audio checksums to detect corruption?
   - Should we log muLaw bytes in hex to verify encoding?
   - Should we add server-side audio analysis (RMS, peak detection)?

7. **Architecture:**
   - Should we eliminate the HTTP POST approach and use LiveKit bidirectionally?
   - Should we add a media server (like Jitsi, Mediasoup) instead of custom bridge?
   - Should we use Twilio Programmable Voice's WebRTC Client instead of Media Streams?

### Diagnostic Questions
8. **Testing:**
   - How can we test muLaw encoding outside of Twilio? (Generate test file)
   - Can we use Twilio's audio logs/insights to see what it's receiving?
   - Should we add a "loopback" test mode (browser → server → browser)?

9. **Debugging:**
   - What's the best way to log audio data without overwhelming logs?
   - Should we add a web-based diagnostic dashboard?
   - Can we record raw muLaw bytes to file for analysis?

---

## Relevant Documentation Links

### Twilio
- [Media Streams Overview](https://www.twilio.com/docs/voice/media-streams)
- [Media Streams Quickstart](https://www.twilio.com/docs/voice/media-streams/quickstart)
- [Media Streams API Reference](https://www.twilio.com/docs/voice/media-streams/websocket-messages)

### LiveKit
- [LiveKit Docs](https://docs.livekit.io/)
- [Data Messages](https://docs.livekit.io/guides/room/data/)
- [Server SDK (Node.js)](https://docs.livekit.io/server/node/)

### Web Audio API
- [MDN Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)

### Audio Formats
- [G.711 muLaw](https://en.wikipedia.org/wiki/G.711)
- [PCM Audio](https://en.wikipedia.org/wiki/Pulse-code_modulation)
- [Sample Rate Conversion](https://en.wikipedia.org/wiki/Sample-rate_conversion)

---

## Summary for AI Models

### What We Need
**Fix bidirectional audio between browser (WebRTC) and phone (PSTN via Twilio Media Streams)**

### Current Status
- ✅ Phone → Browser: WORKS (caller can be heard)
- ❌ Browser → Phone: BROKEN (host/screener cannot be heard)

### Key Files to Review
1. `server/services/twilioMediaBridge.ts` - Audio conversion logic
2. `src/services/livekitClient.ts` - Browser audio capture/playback
3. `server/index.ts` - Twilio Media Stream WebSocket endpoint

### Likely Problem Areas
1. **Downsampling** (48kHz → 8kHz) - may need proper filter
2. **muLaw Encoding** - may have format issues
3. **Twilio Media Format** - may be missing required fields
4. **Room Synchronization** - client doesn't track room changes

### Constraints
- Must use Twilio for PSTN connectivity (business requirement)
- Must use WebRTC for browser to avoid echo (technical requirement)
- Must be low latency for live radio (<500ms ideal)
- Must handle multiple simultaneous calls

### Success Criteria
- Host/screener can hear caller ✅ (done)
- Caller can hear host/screener ❌ (broken)
- Audio is clear, no robotic sound ❌ (unknown - can't test yet)
- Latency under 500ms ⚠️ (acceptable now, ~300ms)
- System handles 5+ simultaneous calls ⚠️ (untested)

---

**End of Document**

Last Updated: November 13, 2025

