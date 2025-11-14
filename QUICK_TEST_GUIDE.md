# Quick Test Guide - 5 Minute Smoke Test

## 🚀 Fast Track Testing (5 minutes)

### Setup (30 seconds)
```bash
# Verify servers are running
curl http://localhost:3001/api/health
open http://localhost:5173
```

### Test Flow (4 minutes)

#### 1️⃣ Call In (30 sec)
- Open Screening Room: `http://localhost:5173/screening-room`
- Click "Open Phone Lines"
- Call your Twilio number from your phone
- ✅ **PASS:** Call appears in "Incoming Calls" within 3 seconds

#### 2️⃣ Screen (30 sec)
- Click "Screen" button
- ✅ **PASS:** Call moves to "Screening" section
- ✅ **PASS:** You can hear caller, caller can hear you

#### 3️⃣ Approve (30 sec)
- Click "Approve to Live"
- Open Host Dashboard: `http://localhost:5173/host-dashboard`
- ✅ **PASS:** Call appears in "On Hold" section

#### 4️⃣ On Air (1 min)
- Click "Join Live Room" (if needed)
- Click "On Air" button
- ✅ **PASS:** Call moves to "On Air" section
- ✅ **PASS:** Bidirectional audio works (speak and listen)

#### 5️⃣ Hold (30 sec)
- Click "Hold" button
- ✅ **PASS:** Call moves back to "On Hold"
- ✅ **PASS:** Caller can hear you, you can't hear caller

#### 6️⃣ End (30 sec)
- Click "End Call"
- ✅ **PASS:** Call disappears from UI
- ✅ **PASS:** Phone call ends

---

## ✅ Quick Checklist

**Before Testing:**
- [ ] Backend running on :3001
- [ ] Frontend running on :5173
- [ ] Database has `CallSession` table
- [ ] Phone ready to make test call

**Core Flow:**
- [ ] Call appears in UI
- [ ] Can screen caller
- [ ] Can approve to live
- [ ] Can put on air
- [ ] Can put on hold
- [ ] Can end call

**Audio:**
- [ ] Caller → Browser works
- [ ] Browser → Caller works
- [ ] No echo or distortion

---

## 🐛 Quick Troubleshooting

**Call doesn't appear:**
```bash
# Check server logs
# Look for: "✅ [CALL-FLOW] State machine initialized"
# Look for: "📞 Incoming call from: +1XXX"
```

**No audio:**
```bash
# Check browser console
# Look for: "✅ [WEBRTC] Local audio stream ready"
# Grant microphone permissions if prompted
```

**500 errors:**
```bash
# Re-sync database
cd /Users/kr/Development/audioroad-broadcast
npx prisma db push
# Restart servers
```

---

## 📊 What to Check in Logs

### Server Logs (Good Signs)
```
✅ [CALL-FLOW] State machine initialized (0 sessions loaded)
📞 Incoming call from: +14073839145
✅ [MEDIA-STREAM] Call bridged to room: lobby
✅ [CALL-FLOW] Transition: incoming → screening
📊 [MEDIA-BRIDGE] Packets: 1000 received, 987 played
```

### Browser Console (Good Signs)
```
✅ [HOST] Loaded episode from context
✅ [CHAT] Successfully joined episode room
call:updated { call: {...}, session: {...} }
✅ [WEBRTC] Local audio stream ready
```

---

## 🎯 Pass/Fail Criteria

**PASS = Ship it! 🚀**
- All 6 core flow steps work
- Audio is clear in both directions
- No errors in console or logs

**FAIL = Fix first! 🔧**
- Call doesn't appear in UI
- Audio is silent or distorted
- 500 errors on API calls
- Socket.IO disconnects

---

**Full test procedure:** See `MANUAL_TEST_PROCEDURE.md`

