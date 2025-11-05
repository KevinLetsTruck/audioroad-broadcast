# Two-Phase Workflow - Ready to Test

## What's Deployed

✅ **Backend complete:**
- `/api/episodes/:id/open-lines` - Phase 1 endpoint
- `/api/episodes/:id/start` - Phase 2 endpoint  
- Incoming calls work with linesOpen OR live episodes
- Wait-audio serves hold music (callers hear conference directly when live)

✅ **Frontend complete:**
- **Broadcast Control:** "OPEN PHONE LINES" button
- **Host Dashboard:** "START SHOW" button (appears after lines open)
- **Screening Room:** Uses broadcast context for correct episode
- WebSocket sync between all pages

✅ **Database:** Synced with production (linesOpen fields exist)

## How to Use

### Phase 1: Open Phone Lines (Broadcast Control)

1. Go to **Broadcast Control** page
2. Click **"📞 OPEN PHONE LINES"**
3. Page shows "Phone Lines Open" status
4. Screener can now take calls

### Phase 2: Start Show (Host Dashboard)

1. Go to **Host Dashboard** page  
2. You'll see **"START SHOW"** button in top right
3. Click it to:
   - Connect host to Twilio conference
   - Start recording
   - Start streaming to Radio.co
   - Play show opener
   - Mark episode as live

### Audio Flow

**Before "START SHOW":**
- Callers hear: Welcome message → Hold music
- Screener can pick up and screen calls
- Approved callers wait in queue hearing hold music

**After "START SHOW":**
- Host joins conference (unmuted)
- Show opener plays through mixer → goes to conference
- Callers hear: Opener, then host mic, then live conference audio
- **This is when the first-caller audio issue should NOT happen!**
- Callers are already in conference when host goes live

## Testing Checklist

- [ ] Click "OPEN PHONE LINES" - lines open successfully
- [ ] Call in - goes to conference, not voicemail
- [ ] Screening Room shows call
- [ ] Pick up and screen - audio works
- [ ] Approve caller - goes to queue
- [ ] Host Dashboard shows "START SHOW" button
- [ ] Click "START SHOW" - host mic activates
- [ ] Caller in queue hears show opener
- [ ] Caller in queue hears host talking
- [ ] No first-caller audio issue!

## Railway Status

Deployment in progress - wait for "Deployment successful"

The two-phase workflow is implemented without breaking the existing audio flow!

