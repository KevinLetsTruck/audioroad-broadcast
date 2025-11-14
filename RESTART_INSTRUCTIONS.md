# 🔄 Restart Instructions - IMPORTANT!

**Date:** November 14, 2025, 7:05 PM

---

## ⚠️ You Need to Refresh Your Browser!

The frontend code was updated but your browser is still running the old code.

### Steps to Fix:

1. **Hard Refresh Both Browser Tabs:**
   - **Chrome/Edge:** `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
   - **Safari:** `Cmd+Option+R`
   - **Or:** Open DevTools → Right-click refresh button → "Empty Cache and Hard Reload"

2. **Verify the Fix:**
   - After refreshing, open browser console
   - Click "On Air" button
   - The error should now be on a different line number (60-65 instead of 55)
   - Or better yet, it should show the new error: "Please join the live room first..."

---

## 🎯 Full Testing Procedure (After Refresh):

### Step 1: Refresh Everything
```bash
# Both browser tabs:
- Screening Room: Cmd+Shift+R
- Host Dashboard: Cmd+Shift+R
```

### Step 2: Open Phone Lines
- In Screening Room
- Click "Open Phone Lines"
- Make a test call

### Step 3: Screen the Call
- Click "Screen" button
- **Check:** Do you hear audio? (This should work now!)

### Step 4: Approve to Live
- Click "Approve to Live"
- Call moves to Host Dashboard

### Step 5: Host Joins Live Room
- In Host Dashboard
- Click "Join Live Room" button
- Grant microphone permissions
- Wait for "Connected to LiveKit" message

### Step 6: Put On Air
- Click "On Air" button
- **Should work now!**

---

## 🐛 If Audio Still Doesn't Work

The audio routing fix requires checking server logs. 

**What to look for:**

```bash
# Good signs (audio working):
✅ [CALL-FLOW] Moved call X to screening room: screening-...
🔄 [MEDIA-BRIDGE] Moving stream from lobby to screening-...
✅ [MEDIA-BRIDGE] Stream moved to screening-...

# Bad signs (audio not working):
❌ [MEDIA-BRIDGE] Room mapping mismatch!
❌ [CALL-FLOW] Failed to move stream to screening room
```

**If you see bad signs:**
1. The `moveStreamToRoom` method might be failing
2. Check if `call.twilioCallSid` exists
3. Check if `mediaBridge` is initialized

---

## 📊 Current Status

### Frontend ✅
- Vite restarted
- ParticipantBoard.tsx updated
- Changes should be live after hard refresh

### Backend ✅
- Server restarted
- CallFlowService updated with room moves
- LiveKit initialized

### What's Left:
- **You need to hard refresh browser**
- **Then test the full flow**

---

## 🚀 Quick Test Commands

```bash
# Check if servers are running:
curl http://localhost:3001/api/health
curl http://localhost:3001/api/webrtc/health

# Should both return status: "ok"
```

---

## 💡 Why This Happened

1. **Frontend:** Vite hot-reload sometimes doesn't catch all changes, especially in components with complex state
2. **Audio:** The `CallFlowService` wasn't calling `moveStreamToRoom()` when transitioning states, so audio stayed in the `lobby` room

Both are now fixed, but you need to hard refresh to get the new frontend code!

---

**Hard refresh both tabs and try again! 🔄**

