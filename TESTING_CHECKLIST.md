# WebRTC Testing Checklist

Quick reference for testing your WebRTC broadcast system.

---

## Pre-Flight Check

Before testing, verify:

- [ ] Janus Gateway deployed and running
- [ ] `JANUS_WS_URL` set on backend
- [ ] `VITE_JANUS_WS_URL` set on frontend
- [ ] Main app redeployed with new variables
- [ ] Twilio phone number configured
- [ ] Twilio webhook pointing to your server

---

## Quick Test (5 minutes)

**What you need:**
- Host dashboard open
- Your phone

**Steps:**
1. Start live show
2. Call your number
3. See call appear in queue
4. ✅ **Success:** Call appears, audio connects

---

## Full Flow Test (15 minutes)

**What you need:**
- Host dashboard
- Screener page
- Your phone

### Test Sequence

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Start live show | Show status: LIVE | ⬜ |
| 2 | Call Twilio number | Call appears in queue | ⬜ |
| 3 | Pick up (screener) | Call status: screening | ⬜ |
| 4 | Talk to caller | Two-way audio works | ⬜ |
| 5 | Approve call | Call appears in host queue | ⬜ |
| 6 | Put on air (host) | Call status: ON AIR | ⬜ |
| 7 | Talk with caller | Two-way audio works | ⬜ |
| 8 | Put on hold | Call status: ON HOLD | ⬜ |
| 9 | Put on air AGAIN | Call status: ON AIR (again!) | ⬜ |
| 10 | Repeat 8-9 | Works every time! | ⬜ |

### Success Criteria

✅ **Basic Success:** Steps 1-7 work  
✅ **Core Success:** Steps 1-9 work  
🎉 **Full Success:** Step 10 works (infinite toggles!)

---

## Audio Quality Check

### Listen for:

**Good Audio:**
- Clear voice
- No pops or clicks
- No delay (< 200ms)
- No echo

**Bad Audio:**
- Robotic/choppy
- Frequent dropouts
- Long delay (> 500ms)
- Echo or feedback

### Check Stats:

Look for in logs:
```
📊 [MEDIA-BRIDGE] ... - 10.0s
   Packets: 500 received, 498 played
   Jitter: 2.35ms avg, buffer: 5/5
   Loss: 2 late, 0 dropped
```

**Target Stats:**
- Jitter: < 10ms ✅
- Packet loss: < 1% ✅
- Buffer: Near target (5) ✅

---

## WebRTC vs Twilio Comparison

Test both modes if possible:

| Feature | Twilio Mode | WebRTC Mode |
|---------|-------------|-------------|
| On air toggle | 1x only | ♾️ Infinite |
| Hold toggle | 1x only | ♾️ Infinite |
| Back to screening | ❌ Breaks | ✅ Works |
| Audio quality | Good | Good |
| Latency | ~100ms | ~50-100ms |
| Setup | Easy | Needs Janus |

---

## Troubleshooting Quick Fixes

### No audio from caller

**Quick Fix:**
1. Check caller's phone isn't muted
2. Check Media Bridge logs
3. Verify Twilio webhook is working

### Can't put on air multiple times

**This means WebRTC isn't working!**

**Quick Fix:**
1. Check `JANUS_WS_URL` is set
2. Check Janus is running
3. Check browser console for errors

### Audio is choppy

**Quick Fix:**
1. Check network connection
2. Check jitter stats (should be < 10ms)
3. Increase jitter buffer size

---

## Edge Case Tests

After basic flow works:

### Test 1: Caller Hangs Up

- [ ] During screening
- [ ] While on hold
- [ ] While on air
- [ ] Should clean up gracefully

### Test 2: Browser Refresh

- [ ] Refresh host dashboard
- [ ] Refresh screener page
- [ ] Should reconnect
- [ ] Should restore state

### Test 3: Multiple Callers

- [ ] 2 callers at once
- [ ] 3 callers at once
- [ ] Should handle cleanly

### Test 4: Long Duration

- [ ] Keep call on air for 5+ minutes
- [ ] Audio should stay stable
- [ ] No memory leaks

---

## Performance Benchmarks

### Target Metrics

- **Latency:** < 200ms end-to-end
- **Jitter:** < 10ms average
- **Packet Loss:** < 1%
- **CPU Usage:** < 50% per caller
- **Memory:** < 100MB per caller

### Measure:

**Latency:**
1. Speak into phone
2. Time until you hear it in browser
3. Should be < 200ms

**Quality:**
1. Check jitter buffer stats
2. Target: < 10ms jitter, < 1% loss

---

## Sign-Off Checklist

Before going to production:

- [ ] ✅ Basic call flow works
- [ ] ✅ Infinite toggles work
- [ ] ✅ Audio quality is good
- [ ] ✅ Multiple callers work
- [ ] ✅ Hang up cleans up properly
- [ ] ✅ Logs show no errors
- [ ] ✅ Team trained on new workflow

---

## Emergency Rollback

If WebRTC doesn't work:

**Quick Rollback:**
1. Remove `JANUS_WS_URL` from environment
2. Redeploy main app
3. System falls back to Twilio conferences
4. Old workflow still works

**No data loss, no downtime!**

---

## Next Steps After Testing

**If tests pass:**
1. Document any custom configuration
2. Train your team
3. Plan production rollout
4. Consider optimization (Phase 6-7)

**If tests fail:**
1. Check deployment guide
2. Review logs for errors
3. Test one component at a time
4. Ask for help with specific error messages

---

**Start with "Quick Test" and work your way down!**

