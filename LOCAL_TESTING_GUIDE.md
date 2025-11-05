# Local Testing - Two-Phase Workflow

## Servers Running

I've started both servers locally:

**Backend:** `npm run dev:server` (running in background)
- URL: http://localhost:8080
- API: http://localhost:8080/api

**Frontend:** `npm run dev` (running in background)
- URL: http://localhost:5173 (Vite default)

## How to Test

### 1. Open the Local App

Open your browser to: **http://localhost:5173**

### 2. Test the Two-Phase Workflow

**Step 1: Broadcast Control**
- Go to http://localhost:5173/broadcast-control
- Click **"OPEN PHONE LINES"**
- Should see "Phone Lines Open" status

**Step 2: Check Terminal/Console**
- Look at the terminal where servers are running
- Should see: `✅ [OPEN-LINES] Phone lines opened (status=scheduled, conferenceActive=true)`

**Step 3: Make a Test Call** (if you want)
- Your Twilio number will route to localhost if configured
- Or just verify the UI works

**Step 4: Host Dashboard**
- Go to http://localhost:5173/host-dashboard
- Should see **"START SHOW"** button

**Step 5: Screening Room**
- Go to http://localhost:5173/screening-room
- Should see the episode

### 3. Verify the Code

**Check the incoming call handler:**
```bash
grep -A10 "conferenceActive.*true" server/routes/twilio.ts
```

Should show the logic checking for `status='scheduled'` AND `conferenceActive=true`.

## What This Proves

If it works locally, the **code is correct** and the problem is **100% Railway's Docker caching**.

If it DOESN'T work locally, there's still a code issue to fix.

## Stop the Servers

When done testing:
```bash
pkill -f "tsx watch"
pkill -f "vite"
```

