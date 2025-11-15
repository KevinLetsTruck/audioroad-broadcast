# ✅ Enable WebRTC Mode - CRITICAL STEP!

**Date:** November 14, 2025, 9:05 PM

---

## 🚨 The Problem

You're trying to use **Twilio Device mode** instead of **WebRTC mode**:

```
🔌 [SCREENING] Connection mode: Twilio Device
❌ Error connecting to caller: Error: Twilio device not initialized
```

**This is why you can't pick up calls!**

---

## ✅ The Solution: Enable WebRTC Mode

### In Screening Room:

1. **Look for the "Use WebRTC" checkbox** (should be near the top of the page)
2. **Check the box** to enable WebRTC mode
3. **Then click "Open Phone Lines"**
4. **Make a test call**
5. **Click "Screen"** → Should work now!

---

## 🎯 Step-by-Step Test Procedure

### Step 1: Screening Room Setup
1. Open: https://audioroad-broadcast-production.up.railway.app/screening-room
2. **✅ Check the "Use WebRTC" checkbox** ← CRITICAL!
3. Click "Open Phone Lines"
4. Wait for confirmation

### Step 2: Make Test Call
- Call `+18888049791` from your phone
- Wait for call to appear in UI

### Step 3: Screen the Call
- Click "Screen" button
- Grant microphone permissions
- **You should hear the caller now!** 🎧

### Step 4: Approve to Live
- Click "Approve to Live"

### Step 5: Host Dashboard
1. Open: https://audioroad-broadcast-production.up.railway.app/host-dashboard (new tab)
2. **✅ Check the "Use WebRTC" checkbox** ← Also needed here!
3. Click "Join Live Room"
4. Grant microphone permissions

### Step 6: Put On Air
- Click "On Air" button
- Should work now!
- **You should hear caller, caller should hear you!** 🎉

---

## 📊 What Will Change

### Before (Twilio Device Mode):
```
🔌 [SCREENING] Connection mode: Twilio Device
❌ Error: Twilio device not initialized
```

### After (WebRTC Mode):
```
🔌 [SCREENING] Connection mode: WebRTC (LiveKit)
✅ [WEBRTC] Joined screening room
📞 [LIVEKIT-CLIENT] Received phone audio chunks
```

---

## 🎯 Why This Matters

**Twilio Device mode** requires:
- Twilio Device SDK initialized
- Twilio conference calls
- Different audio routing

**WebRTC mode** uses:
- LiveKit for audio
- Direct browser ↔ server audio
- The new CallSession state machine

**You MUST use WebRTC mode for the new call flow to work!**

---

## ✅ Checklist

Before testing:
- [ ] Open Screening Room
- [ ] **Check "Use WebRTC" checkbox**
- [ ] Open Phone Lines
- [ ] Open Host Dashboard (new tab)
- [ ] **Check "Use WebRTC" checkbox** (in Host Dashboard too)

Then test:
- [ ] Make call
- [ ] Screen call
- [ ] Approve call
- [ ] Join live room
- [ ] Put on air

---

## 🎉 Expected Results (With WebRTC Enabled)

- ✅ Can pick up calls (no error)
- ✅ Hear caller in screening
- ✅ Caller hears you (after CORS fix deploys)
- ✅ "On Air" button works
- ✅ Hear caller on air
- ✅ Caller hears you on air

---

**Enable WebRTC mode and test again! This is the missing step! ✅**


