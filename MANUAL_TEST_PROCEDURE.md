# Manual Test Procedure - Call Flow State Machine

**Date:** November 14, 2025  
**Testing:** New CallSession state machine and call flow refactor

---

## ✅ Pre-Test Checklist

- [x] Database schema synced (`CallSession` table exists)
- [x] Backend running on `http://localhost:3001`
- [x] Frontend running on `http://localhost:5173`
- [x] Vite proxy configured for `/api` and `/socket.io`
- [ ] Twilio phone number configured in `.env`
- [ ] LiveKit credentials configured in `.env`

**Verify servers are running:**
```bash
# Backend health check
curl http://localhost:3001/api/health

# Frontend should be accessible
open http://localhost:5173
```

---

## 🧪 Test 1: Incoming Call Registration

**Goal:** Verify that when a caller dials in, the call appears in the UI with correct state.

### Steps:

1. **Open the Screening Room**
   - Navigate to `http://localhost:5173/screening-room`
   - Sign in if prompted
   - Click "Open Phone Lines" for your active episode

2. **Place a test call**
   - From your mobile phone, call your Twilio number
   - Listen for the AI greeting

3. **Expected Results:**
   - ✅ Call appears in the "Incoming Calls" section within 2-3 seconds
   - ✅ Caller name/location displays (from Twilio lookup)
   - ✅ Call shows phase: `INCOMING`
   - ✅ Current room shows: `lobby`
   - ✅ Send Muted: `Yes` | Recv Muted: `No`

4. **Check browser console:**
   - Should see: `📡 [HOST] Loaded episode from context`
   - Should see: `call:updated` event with session data
   - Should NOT see: 500 errors on `/api/calls`

5. **Check server logs:**
   - Should see: `✅ [CALL-FLOW] State machine initialized`
   - Should see: `📞 Incoming call from: +1XXX`
   - Should see: `✅ [MEDIA-STREAM] Call bridged to room: lobby`

---

## 🧪 Test 2: Start Screening

**Goal:** Verify screener can pick up the call and communicate with caller.

### Steps:

1. **In Screening Room, click "Screen" on the incoming call**

2. **Expected Results:**
   - ✅ Call moves from "Incoming" to "Screening" section
   - ✅ Phase changes to: `SCREENING`
   - ✅ Current room changes to: `screening-{episodeId}-{callId}`
   - ✅ Send Muted: `Yes` | Recv Muted: `No`

3. **Enable your microphone (if using WebRTC mode):**
   - Click "Join Room" or enable WebRTC toggle
   - Grant microphone permissions

4. **Test audio:**
   - Speak into your computer mic
   - Caller should hear you on their phone
   - You should hear caller through computer speakers

5. **Check server logs:**
   - Should see: `🔌 [WEBRTC] Joining screening room`
   - Should see: `📡 [LIVEKIT] Token generated for screening room`
   - Should see: `📞 [BROWSER→PHONE] Received audio packets`

---

## 🧪 Test 3: Approve Call to Live (On Hold)

**Goal:** Verify call can be approved and moved to live room in muted state.

### Steps:

1. **In Screening Room, fill out caller info:**
   - Add topic/notes if desired
   - Click "Approve to Live"

2. **Expected Results:**
   - ✅ Call moves to "On Hold" section (or disappears from Screening Room)
   - ✅ Phase changes to: `LIVE_MUTED`
   - ✅ Current room changes to: `live-{episodeId}`
   - ✅ Send Muted: `Yes` | Recv Muted: `No`

3. **Open Host Dashboard in a new tab:**
   - Navigate to `http://localhost:5173/host-dashboard`
   - Should see the approved call in "On Hold" section

4. **Check server logs:**
   - Should see: `✅ [CALL-FLOW] Transition: screening → live_muted`
   - Should see: `🔌 [LIVEKIT] Moving participant to live room`

---

## 🧪 Test 4: Put Caller On Air

**Goal:** Verify host can unmute caller and they go live.

### Steps:

1. **In Host Dashboard, ensure you're connected to the live room:**
   - Click "Join Live Room" if not already connected
   - Grant microphone permissions

2. **Click "On Air" button for the caller**

3. **Expected Results:**
   - ✅ Call moves from "On Hold" to "On Air" section
   - ✅ Phase changes to: `LIVE_ON_AIR`
   - ✅ Current room stays: `live-{episodeId}`
   - ✅ Send Muted: `No` | Recv Muted: `No`

