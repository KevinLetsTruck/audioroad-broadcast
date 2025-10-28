# Call State Management Fixes - In Progress

## Issues Addressed

### ✅ FIXED: Issue #1 - Duplicate Route Endpoint
**Problem:** Two identical `/api/calls/:id/screen` endpoints causing routing conflicts  
**Solution:** Merged into single endpoint that handles both use cases  
**Files Changed:** `server/routes/calls.ts` (lines 155-182)

### ✅ FIXED: Issue #2 - Calls Persist After END SHOW  
**Problem:** Active calls not cleaned up when show ends  
**Solution:**  
- Added comprehensive cleanup in `/api/episodes/:id/end` endpoint
- Terminates all active Twilio calls
- Marks all calls as completed in database
- Ends Twilio conference properly
- Emits cleanup event to all clients

**Files Changed:**  
- `server/routes/episodes.ts` (lines 187-282)
- `server/routes/calls.ts` - Added `/api/calls/cleanup/:episodeId` endpoint (lines 433-499)
- `server/services/conferenceService.ts` - Added `endConference()` function (lines 203-229)

### ✅ IMPROVED: Conference Lifecycle Management
**Changes:**
- Added explicit conference ending logic
- Better error handling for conference operations
- Graceful handling of already-ended conferences
- Comprehensive logging for debugging

**Files Changed:**
- `server/services/conferenceService.ts`

---

## What This Fixes

1. **Clean Episode Endings**
   - When host clicks "END SHOW", all active calls are immediately terminated
   - Twilio conference is properly closed
   - Database records are marked completed
   - No orphaned calls or conferences

2. **Better Routing**
   - No more duplicate endpoint conflicts
   - Consistent call screening flow

3. **Improved Debugging**
   - Comprehensive logging at each step
   - Clear error messages
   - Conference state tracking

---

## Next Steps

### ✅ FIXED: Issue #3 - WebSocket Synchronization
**Problem:** Calls not appearing in screener sometimes; events getting lost  
**Solution:**
- Removed client-to-server event relay for call events (prevented race conditions)
- Call events now ONLY emitted by API endpoints (single source of truth)
- Added room join confirmation (`joined:episode` event)
- ScreeningRoom now waits for join confirmation before fetching calls
- Better logging to track socket room membership

**Files Changed:**
- `server/services/socketService.ts` (lines 35-59)
- `src/pages/ScreeningRoom.tsx` (lines 85-100)

### Still To Fix:

1. **Call State Reliability**
   - Web calls only working once per episode
   - Need to investigate conference state management
   - Twilio participant tracking

2. **Audio Routing**
   - Inconsistent one-way audio
   - Conference media server routing issues

---

## Testing Checklist

- [ ] Start show
- [ ] Receive a call
- [ ] Screen the call
- [ ] Approve the call
- [ ] Host takes call on-air
- [ ] **END SHOW** - verify all calls disconnect
- [ ] Check database - all calls marked completed
- [ ] Start new show - verify no lingering state from previous show

---

**Status:** Backend fixes complete, ready for testing  
**Next:** Fix WebSocket synchronization and frontend call state management

