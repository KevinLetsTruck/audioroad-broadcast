# Call Flow Diagnostics Guide

When calls behave erratically, use this guide to diagnose the issue.

## Quick Diagnostic Checklist

### Symptom: "Application Error" Message

**Most likely causes:**
1. Conference SID mismatch (using friendly name instead of actual SID)
2. Trying to operate on a conference that doesn't exist yet
3. Trying to operate on a participant who hasn't joined yet

**How to diagnose:**
- Check server logs for `❌ [TWILIO]` errors
- Look for `404` or `20404` error codes
- Check if episode has `twilioConferenceSid` in database

**Quick fix:**
- Wait 2-3 seconds after opening lines before taking calls
- Ensures conference is fully created and SID is in database

### Symptom: No Hold Music

**Most likely causes:**
1. `waitUrl` not configured when joining conference
2. Conference doesn't exist yet when trying to apply hold
3. Participant not actually "on hold" in Twilio

**How to diagnose:**
- Check server logs for `🎵 [WAIT-AUDIO] Serving hold music`
- If you don't see this log, waitUrl isn't being called
- Check if call has `isOnHold: true` in database

**Where hold music is configured:**
- `server/routes/twilio.ts` - welcome-message endpoint sets `waitUrl`
- `server/services/participantService.ts` - putOnHold() sets `holdUrl`

### Symptom: Calls Auto-Screening Without Button Click

**Most likely causes:**
1. Stale call records from previous session
2. Socket.IO events firing multiple times
3. Database records in wrong state

**How to diagnose:**
- Check if there are old calls in database from previous session
- Look for multiple Socket.IO events in console (`🔄 [SCREENER] Participant state changed`)

**Quick fix:**
- Close phone lines (this now cleans up stale calls)
- Reopen phone lines fresh
- First call should work normally

### Symptom: Silence After Greeting

**Most likely causes:**
1. Conference ended unexpectedly
2. WaitUrl not playing hold music
3. Participant marked as muted when they shouldn't be

**How to diagnose:**
- Check logs for `📴 [CONFERENCE] Conference ended`
- Check logs for `🎵 [WAIT-AUDIO] Serving hold music`
- Check participant's `muted` and `hold` status in Twilio

## Important Conference Concepts

### Conference Name vs. Conference SID

**Conference Name (Friendly Name):**
- Format: `episode-{episodeId}` (e.g., `episode-cmh123`)
- Used when CREATING conference via TwiML
- Stored in `call.twilioConferenceSid` field initially

**Conference SID (Actual ID):**
- Format: `CF...` (e.g., `CFbc3c3d3ac692dd68d9dd53f820583727`)
- Returned by Twilio after conference is created
- Stored in `episode.twilioConferenceSid` field
- **REQUIRED for all Twilio API operations**

**The Problem:**
- Some code was using friendly name for API calls
- Twilio API rejects friendly names with 404 error
- Must ALWAYS use actual SID from episode table

### Call States

Valid state transitions:
```
incoming → screening → approved → on-air → completed
           ↓                ↓
        rejected      rejected
```

**Current issues:**
- Sometimes calls skip states
- Sometimes multiple states happen simultaneously
- Need stricter state machine enforcement

## Logging Reference

### Key Log Messages

**Conference Created:**
```
🎙️ [CONFERENCE] Conference started for episode: {id}
✅ [CONFERENCE] Episode updated with conference SID
```
If you don't see these, conference wasn't created.

**Hold Music Request:**
```
🎵 [WAIT-AUDIO] Serving hold music
```
If you don't see this, hold music endpoint isn't being called.

**Participant Operations:**
```
📡 [PARTICIPANT] Putting on air
⏸️ [PARTICIPANT] Putting on hold
🔇 [PARTICIPANT] Muting
🔊 [PARTICIPANT] Unmuting
```

**Errors to watch for:**
```
❌ [TWILIO] Conference API error
❌ [TWILIO-RETRY] ... failed after retries
```

## Common Error Codes

- `20404` - Resource not found (wrong conference SID or participant doesn't exist)
- `20429` - Too many requests (rate limiting)
- `31206` - Connection error (network issue)

## Recovery Procedures

### If Conference Gets Stuck:

1. Close phone lines (cleans up database)
2. Wait 5 seconds
3. Reopen phone lines (creates fresh conference)
4. Take calls normally

### If Microphone Stays Open:

1. Check browser's microphone indicator
2. Close phone lines (should stop mic)
3. If mic still on, refresh page
4. Reopen lines fresh

### If Calls Won't Connect:

1. Check Twilio device status: `broadcast.twilioDevice`
2. If null, refresh page to reinitialize
3. If device exists, check `broadcast.activeCalls.size`
4. If > 0, disconnect all calls first

## Prevention Tips

1. **Always close phone lines between test sessions**
   - Cleans up stale records
   - Stops all audio connections
   - Fresh start for next session

2. **Wait for conference to fully initialize**
   - After opening lines, wait 2-3 seconds
   - Ensures conference SID is in database
   - Prevents race conditions

3. **One call at a time during testing**
   - Multiple simultaneous calls can cause state confusion
   - Test one complete flow before next call

4. **Check logs when issues occur**
   - Browser console for frontend
   - Railway logs for backend
   - Look for the error patterns above

## Database Cleanup (Emergency)

If system is completely stuck, manually clean database:

```sql
-- Mark all non-completed calls as completed
UPDATE "Call" 
SET status = 'completed', "endedAt" = NOW() 
WHERE status != 'completed' AND "endedAt" IS NULL;

-- Clear conference SIDs to force fresh creation
UPDATE "Episode" 
SET "twilioConferenceSid" = NULL 
WHERE status != 'completed';
```

Then refresh all browser tabs and start fresh.

## Summary

The intermittent issues stem from:
1. **Conference SID confusion** (name vs actual SID) - NOW FIXED
2. **Race conditions** (operations before conference ready) - PARTIALLY FIXED
3. **Stale records** (old calls interfering) - NOW FIXED with close-lines cleanup
4. **Timing issues** (operations happening too fast) - Need delays/waits

The system should be more stable now. If issues persist, use this guide to diagnose and report specific error codes/log patterns.

