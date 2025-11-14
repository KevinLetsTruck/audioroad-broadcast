# Audio Troubleshooting Guide

## 🔍 Current Issues

### Issue 1: Host "On Air" Button Not Working ✅ FIXED
**Error:** `Twilio device not initialized. Start the show first.`

**Fix Applied:** Updated `ParticipantBoard.tsx` to check for WebRTC connection instead of Twilio Device when in WebRTC mode.

**Action Required:**
1. Refresh the Host Dashboard page
2. Click "Join Live Room" button first
3. Then click "On Air" for the caller

---

### Issue 2: No Audio in Screening Room 🔧 INVESTIGATING

**Symptoms:**
- ✅ Screener can join screening room
- ✅ Browser sends audio packets (`🎤 [AUDIO-TO-PHONE] Sent 59 audio packets`)
- ❌ Screener doesn't hear caller
- ❌ Caller doesn't hear screener

**Possible Causes:**

#### A. Phone → Browser Audio Path
The phone audio needs to flow:
```
Phone (muLaw) 
  → Twilio Media Stream 
  → Server (decode to PCM) 
  → LiveKit Room 
  → Browser (play audio)
```

**Check:**
1. Server logs should show: `📡 [LIVEKIT] First audio packet to forward`
2. Server logs should show: `✅ [LIVEKIT] Token generated for [participant]`
3. Browser should receive LiveKit data messages

#### B. Browser → Phone Audio Path
The browser audio needs to flow:
```
Browser (capture mic) 
  → LiveKit Room 
  → Server HTTP endpoint 
  → Twilio Media Stream 
  → Phone (muLaw)
```

**Check:**
1. Browser logs show: `🎤 [AUDIO-TO-PHONE] Sent X audio packets` ✅
2. Server logs should show: `📞 [BROWSER→PHONE] Received X audio packets`
3. Server logs should show audio being sent to Twilio

---

## 🔍 Diagnostic Steps

### Step 1: Check Server Logs

Look for these patterns in the server console:

**Good Signs:**
```
✅ [MEDIA-STREAM] Call bridged to room: lobby
✅ [LIVEKIT] Token generated for [participant]
📡 [LIVEKIT] First audio packet to forward
📞 [BROWSER→PHONE] Received X audio packets in 5s
```

**Bad Signs:**
```
❌ [MEDIA-BRIDGE] Room mapping mismatch!
❌ [LIVEKIT] Failed to forward audio
ℹ️ [BROWSER→PHONE] No caller in room: [room-name]
```

### Step 2: Check Room Names Match

The room names must match exactly:

**When screening:**
- Screener joins: `screening-{episodeId}-{callId}`
- Server forwards phone audio to: `screening-{episodeId}-{callId}`
- Browser sends audio to: `screening-{episodeId}-{callId}`

**Check in browser console:**
```
Look for: "✅ [WEBRTC] Joined screening room: screening-..."
```

**Check in server logs:**
```
Look for: "✅ [MEDIA-STREAM] Call bridged to room: screening-..."
```

**These must match!**

### Step 3: Check LiveKit Room Participants

```bash
curl http://localhost:3001/api/webrtc/rooms
```

Should show the screening room with 1+ participants.

### Step 4: Check Media Bridge Status

```bash
curl http://localhost:3001/api/webrtc/health
```

Should show:
```json
{
  "status": "ok",
  "activeStreams": 1
}
```

---

## 🐛 Known Issues

### Issue: Room Name Mismatch

**Symptom:** Server logs show:
```
❌ [MEDIA-BRIDGE] Room mapping mismatch!
Looking for: screening-X-Y
Active streams: 1
- CA123: lobby
```

**Cause:** The call was bridged to `lobby` but screener joined `screening-X-Y`.

**Fix:** The call needs to be moved from lobby to the screening room when screener picks up.

**Check:** `server/routes/calls.ts` - `/api/calls/:id/screen` endpoint should call `CallFlowService.startScreening()` which should update the room.

### Issue: No Audio Forwarding

**Symptom:** Browser sends packets but server doesn't receive them.

**Check:**
```bash
# In browser console, look for:
🎤 [AUDIO-TO-PHONE] Sent X audio packets

# In server logs, should see:
📞 [BROWSER→PHONE] Received X audio packets
```

**If missing:** The HTTP endpoint `/api/webrtc/forward-to-phone` might not be working.

---

## 🔧 Quick Fixes

### Fix 1: Restart Both Servers

Sometimes WebSocket connections get stuck:

```bash
# Stop everything
pkill -f "tsx watch server/index.ts"
pkill -f "vite"

# Restart
cd /Users/kr/Development/audioroad-broadcast
npm run dev:server &
npm run dev -- --host &
```

### Fix 2: Clear Browser State

```bash
# In browser console:
localStorage.clear()
sessionStorage.clear()
# Then refresh page
```

### Fix 3: Check Microphone Permissions

```
Chrome: Settings → Privacy → Microphone → Allow localhost
Safari: Preferences → Websites → Microphone → Allow
```

---

## 📊 Expected Flow (Working System)

### When Call Comes In:
```
1. Phone calls Twilio number
2. Twilio connects to /api/twilio/media-stream/stream (WebSocket)
3. Server creates CallSession with phase=incoming, room=lobby
4. Server bridges call to LiveKit lobby room
5. UI shows call in "Incoming" section
```

### When Screener Picks Up:
```
1. Screener clicks "Screen" button
2. Frontend calls /api/calls/:id/screen
3. Server updates CallSession: phase=screening, room=screening-X-Y
4. Server moves Twilio stream to screening-X-Y room
5. Screener joins screening-X-Y via LiveKit
6. Audio flows both ways
```

### When Approved to Live:
```
1. Screener clicks "Approve"
2. Frontend calls /api/calls/:id/approve
3. Server updates CallSession: phase=live_muted, room=live-X
4. Server moves Twilio stream to live-X room
5. Host joins live-X via LiveKit
6. Audio ready (but caller muted)
```

### When Put On Air:
```
1. Host clicks "On Air"
2. Frontend calls /api/participants/:id/on-air
3. Server updates CallSession: phase=live_on_air, sendMuted=false
4. Server unmutes Twilio participant
5. Audio flows: Host ↔ Caller
```

---

## 🎯 Next Steps

1. **Check server logs** while making a test call
2. **Look for room name mismatches**
3. **Verify audio forwarding endpoints are being hit**
4. **Check LiveKit room participants**

If audio still doesn't work after checking these, we may need to add more detailed logging to the audio pipeline.

---

## 📞 Test Command

```bash
# Watch server logs in real-time
cd /Users/kr/Development/audioroad-broadcast
npm run dev:server

# Look for these patterns:
# - "✅ [MEDIA-STREAM] Call bridged to room: X"
# - "✅ [LIVEKIT] Token generated"
# - "📡 [LIVEKIT] First audio packet"
# - "📞 [BROWSER→PHONE] Received X packets"
```

---

**Let's get that audio working! 🎧**

