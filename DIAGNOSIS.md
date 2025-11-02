# Diagnosis - Call Flow Issues

## Expected Flow:

1. **Caller dials in** → Joins conference (muted) → Hears waitUrl audio ✅
2. **Screener picks up** → Joins conference → Talks to caller ✅
3. **Screener approves** → Database updated to "approved" status → Screener stays or leaves
4. **Caller waits in queue** → STAYS in conference → Continues hearing waitUrl audio ✅
5. **Host joins** → Unmutes caller → Caller goes live ✅

## What's Actually Happening (from logs):

```
17:29:26 - Caller joins conference ✅
17:29:26 - WAIT-AUDIO called ✅
17:29:26 - CACHED-CHUNK delivered 160KB ✅ (caller hears audio)

17:29:40 - Screener joins conference ✅

17:29:57 - Call approved ✅
17:29:57 - Queue position: 1 ✅

17:30:07 - conference-end ❌ (10 seconds after approval!)
17:30:07 - participant-leave (screener)
17:30:07 - participant-leave (caller) ❌
```

## The Problem:

**The conference is ending 10 seconds after approval!**

## Possible Causes:

### A. Screener Disconnect Triggers Conference End
- Screener leaves after approving
- Even though caller has `startConferenceOnEnter="true"`, conference ends
- This shouldn't happen, but it is

### B. Frontend Auto-Ends Episode  
- When broadcast stops, frontend might call `/api/episodes/:id/end`
- This ends all calls and conference
- Disconnects waiting callers

### C. Both A and B

---

## Questions to Answer:

1. **Does the screener stay in conference after approving?**
   - If screener leaves immediately, caller is alone
   - Caller should keep conference alive with `startConferenceOnEnter="true"`
   - But conference is ending anyway

2. **Is the episode being ended automatically?**
   - When you stop broadcasting, does frontend call "End Episode"?
   - Or does it just stop the stream?

3. **What triggers the conference-end event?**
   - Twilio sends this when all participants with `endConferenceOnExit="true"` leave
   - OR when conference is manually ended via API

---

## Next Steps:

1. Check if screener is set to `endConferenceOnExit="false"`
2. Verify caller really has `startConferenceOnEnter="true"` (it's in code, but is it deployed?)
3. Check if frontend is calling "End Episode" when broadcast stops
4. Add logging to see WHO is ending the conference

Once we know which of A, B, or C is the issue, we can fix it quickly!