4. **Test bidirectional audio:**
   - Host speaks → Caller hears on phone
   - Caller speaks → Host hears in browser
   - Both should hear each other clearly

5. **Check server logs:**
   - Should see: `✅ [CALL-FLOW] Transition: live_muted → live_on_air`
   - Should see: `🔊 [MEDIA-BRIDGE] Unmuting participant`

---

## 🧪 Test 5: Put Caller On Hold (Mute)

**Goal:** Verify host can mute caller during live show.

### Steps:

1. **In Host Dashboard, click "Hold" button for the on-air caller**

2. **Expected Results:**
   - ✅ Call moves from "On Air" back to "On Hold" section
   - ✅ Phase changes to: `LIVE_MUTED`
   - ✅ Current room stays: `live-{episodeId}`
   - ✅ Send Muted: `Yes` | Recv Muted: `No`

3. **Test audio:**
   - Caller can still hear host
   - Host cannot hear caller (caller is muted)

4. **Check server logs:**
   - Should see: `✅ [CALL-FLOW] Transition: live_on_air → live_muted`
   - Should see: `🔇 [MEDIA-BRIDGE] Muting participant`

---

## 🧪 Test 6: Return to Screening

**Goal:** Verify host can send caller back to screening room.

### Steps:

1. **In Host Dashboard, click "Screen" button for the on-hold caller**

2. **Expected Results:**
   - ✅ Call disappears from Host Dashboard
   - ✅ Call reappears in Screening Room (if still open)
   - ✅ Phase changes to: `SCREENING`
   - ✅ Current room changes back to: `screening-{episodeId}-{callId}`
   - ✅ Send Muted: `Yes` | Recv Muted: `No`

3. **Check server logs:**
   - Should see: `✅ [CALL-FLOW] Transition: live_muted → screening`
   - Should see: `🔌 [LIVEKIT] Moving participant back to screening room`

---

## 🧪 Test 7: Complete Call

**Goal:** Verify call can be ended cleanly from any state.

### Steps:

1. **From either Screening Room or Host Dashboard, click "End Call"**

2. **Expected Results:**
   - ✅ Call disappears from UI immediately
   - ✅ Phone call ends (caller hears disconnect tone)
   - ✅ Phase changes to: `DISCONNECTED`
   - ✅ Database record updated with end time

3. **Check server logs:**
   - Should see: `✅ [CALL-FLOW] Call completed: {callId}`
   - Should see: `🔌 [MEDIA-STREAM] Stream stopped`
   - Should see: `🔌 [LIVEKIT] Participant removed from room`

4. **Verify in Prisma Studio:**
   - Open `http://localhost:5555`
   - Check `CallSession` table
   - Should see one row with `phase = disconnected`

---

## 🧪 Test 8: Multiple Simultaneous Callers

**Goal:** Verify system can handle multiple callers in different states.

### Steps:

1. **Place 3 test calls from different phones (or use Twilio test numbers)**

2. **Move callers through different states:**
   - Caller 1: Leave in "Incoming"
   - Caller 2: Move to "Screening"
   - Caller 3: Approve to "On Hold"

3. **Expected Results:**
   - ✅ All 3 calls visible in appropriate sections
   - ✅ Each has unique `callId` and `currentRoom`
   - ✅ No cross-talk between callers
   - ✅ UI updates independently for each caller

4. **Put Caller 3 on air, then end all calls:**
   - Verify each ends independently
   - Verify UI updates correctly for each

---

## 🧪 Test 9: Edge Case - Caller Hangs Up

**Goal:** Verify system handles unexpected disconnections gracefully.

### Steps:

1. **Place a test call and move to screening**

2. **Hang up from the phone (caller side)**

3. **Expected Results:**
   - ✅ Call disappears from UI within 5 seconds
   - ✅ Server logs show: `📞 [MEDIA-STREAM] Stream stopped`
   - ✅ No errors or crashes
   - ✅ `CallSession` updated to `disconnected`

---

## 🧪 Test 10: Edge Case - Browser Refresh

**Goal:** Verify UI recovers state after refresh.

### Steps:

1. **Place a test call and move to "On Hold"**

2. **Refresh the Host Dashboard page (Cmd+R / Ctrl+R)**

3. **Expected Results:**
   - ✅ Call reappears in "On Hold" section after page loads
   - ✅ All state (phase, room, mute status) is correct
   - ✅ Can still interact with call (put on air, end, etc.)

