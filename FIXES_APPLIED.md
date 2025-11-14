# Fixes Applied - Audio & On Air Button

**Date:** November 14, 2025, 7:00 PM  
**Status:** 🔧 Fixes applied, ready to retest

---

## ✅ Issue 1: Host "On Air" Button Fixed

**Problem:** Error when clicking "On Air": `Twilio device not initialized. Start the show first.`

**Root Cause:** The code was checking for Twilio Device even in WebRTC mode.

**Fix Applied:**
- Updated `ParticipantBoard.tsx` line 60-65
- Now checks for WebRTC connection instead of Twilio Device when in WebRTC mode
- Shows helpful error: "Please join the live room first before putting callers on air."

**Action Required:**
1. **Refresh the Host Dashboard page** (Cmd+R / Ctrl+R)
2. **Click "Join Live Room"** button first
3. **Then click "On Air"** for the caller

---

## ✅ Issue 2: Audio Routing Fixed

**Problem:** No audio in screening room (caller → screener, screener → caller)

**Root Cause:** The `TwilioMediaBridge` was still forwarding phone audio to the `lobby` room even after the screener picked up. The `CallFlowService` was updating the database but not telling the media bridge to move the stream.

**Fix Applied:**
- Updated `CallFlowService.startScreening()` (line 125-133)
- Updated `CallFlowService.approveCall()` (line 165-173)
- Now calls `mediaBridge.moveStreamToRoom()` when transitioning states
- Audio will now follow the call through: `lobby` → `screening-X-Y` → `live-X`

**Expected Behavior:**
1. Call comes in → Audio in `lobby` room
2. Screener picks up → Audio moves to `screening-{episodeId}-{callId}` room
3. Screener approves → Audio moves to `live-{episodeId}` room
4. Host puts on air → Audio unmuted

---

## 🧪 How to Test

### Test 1: Screening Audio

1. **Refresh both Screening Room and Host Dashboard**
2. **Make a test call**
3. **Click "Screen" to pick up**
4. **Expected:**
   - ✅ You hear the caller
   - ✅ Caller hears you
   - ✅ Server logs show: `✅ [CALL-FLOW] Moved call X to screening room: screening-...`

### Test 2: On Air Button

1. **In Host Dashboard, click "Join Live Room"**
2. **Grant microphone permissions**
3. **Wait for "Connected to LiveKit" message**
4. **Click "On Air" for the approved caller**
5. **Expected:**
   - ✅ Button works (no error)
   - ✅ Call moves to "On Air" section
   - ✅ You hear the caller
   - ✅ Caller hears you

---

## 📊 What Changed

### File: `src/components/ParticipantBoard.tsx`

**Before:**
```typescript
if (!broadcast.useWebRTC) {
  // Check for Twilio Device
  if (!broadcast.twilioDevice) {
    throw new Error('Twilio device not initialized...');
  }
}
// No check for WebRTC mode!
```

**After:**
```typescript
if (!broadcast.useWebRTC) {
  // Check for Twilio Device
  if (!broadcast.twilioDevice) {
    throw new Error('Twilio device not initialized...');
  }
} else {
  // WebRTC mode: Check if host joined live room
  if (!broadcast.webrtcService || !broadcast.currentRoom?.includes('live-')) {
    throw new Error('Please join the live room first...');
  }
}
```

### File: `server/services/callFlowService.ts`

**Added to `startScreening()`:**
```typescript
// Move the Twilio media stream to the screening room
if (this.mediaBridge && call.twilioCallSid) {
  await this.mediaBridge.moveStreamToRoom(call.twilioCallSid, screeningRoom);
  console.log(`✅ [CALL-FLOW] Moved call to screening room: ${screeningRoom}`);
}
```

**Added to `approveCall()`:**
```typescript
// Move the Twilio media stream to the live room
if (this.mediaBridge && updatedCall.twilioCallSid) {
  await this.mediaBridge.moveStreamToRoom(updatedCall.twilioCallSid, liveRoom);
  console.log(`✅ [CALL-FLOW] Moved call to live room: ${liveRoom}`);
}
```

---

## 🔍 What to Look For in Server Logs

**Good signs (audio working):**
```
✅ [MEDIA-STREAM] Call bridged to room: lobby
✅ [CALL-FLOW] Moved call X to screening room: screening-cmhz6vqlk0001oqc1p3651915-cmhz7kwgg0005r26ezwrhc9q0
🔄 [MEDIA-BRIDGE] Moving stream from lobby to screening-...
✅ [MEDIA-BRIDGE] Stream moved to screening-...
📞 [BROWSER→PHONE] Received X audio packets in 5s for room: screening-...
```

**Bad signs (audio not working):**
```
❌ [MEDIA-BRIDGE] Room mapping mismatch!
❌ [CALL-FLOW] Failed to move stream to screening room
ℹ️ [BROWSER→PHONE] No caller in room: screening-...
```

---

## 🎯 Expected Flow (After Fixes)

### 1. Call Comes In
```
Phone → Twilio → Server → MediaBridge.startMediaStream()
  → Audio forwarded to: lobby
  → CallSession: phase=incoming, room=lobby
```

### 2. Screener Picks Up
```
Frontend → /api/calls/:id/screen → CallFlowService.startScreening()
  → CallSession: phase=screening, room=screening-X-Y
  → MediaBridge.moveStreamToRoom(screening-X-Y) ✅ NEW!
  → Audio now forwarded to: screening-X-Y
  → Screener joins screening-X-Y via LiveKit
  → Audio flows both ways ✅
```

### 3. Screener Approves
```
Frontend → /api/calls/:id/approve → CallFlowService.approveCall()
  → CallSession: phase=live_muted, room=live-X
  → MediaBridge.moveStreamToRoom(live-X) ✅ NEW!
  → Audio now forwarded to: live-X
  → Host joins live-X via LiveKit
  → Audio ready (caller muted)
```

### 4. Host Puts On Air
```
Frontend → /api/participants/:id/on-air → CallFlowService.putOnAir()
  → CallSession: phase=live_on_air, sendMuted=false
  → Server unmutes Twilio participant
  → Audio flows: Host ↔ Caller ✅
```

---

## 🚀 Next Steps

1. **Refresh your browser tabs** (both Screening Room and Host Dashboard)
2. **Make a new test call**
3. **Follow the test procedures above**
4. **Watch server logs** for the new log messages
5. **Report results!**

---

## 📝 If Issues Persist

### Audio still not working?

**Check:**
1. Server logs for `✅ [CALL-FLOW] Moved call to screening room`
2. Room names match in server logs and browser console
3. Microphone permissions granted
4. LiveKit room has participants: `curl http://localhost:3001/api/webrtc/rooms`

### On Air button still not working?

**Check:**
1. Did you refresh the page after the fix?
2. Did you click "Join Live Room" first?
3. Browser console for error messages
4. `broadcast.currentRoom` should include `live-`

---

**Backend restarted with fixes. Ready to test! 🎉**
