# Testing Two-Phase Show Start Workflow

## Quick Debugging Steps

### 1. Check if lines were opened successfully

In **Broadcast Control** page, check browser console (F12) after clicking "OPEN PHONE LINES":

```
Should see:
📞 [OPEN-LINES] Opening phone lines for screener...
✅ Episode ready: [episode-id]
✅ Phone lines opened - screener can now take calls
🎉 PHONE LINES OPENED! Screener can now take calls.
```

### 2. Check if Screening Room detects episode

In **Screening Room** page, check browser console (F12):

```
Should see:
🚀 ScreeningRoom mounted - initializing...
📺 Episodes response: [array of episodes]
✅ Active episode loaded (lines open): [episode name] ID: [id]
🔌 [SCREENER] Joining episode room: [episode-id]
```

### 3. Check if incoming call is created

After a caller dials in, check Railway logs or browser console:

```
Railway logs should show:
📞 Incoming call from: [phone] SID: [CallSid]
📞 [EPISODE] Finding active episode...
✅ [EPISODE] Found episode with lines open
```

Browser console should show:
```
📞 [SCREENER] Incoming call event received: {callId, callerId, ...}
📋 Active queued calls: 1 (filtered from 1 total)
```

## Troubleshooting

### Problem: "Phone Lines Open" shows in Broadcast Control but Screening Room shows no episode

**Fix:** Hard refresh Screening Room page (Cmd+Shift+R or Ctrl+Shift+R)

### Problem: Call comes in but doesn't show in Screening Room

**Check:**
1. Open browser console in Screening Room
2. Look for "📋 Active queued calls:" log
3. Check the number - if 0, call may have wrong status

**Railway logs to check:**
```bash
# Check if call was created with correct status
grep "status: 'queued'" [recent logs]
```

### Problem: Episode not found when lines opened

**Check database:**
The episode should have:
- `linesOpen: true`
- `linesOpenedAt: [timestamp]`
- `status: 'scheduled'` (NOT 'live' yet)
- `conferenceActive: true`

## Testing Flow

1. **Broadcast Control** → Click "OPEN PHONE LINES"
   - Should see "Phone Lines Open" status
   - Should see episode name

2. **Screening Room** → Hard refresh if needed
   - Should see episode title at top
   - Should see "Waiting for calls..." message

3. **Dial in from phone** → Call your Twilio number
   - Should hear welcome message
   - Should hear hold music
   - Should see call appear in Screening Room

4. **Screening Room** → Click "Pick Up and Screen"
   - Should connect to caller
   - Should hear caller

5. **Screening Room** → Fill out form and click "Approve for Host"
   - Call should move to host queue
   - Caller should continue hearing hold music

6. **Host Dashboard** → Should see "START SHOW" button
   - Click it to start recording, streaming, mic, opener

7. **Callers in queue** → Should now hear:
   - Live show opener (if configured)
   - Host microphone audio
   - Other callers when they go on air

## Expected vs Current State

| Step | Expected | Check |
|------|----------|-------|
| Open Lines | Episode created, linesOpen=true | ✓ |
| Call In | Goes to voicemail or conference? | ? |
| Screening Room | Sees incoming call | ? |
| Pick Up | Screener hears caller | ? |
| Approve | Caller waits in queue | ? |
| Start Show | Host mic goes live | ? |
| Queue Hears | Live conference audio | ? |