4. **Check browser console:**
   - Should see: `📡 [HOST] Loaded episode from context`
   - Should see: `call:updated` events populating state

---

## 🧪 Test 11: Socket.IO Connection

**Goal:** Verify real-time updates work correctly.

### Steps:

1. **Open Host Dashboard in one browser tab**
2. **Open Screening Room in another tab (same browser)**

3. **Place a test call**

4. **Expected Results:**
   - ✅ Call appears in BOTH tabs simultaneously
   - ✅ When screener clicks "Approve", host sees it move to "On Hold" instantly
   - ✅ When host clicks "On Air", screener sees it disappear instantly
   - ✅ No polling delays (updates should be < 500ms)

5. **Check browser console (both tabs):**
   - Should see: `✅ [CHAT] Successfully joined episode room`
   - Should see: `call:updated` events in both tabs

---

## 🧪 Test 12: WebRTC Audio Quality

**Goal:** Verify audio is clear and low-latency.

### Steps:

1. **Place a test call and move to screening**

2. **Have a conversation with the caller:**
   - Count to 10 slowly
   - Ask caller to repeat back
   - Listen for echo, distortion, or delay

3. **Expected Results:**
   - ✅ Audio is clear (no distortion)
   - ✅ Latency < 500ms (conversational)
   - ✅ No echo or feedback
   - ✅ No dropped packets (check server logs)

4. **Check server logs:**
   - Should see: `📊 [MEDIA-BRIDGE] Jitter: ~1-2ms avg`
   - Should see: `Loss: 0 late, 0 dropped` (or very low)

---

## 📊 Success Criteria

**All tests must pass for deployment:**

- [ ] Test 1: Incoming call registration ✅
- [ ] Test 2: Start screening ✅
- [ ] Test 3: Approve to live ✅
- [ ] Test 4: Put on air ✅
- [ ] Test 5: Put on hold ✅
- [ ] Test 6: Return to screening ✅
- [ ] Test 7: Complete call ✅
- [ ] Test 8: Multiple callers ✅
- [ ] Test 9: Caller hangup ✅
- [ ] Test 10: Browser refresh ✅
- [ ] Test 11: Socket.IO updates ✅
- [ ] Test 12: Audio quality ✅

---

## 🐛 Known Issues to Watch For

1. **WebSocket "Invalid frame header"**
   - Cause: Vite proxy not configured
   - Fix: Already fixed in `vite.config.ts`

2. **500 errors on `/api/calls`**
   - Cause: `CallSession` table missing
   - Fix: Already fixed with `prisma db push`

3. **Call doesn't appear in UI**
   - Check: Server logs for `call:updated` event emission
   - Check: Browser console for Socket.IO connection
   - Check: Database for `CallSession` row

4. **No audio (caller → browser)**
   - Check: LiveKit room name matches `currentRoom` in session
   - Check: Server logs for `📡 [LIVEKIT] First audio packet`
   - Check: Browser granted microphone permissions

5. **No audio (browser → caller)**
   - Check: Server logs for `📞 [BROWSER→PHONE] Received audio packets`
   - Check: Twilio Media Stream is connected
   - Check: `sendMuted` is `false` in session

---

## 📝 Test Results Log

**Tester:** _________________  
**Date:** _________________  
**Environment:** Local Development

| Test # | Test Name | Pass/Fail | Notes |
|--------|-----------|-----------|-------|
| 1 | Incoming call | ⬜ | |
| 2 | Start screening | ⬜ | |
| 3 | Approve to live | ⬜ | |
| 4 | Put on air | ⬜ | |
| 5 | Put on hold | ⬜ | |
| 6 | Return to screening | ⬜ | |
| 7 | Complete call | ⬜ | |
| 8 | Multiple callers | ⬜ | |
| 9 | Caller hangup | ⬜ | |
| 10 | Browser refresh | ⬜ | |
| 11 | Socket.IO updates | ⬜ | |
| 12 | Audio quality | ⬜ | |

---

## 🚀 Next Steps After Testing

1. **If all tests pass:**
   - Document any minor issues found
   - Prepare for Railway deployment
   - Run migration on Railway database
   - Smoke test on production

2. **If tests fail:**
   - Document exact failure scenario
   - Capture server logs and browser console
   - Create GitHub issue with reproduction steps
   - Fix and retest

---

**Good luck with testing! 🎉**

