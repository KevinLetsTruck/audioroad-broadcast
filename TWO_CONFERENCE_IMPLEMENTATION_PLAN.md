# Two-Conference System - Detailed Implementation Plan

## Status: Database Ready, Implementation Paused

**What's Done:**
- ✅ Database schema updated with conference tracking fields
- ✅ Conference naming utilities created
- ✅ Previous broken implementation rolled back

**What's Needed:**
Step-by-step implementation with testing at each stage.

---

## Remaining Steps (4-6 hours)

### Phase 1: Core Routing (2 hours)

**Step 1:** Update `server/routes/twilio.ts` - welcome-message endpoint
```typescript
// Route incoming callers to SCREENING conference
const screeningConference = getScreeningConferenceName(episode.id);
dial.conference({...options}, screeningConference);
```

**Step 2:** Update `server/routes/twilio.ts` - voice endpoint  
```typescript
if (role === 'screener') {
  conferenceName = getScreeningConferenceName(episodeId);
} else if (role === 'host') {
  conferenceName = getLiveConferenceName(episodeId);
}
```

**Step 3:** Test basic routing
- Call in → Verify joins screening-{id}
- Screener picks up → Verify joins screening-{id}
- Host starts show → Verify joins live-{id}

### Phase 2: Conference Movement (2 hours)

**Step 4:** Implement `moveParticipantToLiveConference()` in conferenceService.ts
```typescript
1. Get participant from SCREENING conference
2. Remove from SCREENING
3. Add to LIVE conference with hold: false, muted: true
4. Update call.currentConferenceType = 'live'
```

**Step 5:** Update `server/routes/calls.ts` - approve endpoint
```typescript
// After approving, move to LIVE conference
await moveParticipantToLiveConference(call.twilioCallSid, call.episodeId);
await prisma.call.update({
  where: { id },
  data: { currentConferenceType: 'live' }
});
```

**Step 6:** Test approval flow
- Screen caller → Approve → Verify moves to live-{id}
- Verify can hear host in live conference
- Verify screener still in screening conference

### Phase 3: Participant Operations (1 hour)

**Step 7:** Update `participantService.ts` - All operations
```typescript
// Determine conference based on call.currentConferenceType
const conference = call.currentConferenceType === 'screening'
  ? getScreeningConferenceName(call.episodeId)
  : getLiveConferenceName(call.episodeId);
```

**Step 8:** Update `server/routes/twilio-playback.ts`
```typescript
// Play opener/announcements to LIVE conference only
const liveConference = getLiveConferenceName(episodeId);
const participants = await twilioClient.conferences(liveConference).participants.list();
```

**Step 9:** Test on-air operations
- Put caller on air → Verify unmutes in live conference
- Mute/unmute → Verify works
- End call → Verify removes from correct conference

### Phase 4: Conference SID Tracking (1 hour)

**Step 10:** Update conference webhook handler
```typescript
if (event === 'conference-start') {
  // Determine if this is screening or live based on friendly name
  if (ConferenceSid.includes('screening-')) {
    episode.screeningConferenceSid = actualSid;
  } else if (ConferenceSid.includes('live-')) {
    episode.liveConferenceSid = actualSid;
  }
}
```

**Step 11:** Use actual SIDs instead of friendly names
```typescript
// Prefer actual SIDs from database over friendly names
const screeningSid = episode.screeningConferenceSid || getScreeningConferenceName(episodeId);
const liveSid = episode.liveConferenceSid || getLiveConferenceName(episodeId);
```

---

## Testing Protocol

After EACH phase, test:
1. Open phone lines
2. Make test call
3. Screen the call
4. Approve the call
5. Start show (if that phase)
6. Put on air (if that phase)
7. Verify audio routing
8. Close lines, clean up

**DO NOT PROCEED** to next phase until current phase works.

---

## Rollback Plan

If any phase breaks:
```bash
git revert HEAD
git push
```

Then fix the issue before continuing.

---

## Expected Results

When complete:
- ✅ Callers in screening: Hear ONLY screener
- ✅ Approved callers: Hear host + show + on-air callers
- ✅ Approved callers: CANNOT hear screener or other screenings
- ✅ Privacy 100% protected
- ✅ Professional broadcast experience

---

## Current State

- Database: ✅ Ready
- Code: ⏸️ Needs implementation (rolled back to stable)
- System: ✅ Working (single-conference mode)

**Ready to implement when you have 4-6 hours for careful, tested work.**

