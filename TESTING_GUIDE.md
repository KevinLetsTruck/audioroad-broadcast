# Complete System Testing Guide

## 🎯 What to Test

We just completed the full integration. Here's the systematic testing plan:

---

## Test 1: Basic Show Start/End (5 minutes)

### Steps:
1. Open Broadcast Control (fresh incognito window)
2. Should see correct show auto-selected
3. Enter Radio.co password (if not saved)
4. Click "START SHOW"
5. Watch for:
   - ✅ Timer starts counting (00:01, 00:02, etc.)
   - ✅ Microphone shows "Connected"
   - ✅ Recording shows "Active"
   - ✅ Status shows "LIVE NOW"

6. Wait 10 seconds, verify timer keeps counting
7. Click "END SHOW"
8. Recording should download

**Expected:** Everything works smoothly, timer counts up

---

## Test 2: Navigation Persistence (5 minutes)

### Steps:
1. START SHOW (Broadcast Control)
2. Verify "LIVE NOW" status
3. Click "Host Dashboard" in navigation
4. Verify you see the episode
5. Click "Recordings" in navigation
6. Click "Broadcast Control" again
7. Should STILL show "LIVE NOW" ✅
8. Timer should still be counting ✅
9. Click "END SHOW"

**Expected:** State persists across all pages, timer never stops

---

## Test 3: Caller Volume Control (10 minutes)

### Steps:
1. START SHOW
2. Have someone call in (or call from your phone)
3. Screener picks up call
4. Screener approves and queues for host
5. Go to Host Dashboard
6. Click "Take Call"
7. Caller should appear in the call list
8. **Try adjusting the volume slider**
9. **Audio volume should actually change!** ✅
10. **Click mute button**
11. **Caller should actually be muted!** ✅

**Expected:** Volume controls actually work!

---

## Test 4: Multi-Page Call Management (10 minutes)

### Steps:
1. START SHOW
2. Go to Host Dashboard
3. Take a call
4. While on call, navigate to:
   - Broadcast Control (call should stay connected) ✅
   - Recordings (call should stay connected) ✅
   - Back to Host Dashboard (call still there) ✅
5. End the call from Host Dashboard
6. Call should cleanly disconnect

**Expected:** Call persists across ALL navigation!

---

## Test 5: Multiple Calls (15 minutes)

### Steps:
1. START SHOW
2. Have 2-3 people call in
3. Screener approves all of them
4. Go to Host Dashboard
5. Take Call #1
6. Adjust volume
7. Take Call #2 (while Call #1 is still on)
8. Both should show in Broadcast Control audio levels
9. Adjust volumes independently
10. End Call #1
11. Call #2 should stay connected
12. End Call #2

**Expected:** Multiple callers with independent volume control!

---

## Test 6: Complete Broadcast Workflow (20 minutes)

### Full Real-World Test:
1. **Pre-Show:**
   - Open app
   - Verify correct show selected
   - Radio.co password saved

2. **Start:**
   - Click START SHOW
   - Verify all systems active

3. **During Show:**
   - Caller calls in
   - Screener screens them
   - Screener approves
   - Host takes call
   - Adjust caller volume
   - Have conversation
   - Navigate between pages (verify call stays connected)
   - End call
   - Repeat with 2nd caller

4. **End:**
   - Click END SHOW
   - Recording downloads
   - Check Recordings page shows the episode

**Expected:** Smooth professional workflow!

---

## Common Issues to Watch For

### ❌ If Timer Stuck at 00:00:00
**Check:** Browser console for timer logs
**Fix:** Refresh browser (Cmd+Shift+R)

### ❌ If Mic Shows Disconnected (but works)
**Check:** Browser console - look for "Added audio source: Host Microphone"
**Note:** This is a display issue, audio still works

### ❌ If Volume Sliders Don't Work
**Check:** Console for "[CALL] Adding to mixer"
**Fix:** Make sure you started show from Broadcast Control first

### ❌ If Navigation Disconnects Call
**Check:** Console for "Twilio Device" cleanup messages
**Fix:** This means old code is cached - hard refresh

### ❌ If Calls Drop Randomly
**Check:** Multiple "Twilio Device ready" messages
**Fix:** Only ONE device should initialize

---

## Success Criteria

### Must Work:
- ✅ START SHOW initializes everything
- ✅ Timer counts up
- ✅ Calls connect
- ✅ Volume sliders affect audio
- ✅ Navigation doesn't disconnect
- ✅ END SHOW cleans up properly

### Should Work:
- Recording downloads with correct filename
- Status indicators accurate
- Multiple callers supported
- Mute buttons work

### Nice to Have:
- Radio.co streaming (if password entered)
- Recordings page shows episodes
- Show auto-selection accurate

---

## Quick Test Command

**Fastest way to verify it's working:**

1. START SHOW
2. Check timer counting: 00:01, 00:02... ✅
3. Click Host Dashboard ✅
4. Click Broadcast Control ✅  
5. Still says "LIVE NOW" ✅
6. END SHOW ✅

**If those 6 things work, the integration is successful!**

---

## When You Find a Bug

**Do this:**
1. Note exactly what you did
2. Check browser console (F12)
3. Copy the error messages
4. Tell me and I'll fix it!

**Don't worry if there are small bugs** - we'll squash them together!

---

## After Testing

Once everything works, we'll:
1. Remove debug logging
2. Polish the UI
3. Deploy to production
4. **Delete Audio Hijack!** 🎉

---

**Ready to test?** Start with Test #1 (Basic Show Start/End) and let me know how it goes! 🚀

