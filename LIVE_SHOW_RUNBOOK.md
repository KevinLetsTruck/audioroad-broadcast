# Live Show Runbook

**Last Updated:** November 8, 2025  
**Version:** 1.0

This runbook provides step-by-step procedures for running a live show on the AudioRoad Broadcast Platform.

---

## Pre-Show Checklist (15 minutes before show)

### 1. System Check
- [ ] Open Host Dashboard in browser
- [ ] Verify correct show is selected (check episode number)
- [ ] Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R) to clear cache
- [ ] Check `/api/health` endpoint shows all services healthy
- [ ] Verify microphone permissions granted
- [ ] Test microphone in Broadcast Control page

### 2. Show Configuration
- [ ] Verify Radio.co password is saved in browser
- [ ] Check today's announcements are ready (if using)
- [ ] Verify show opener audio is uploaded (if using)
- [ ] Confirm show settings are correct

### 3. Team Check
- [ ] Screener is logged in and on Screening Room page
- [ ] Host is logged in and on Host Dashboard
- [ ] All team members have correct roles assigned

### 4. Phone Lines
- [ ] Click "OPEN PHONE LINES" button
- [ ] Verify "Phone Lines Open" status appears
- [ ] Screener sees "Ready to take calls" message
- [ ] Test call from phone number works

---

## Show Start Procedure

### Step 1: Open Phone Lines (5 minutes before show)
1. Go to Broadcast Control or Screening Room
2. Click "📞 OPEN PHONE LINES" button
3. Wait for confirmation: "Phone Lines Open"
4. Screener can now receive calls

### Step 2: Start Show (Show time)
1. Go to Host Dashboard
2. Verify episode is selected
3. Click "START SHOW" button
4. Wait for:
   - "LIVE" badge appears
   - Timer starts counting
   - Approved callers can hear show

### Step 3: During Show
- **Host:** Manage calls from Host Dashboard
  - See approved calls in "ON HOLD" section
  - Click "📡 On Air" to take callers live
  - Use mute/unmute buttons as needed
  - End calls when finished

- **Screener:** Screen incoming calls
  - Calls appear in "Calls in Queue"
  - Click "Pick Up & Screen This Call"
  - Fill out screening form
  - Click "Approve" or "Reject"

---

## During Show - Common Tasks

### Taking a Caller On-Air
1. Caller appears in "ON HOLD" section
2. Click "📡 On Air" button
3. Caller moves to "ON AIR" section
4. Host and caller can now talk

### Muting/Unmuting
- Click "🔇 Mute" to mute caller
- Click "🔊 Unmute" to unmute caller
- Muted callers can still hear host

### Putting Caller On Hold
- Click "⏸️ Hold" button
- Caller moves back to "ON HOLD"
- Caller can still hear show but can't talk

### Ending a Call
- Click "End" button
- Caller is disconnected
- Call appears in Call History tab

---

## Show End Procedure

### Step 1: End Show
1. Go to Host Dashboard
2. Click "END SHOW" button
3. Wait for confirmation
4. Recording downloads automatically
5. Recording uploads to S3

### Step 2: Close Phone Lines
1. Go to Broadcast Control
2. Click "📴 CLOSE PHONE LINES" button
3. No new calls will be accepted

### Step 3: Post-Show
1. Verify recording uploaded (check Recordings page)
2. Check Call History for transcriptions
3. Review AI analysis of calls
4. Close browser tabs (optional)

---

## Troubleshooting

### "START SHOW" Button Doesn't Work
**Check:**
1. Is a show/episode selected?
2. Are phone lines open?
3. Browser console for errors (F12)
4. Railway logs for backend errors

**Fix:**
- Hard refresh browser (Cmd+Shift+R)
- Check Railway deployment status
- Verify environment variables set

### No Audio on Calls
**Check:**
1. Microphone permissions granted?
2. Browser audio settings
3. System sound settings (laptop/computer)
4. Twilio device initialized?

**Fix:**
- Grant microphone permissions
- Check system sound mixer
- Hard refresh browser
- Restart browser

### Calls Not Appearing in Screening Room
**Check:**
1. Screener logged in?
2. WebSocket connected? (check browser console)
3. Phone lines open?
4. Railway logs for call creation

**Fix:**
- Refresh Screening Room page
- Check WebSocket connection
- Verify phone lines are open
- Check Railway logs

### Recording Not Uploading
**Check:**
1. S3 credentials configured?
2. Browser console for upload errors
3. Railway logs for S3 errors
4. Recording downloaded locally?

**Fix:**
- Check AWS credentials in Railway
- Verify S3 bucket exists
- Check Railway logs
- Recording should download locally as fallback

### Transcription Not Appearing
**Check:**
1. Call ended properly?
2. Recording completed?
3. Twilio webhook received?
4. AI analysis completed?

**Fix:**
- Wait 1-2 minutes after call ends
- Check Call History tab
- Verify Twilio webhook URL configured
- Check Railway logs for transcription errors

---

## Emergency Procedures

### Show Crashes Mid-Broadcast
1. **Don't panic** - Recording continues automatically
2. Refresh browser page
3. Go to Host Dashboard
4. System should recover state automatically
5. If not, manually end show and restart

### Can't End Show
1. Check Railway logs for errors
2. Try refreshing Host Dashboard
3. If stuck, close browser and reopen
4. System will auto-cleanup after timeout

### All Calls Drop
1. Check Twilio status page
2. Verify Twilio credentials
3. Check Railway logs
4. Restart show if needed

### Database Connection Lost
1. Check Railway database status
2. Verify DATABASE_URL environment variable
3. Check Railway logs
4. System will retry automatically

---

## Health Check

### Before Each Show
Visit: `https://your-url.com/api/health`

**Expected Response:**
```json
{
  "status": "healthy",
  "services": {
    "database": { "status": "connected", "latency": 5 },
    "twilio": { "status": "connected" },
    "s3": { "status": "connected" }
  }
}
```

**If Unhealthy:**
- Check Railway logs
- Verify environment variables
- Check service status pages (Twilio, AWS)

---

## Support Contacts

- **Technical Issues:** Check Railway logs first
- **Twilio Issues:** Check Twilio Console
- **Database Issues:** Check Railway database logs
- **Emergency:** Contact system administrator

---

## Post-Show Checklist

- [ ] Show ended successfully
- [ ] Recording uploaded to S3
- [ ] All calls transcribed (check Call History)
- [ ] Phone lines closed
- [ ] No errors in Railway logs
- [ ] Browser tabs closed (optional)

---

## Notes

- System auto-saves state to sessionStorage
- Recordings download locally AND upload to S3
- Transcriptions happen automatically after calls end
- AI analysis runs automatically after transcription
- WebSocket reconnects automatically if connection lost
- All critical operations have retry logic

---

## Quick Reference

| Action | Location | Button |
|--------|----------|--------|
| Open Phone Lines | Broadcast Control / Screening Room | "📞 OPEN PHONE LINES" |
| Start Show | Host Dashboard | "START SHOW" |
| Take Caller On-Air | Host Dashboard | "📡 On Air" |
| End Show | Host Dashboard | "END SHOW" |
| Close Phone Lines | Broadcast Control | "📴 CLOSE PHONE LINES" |
| View Call History | Host Dashboard | "Call History" tab |
| Check Health | Browser | `/api/health` |

---

**Remember:** When in doubt, check Railway logs and browser console (F12) for error messages.

