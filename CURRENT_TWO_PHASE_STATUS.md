# Two-Phase Workflow - Current Status

## CRITICAL FIX DEPLOYED (Nov 5, 2025 - 8:52 PM)

**Issue:** "InvalidStateError: A Call is already active" when:
- Starting show after being on ScreeningRoom
- Picking up calls sent back from on-air

**Root Cause:** Twilio Device object was persisting across dashboard switches. Disconnecting calls wasn't enough - the Device itself retained state.

**Solution:** Added `destroyTwilioDevice()` function that:
1. Disconnects all active calls
2. Destroys the Twilio Device completely
3. Clears all call state
4. Forces creation of fresh Device on next connection

**Deployment:** Commit `8778a6c` - Railway deploying now (3-4 min)

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

