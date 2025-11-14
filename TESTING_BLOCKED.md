# ⚠️ Testing Blocked - Missing LiveKit Credentials

**Status:** 🔴 Cannot test WebRTC audio without LiveKit credentials  
**Date:** November 14, 2025, 6:40 PM

---

## 🚨 Current Issue

The host and screener **cannot join WebRTC rooms** because:

```
❌ [WEBRTC] Failed to join live room: Error: Failed to get LiveKit token
```

**Root Cause:** LiveKit credentials are not in your local `.env` file.

---

## ✅ What's Working

- ✅ Database schema synced (`CallSession` table exists)
- ✅ Backend running on `http://localhost:3001`
- ✅ Frontend running on `http://localhost:5173`
- ✅ Vite proxy configured correctly
- ✅ Socket.IO connecting (with some WebSocket upgrade warnings, but working)
- ✅ Call state machine initialized

---

## 🔴 What's NOT Working

- ❌ WebRTC token generation (503 error)
- ❌ Host cannot join live room
- ❌ Screener cannot join screening room
- ❌ No audio will work without this

**Health Check:**
```bash
curl http://localhost:3001/api/webrtc/health
```

**Current Result:**
```json
{
  "status": "degraded",
  "roomManager": "missing",
  "mediaBridge": "missing",
  "connected": false
}
```

**Expected Result (after fix):**
```json
{
  "status": "ok",
  "roomManager": "initialized",
  "mediaBridge": "initialized",
  "connected": true
}
```

---

## 🔧 How to Fix

### Step 1: Get LiveKit Credentials

See: **`GET_LIVEKIT_CREDENTIALS.md`** for detailed instructions.

**Quick version:**
1. Go to Railway dashboard
2. Open your project variables
3. Copy `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`

### Step 2: Add to Local `.env`

```bash
cd /Users/kr/Development/audioroad-broadcast
nano .env
```

Add these lines (replace with your actual values):
```env
LIVEKIT_WS_URL=wss://audioroad-broadcast-st6f3yzp.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxxxxx
LIVEKIT_API_SECRET=your_actual_secret_here
```

### Step 3: Restart Backend

```bash
pkill -f "tsx watch server/index.ts"
npm run dev:server
```

### Step 4: Verify

```bash
curl http://localhost:3001/api/webrtc/health
```

Should now show `"status": "ok"` and `"roomManager": "initialized"`.

---

## 🧪 After Fix - Resume Testing

Once LiveKit is initialized, follow the test procedures:

1. **Quick Test (5 min):** `QUICK_TEST_GUIDE.md`
2. **Full Test (30 min):** `MANUAL_TEST_PROCEDURE.md`

---

## 📊 Error Logs Summary

### Browser Console (Host Dashboard)
```
❌ [WEBRTC] Failed to join live room: Error: Failed to get LiveKit token
Failed to load resource: the server responded with a status of 503 (Service Unavailable)
```

### Browser Console (Screening Room)
```
❌ [WEBRTC] Failed to join screening room: Error: Failed to get LiveKit token
Failed to load resource: the server responded with a status of 503 (Service Unavailable)
```

### Server Logs (Expected but Missing)
```
# Should see these after adding credentials:
✅ [WEBRTC] Connected to LiveKit Cloud
✅ [WEBRTC] Phone call bridge enabled - PSTN calls can connect to WebRTC rooms
```

---

## 🎯 Impact

**Cannot test:**
- ❌ Host joining live room
- ❌ Screener joining screening room
- ❌ Any audio (caller → browser)
- ❌ Any audio (browser → caller)
- ❌ Call state transitions that require WebRTC

**Can still test (without audio):**
- ✅ Call appears in UI when dialed in
- ✅ Call state changes (incoming → screening → live)
- ✅ UI updates via Socket.IO
- ✅ Database `CallSession` tracking

---

## 🚀 Next Steps

1. **Get LiveKit credentials from Railway** (5 minutes)
2. **Add to local `.env`** (1 minute)
3. **Restart backend** (30 seconds)
4. **Verify health endpoint** (10 seconds)
5. **Resume testing!** 🎉

---

## 📞 Alternative: Test Without WebRTC

If you want to test the call flow **without audio** (just to verify state transitions):

1. The call will still appear in the UI when you dial in
2. You can click through the states (Screen, Approve, On Air, etc.)
3. The `CallSession` table will update correctly
4. Socket.IO events will fire

**But:** You won't hear any audio until LiveKit is configured.

---

## 🔍 Why This Happened

The LiveKit credentials are in your **production** `.env` on Railway, but not in your **local** `.env` file. This is normal for security reasons (we don't commit secrets to git).

When you cloned the repo or created a new `.env`, the LiveKit vars weren't included.

---

**Get those credentials and let's test this thing! 🚀**

See: `GET_LIVEKIT_CREDENTIALS.md` for step-by-step instructions.

