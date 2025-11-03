# Audio On Hold - Current Status & Fixes

**Date:** November 3, 2025  
**Priority:** CRITICAL - Blocking testing and use of app

---

## Current Status

### ✅ WORKING:
1. **24/7 Auto DJ stream** - Playing correctly at normal speed
2. **Audio on hold (initial)** - Callers hear audio while waiting for screener
3. **Caller audio quality** - Clear, not distorted

### ⚠️ FIXED (Deploying Now):
1. **Live stream delay** - Was taking 1+ minute to switch
2. **Overlapping audio** - Auto DJ + live stream both playing

### 🔴 REMAINING ISSUE:
1. **Audio stops after screener transfer** - Caller loses audio when moved to host queue

---

## What Just Got Fixed

### Issue #1 & #2: Live Switching Delay + Overlapping Audio

**Problem:**
```
User starts broadcast
  ↓
Auto DJ keeps playing for 60+ seconds
  ↓
Live audio eventually comes through
  ↓
BOTH play together (overlapping)
```

**Root Cause:**
- Auto DJ was stopped AFTER switching HLS mode
- Buffered Auto DJ chunks piled up (60+ seconds worth)
- Live audio queued behind them
- Eventually both played together

**Fix Applied:**
```javascript
// NEW ORDER:
1. Stop Auto DJ FFmpeg immediately
2. Wait 500ms for audio buffer to drain
3. Switch HLS to live mode  
4. Live audio flows immediately (no delay!)
```

**Expected Result:**
- Live stream switches in ~1 second (not 60+)
- No overlapping audio
- Clean transition Auto DJ → Live

---

## Remaining Issue #3: Audio Stops After Screener Transfer

### What Should Happen:
```
Caller waits (hearing Auto DJ) ✅
  ↓
Screener picks up ✅
  ↓
Screener approves for host queue
  ↓
Screener leaves conference
  ↓
Caller STAYS in conference ✅ (startConferenceOnEnter=true)
  ↓
Caller continues hearing waitUrl audio ✅
  ↓
Host joins → Caller goes live ✅
```

### What's Happening:
```
From logs:
- Caller approved at 17:29:57
- Conference ends at 17:30:07 (10 seconds later!)
- Caller disconnected
```

### Possible Causes:

**A. Frontend Auto-Ends Episode**
When you stop broadcasting, the frontend might still be calling "End Episode" somewhere, which:
- Ends the conference
- Disconnects all callers
- Even though we fixed line 585, there might be another place

**B. Screener Workflow Issue**
The screener's UI might have a button/action that:
- "Ends screening"
- Accidentally triggers episode end
- Disconnects caller

**C. Conference Configuration**
Even with `startConferenceOnEnter="true"` and `endConferenceOnExit="false"`, Twilio might be ending the conference due to:
- Timeout settings
- Participant state conflicts
- Conference region/settings

---

## Testing Plan

### After Deployment (5 Minutes):

**Test 1: Live Switching (Issues #1 & #2)**
```
1. Open stream URL in browser (Auto DJ playing)
2. Start broadcast
3. EXPECTED: Stream switches to live in ~1 second
4. EXPECTED: Only live audio (no Auto DJ overlap)
5. Stop broadcast  
6. EXPECTED: Stream switches back to Auto DJ in ~1 second
```

**Test 2: Phone Caller Flow (Issue #3)**
```
1. Start a broadcast (go live)
2. Call into the show
3. Wait → Should hear live audio ✅
4. Screener picks up → Talk ✅
5. Screener approves for host queue
6. **WATCH RAILWAY LOGS** for:
   - "Call approved"
   - "Conference ended" (should NOT see this!)
7. CRITICAL: Caller should keep hearing audio
8. Don't stop broadcast yet
9. Can caller still hear audio? (This tells us if it's the transfer or the broadcast stop)
```

---

## Debugging Steps for Issue #3

If audio still stops after transfer, check logs for:

### **If you see:**
```
📴 [EPISODE] Ending episode
🎙️ [CONFERENCE] Ending conference
```
**Problem:** Something is still calling episode end API

### **If you see:**
```
📞 [CONFERENCE] Event: conference-end
```
**Problem:** Twilio is ending the conference (not us)

### **If you see:**
```
⚠️ [CACHED-CHUNK] Cache empty
```
**Problem:** audioCache stopped working

Send me the exact log output from the moment screener approves through when audio stops, and I'll identify the exact cause!

---

## Summary

**Deployed Fixes:**
- ✅ Stop Auto DJ before switching (fixes delay)
- ✅ 500ms drain time (prevents overlap)
- ✅ arealtime filter on Auto DJ (correct speed)
- ✅ Episode stays live when broadcast stops (main app)

**Remaining:**
- ⚠️ Need to test and debug conference ending issue

**ETA:** 5 minutes for deployment, then test!

---

## What to Do Right Now

1. **Wait 5 minutes** for Railway to deploy both services
2. **Test live switching** (should be fast and clean now!)
3. **Test phone caller flow** with logs open
4. **Share the logs** from the moment of screener approval if audio stops

We're very close! The live switching should be perfect now. 🎯

