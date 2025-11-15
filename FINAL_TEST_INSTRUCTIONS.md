# 🎯 Final Test Instructions - CRITICAL STEPS

**Date:** November 14, 2025, 10:45 PM  
**Status:** All fixes deployed, ready for final test

---

## 🚨 CRITICAL: You MUST Make a FRESH Call!

**The Problem:**
You keep reusing old calls that are already in the wrong state (approved, in live room). The audio routing fixes only work for NEW calls that go through the proper flow.

**The Solution:**
1. **End ALL existing calls** (hang up, click "End Call" in UI)
2. **Wait 30 seconds** for cleanup
3. **Make a BRAND NEW call**
4. **Follow the flow from the beginning**

---

## ✅ What's Already Working

Based on your logs:

1. ✅ **Phone → Browser audio:** You're hearing the caller perfectly!
2. ✅ **Browser capturing audio:** Meter is maxing out
3. ✅ **Browser → Server:** Audio packets being sent and received
4. ✅ **WebRTC mode:** Enabled and working
5. ✅ **"On Air" button:** Working (new log message appeared)
6. ✅ **Rate limits:** Increased (no more blocking)

---

## 🧪 **FRESH CALL TEST PROCEDURE**

### Step 1: Clean Slate
1. **End any existing calls** (hang up phone, click "End Call" in UI)
2. **Close both browser tabs**
3. **Wait 30 seconds**

### Step 2: Open Fresh Windows
1. **Open Screening Room** (new incognito window):
   ```
   https://audioroad-broadcast-production.up.railway.app/screening-room
   ```

2. **Open Host Dashboard** (new incognito window):
   ```
   https://audioroad-broadcast-production.up.railway.app/host-dashboard
   ```

### Step 3: Screening Room Setup
1. **✅ Check "Use WebRTC" checkbox**
2. **Click "Open Phone Lines"**
3. **Wait for confirmation**

### Step 4: Make FRESH Call
- **Call `+18888049791` from your phone**
- **Wait for AI greeting to finish**
- **Wait for call to appear in UI** (should be ~3 seconds)

### Step 5: Screen the Call
- **Click "Screen" button**
- **Grant microphone permissions if prompted**
- **Speak into your mic**
- **Expected:**
  - ✅ You hear caller
  - ✅ Caller hears you

### Step 6: Approve to Live
- **Click "Approve to Live"**
- **Call should move to Host Dashboard**

### Step 7: Host Joins
- **In Host Dashboard:**
  - **✅ Check "Use WebRTC" checkbox**
  - **Click "Join Live Room"**
  - **Grant microphone permissions**
  - **Wait for "Connected to LiveKit" message**

### Step 8: Put On Air
- **Click "On Air" button**
- **Speak into your mic**
- **Expected:**
  - ✅ You hear caller
  - ✅ Caller hears you

---

## 🔍 What to Check in Server Logs

After you click "Screen" on the FRESH call, the Railway logs should show:

```
✅ [CALL-FLOW] Moved call X to screening room: screening-cmhz6vqlk0001oqc1p3651915-NEWCALLID
🔄 [MEDIA-BRIDGE] Moving stream from lobby to screening-...
✅ [MEDIA-BRIDGE] Stream moved to screening-...
```

**If you see those messages, audio will work!**

**If you DON'T see those messages:**
- The backend code hasn't fully deployed yet
- Wait another 5 minutes and try again

---

## ❌ Common Mistakes to Avoid

### Mistake 1: Reusing Old Calls
**Don't:** Click "Screen" on a call that was already approved
**Do:** Make a fresh call and screen it immediately

### Mistake 2: Forgetting WebRTC Checkbox
**Don't:** Leave "Use WebRTC" unchecked
**Do:** Check the box BEFORE opening phone lines

### Mistake 3: Not Waiting for Cleanup
**Don't:** Make a new call immediately after ending one
**Do:** Wait 30 seconds between calls

### Mistake 4: Testing Too Fast
**Don't:** Click buttons rapidly or refresh constantly
**Do:** Wait for each step to complete before moving to next

---

## 📊 Expected vs Actual

### What SHOULD Happen (Fresh Call):

```
1. Call comes in → Audio in lobby
2. Click "Screen" → Audio moves to screening-X-Y
3. You join screening-X-Y → Audio works both ways ✅
4. Click "Approve" → Audio moves to live-X
5. Host joins live-X → Audio ready
6. Click "On Air" → Audio works both ways ✅
```

### What's BEEN Happening (Old Calls):

```
1. Call was already approved → Audio in live-X
2. You sent it back to screening → Database updated
3. But audio stream stayed in live-X ❌
4. You joined screening-X-Y → No audio (wrong room)
```

---

## 🎯 Success Criteria

**After the fresh call test, you should have:**

- [ ] Heard caller in screening room
- [ ] Caller heard you in screening room
- [ ] Successfully approved to live
- [ ] Host joined live room
- [ ] "On Air" button worked (no error)
- [ ] Heard caller on air
- [ ] Caller heard you on air

**If ALL of those work, we're done! 🎉**

---

## 🐛 If Audio Still Doesn't Work

**Check:**
1. Did you make a FRESH call? (not reuse old one)
2. Did you enable WebRTC mode? (checkbox checked)
3. Did you wait for deployment? (14 minutes ago = deployed)
4. Did you hard refresh browser? (`Cmd+Shift+R`)

**Then check server logs for:**
```
✅ [CALL-FLOW] Moved call X to screening room
```

**If that message is missing:**
- The `/api/calls/:id/screen` endpoint isn't calling `CallFlowService.startScreening()`
- Or the `moveStreamToRoom()` is failing silently

---

## 🚀 DO THIS NOW:

1. **End all existing calls**
2. **Close browser tabs**
3. **Wait 30 seconds**
4. **Open fresh incognito windows**
5. **Enable WebRTC mode**
6. **Make a FRESH call**
7. **Test the full flow**

---

**The code is deployed. The audio pipeline works. You just need a fresh call to test it properly! 🎉**


