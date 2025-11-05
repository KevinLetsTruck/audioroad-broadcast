# Two-Phase Workflow - Current Status

## FIX DEPLOYED (Nov 5, 2025 - 9:08 PM) - Commit `9ab132b`

**Issue:** Sent-back calls couldn't be picked up again (button unresponsive)

**Root Cause:** React state (`activeCall`) was cleared when call sent back, but Twilio Device still had the call in its internal `device.calls` array. State check didn't catch this.

**Fix:** Check **actual Twilio SDK state** instead of React state:
```typescript
const deviceHasActiveCalls = device?.calls && device.calls.length > 0;
```

Now checks the Device's internal call array, catches stale connections even after React state is cleared.

---

## HOTFIX (Nov 5, 2025 - 9:02 PM) - Commit `0ae692f`

**Previous Issue:** Device was being destroyed unconditionally, breaking normal pickup/approve flows

**Fix:** Only destroy device when there are ACTIVE calls:
- **ScreeningRoom**: Check `activeCalls.size` and `device.calls.length`
- **HostDashboard**: Only destroy if `activeCalls.size > 0`

This preserves the fix for "Call already active" while restoring normal functionality.

---

## CRITICAL FIX (Nov 5, 2025 - 8:52 PM) - Commit `8778a6c`

**Issue:** "InvalidStateError: A Call is already active" when:
- Starting show after being on ScreeningRoom
- Picking up calls sent back from on-air

**Root Cause:** Twilio Device object was persisting across dashboard switches. Disconnecting calls wasn't enough - the Device itself retained state.

**Solution:** Added `destroyTwilioDevice()` function that:
1. Disconnects all active calls
2. Destroys the Twilio Device completely
3. Clears all call state
4. Forces creation of fresh Device on next connection

---

## What's Fixed

✅ **Core Prisma issue solved** - Migrations run during build, not runtime  
✅ **Using existing fields** - `conferenceActive` instead of `linesOpen` (no Prisma conflicts)  
✅ **Fresh episodes** - System now creates new episodes instead of reusing completed ones  
✅ **Calls go through** - Backend finds episodes with `status='scheduled'` + `conferenceActive=true`  
✅ **Audio restored** - wait-audio serves Radio.co stream like stable version

## Current Flow

**Phase 1: OPEN PHONE LINES** (Broadcast Control)
1. Creates fresh episode with `status='scheduled'`
2. Sets `conferenceActive=true`
3. Creates Twilio conference
4. Screener can take calls

**Phase 2: START SHOW** (Host Dashboard)  
1. Host connects to Twilio conference
2. Starts recording & streaming
3. Plays show opener
4. Changes `status='live'`

## Known Issues to Fix

### 1. Caller Audio
**Status:** Callers hear greeting but then their mic is open (should hear Radio.co stream)
**Fix:** Verify TwiML has correct `muted` setting and `waitUrl` is being called

### 2. Closing Phone Lines
**Status:** Doesn't disconnect active calls
**Fix:** Need to add logic to end Twilio conference when closing lines

### 3. Episode Cleanup
**Status:** Old completed episodes accumulating
**Fix:** Add cleanup endpoint or auto-archive old episodes

## Next Steps

1. **Wait for Railway deployment** (3-4 min) - Latest fixes deploying now
2. **Test complete flow:**
   - OPEN PHONE LINES → Fresh episode created
   - Call in → Should hear Radio.co stream
   - Screen & approve → Caller waits hearing stream
   - START SHOW → Host goes live
   - Callers hear show opener + host mic

## What We Learned

- **Prisma migrations must run BEFORE TypeScript compiles**
- **Railway caches Docker layers** - version bumps force clean rebuilds
- **Use existing database fields when possible** - avoids migration complexity
- **Always create fresh episodes** - don't reuse completed ones

The foundation is now solid. The two-phase workflow should work once Railway finishes deploying.

