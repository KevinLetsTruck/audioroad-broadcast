# 📞 SIP + LiveKit Deployment Guide

**Complete guide to deploying bidirectional phone audio for AudioRoad Broadcast**

---

## 🎯 What This Solves

**Problem:** Twilio Media Streams are **one-way only** (phone → server, but server can't send audio back to phone)

**Solution:** Use **SIP** (Session Initiation Protocol) which supports **full duplex bidirectional audio**

**Architecture:**
```
Phone Caller (PSTN)
  ↓
Twilio Phone Number
  ↓
Twilio SIP Trunk
  ↓
LiveKit SIP Service (Railway)
  ↓
LiveKit Cloud (WebRTC)
  ↓
Browser (Host/Screener)
```

---

## 📋 Prerequisites

Before starting, make sure you have:

- ✅ LiveKit Cloud account with credentials (API Key, API Secret, WS URL)
- ✅ Twilio account with phone number
- ✅ Railway account (for deploying SIP service)
- ✅ Redis instance (Railway provides this)

---

## 🚀 Part 1: Deploy LiveKit SIP Service to Railway

The LiveKit SIP service is a **separate microservice** (written in Go) that bridges SIP calls into LiveKit rooms.

### Step 1: Create New Railway Service

1. Go to your **audioroad-broadcast** project in Railway
2. Click **"+ New"** → **"Empty Service"**
3. Name it: **`livekit-sip-service`**

### Step 2: Connect GitHub Repository

1. Click **"Settings"** tab
2. Under **"Service Source"**, click **"Connect"**
3. Select your **audioroad-broadcast** repository
4. **Root Directory:** Leave as `/` (we'll use `Dockerfile.sip`)
5. Click **"Connect"**

### Step 3: Configure Build

1. In **"Settings"** → **"Build"** section:
2. **Dockerfile Path:** `Dockerfile.sip`
3. Click **"Save"**

### Step 4: Add Environment Variables

Click **"Variables"** tab and add these:

```bash
# LiveKit Connection
LIVEKIT_API_KEY=<your-livekit-api-key>
LIVEKIT_API_SECRET=<your-livekit-api-secret>
LIVEKIT_WS_URL=<your-livekit-ws-url>

# Redis (for SIP state management)
REDIS_URL=redis://default:password@redis.railway.internal:6379

# SIP Configuration
SIP_PUBLIC_IP=${RAILWAY_PUBLIC_DOMAIN}
SIP_PORT=5060

# Logging
LOG_LEVEL=info
```

**Note:** Railway provides a Redis instance. If you don't have one:
1. Click **"+ New"** → **"Database"** → **"Add Redis"**
2. Copy the **REDIS_URL** from the Redis service variables

### Step 5: Deploy

1. Click **"Deploy"** button
2. Wait for build to complete (~3-5 minutes)
3. Check logs for: `✅ [LIVEKIT-SIP] Service started`

### Step 6: Get Your SIP Endpoint

Once deployed:
1. Go to **"Settings"** → **"Networking"**
2. Click **"Generate Domain"**
3. Your SIP endpoint will be: `sip.your-project.railway.app`
4. **COPY THIS!** You'll need it for Twilio configuration

---

## 📞 Part 2: Configure Twilio SIP Trunk

Now we connect Twilio to your LiveKit SIP service.

### Step 1: Create SIP Trunk

1. Go to **Twilio Console** → **Elastic SIP Trunking** → **Trunks**
2. Click **"Create new SIP Trunk"**
3. **Friendly Name:** `AudioRoad-LiveKit-SIP`
4. Click **"Create"**

### Step 2: Add Origination URI

This tells Twilio where to send incoming calls:

1. In your SIP trunk, click **"Origination"** tab
2. Click **"Add new Origination URI"**
3. **Origination URI:** `sip:sip.your-project.railway.app:5060`
   - Replace `sip.your-project.railway.app` with your Railway domain
4. **Priority:** `10`
5. **Weight:** `10`
6. **Enabled:** ✅ (check)
7. Click **"Add"**

### Step 3: Assign Phone Number

1. Click **"Numbers"** tab
2. Click **"Add an existing number"**
3. Select your show's phone number (e.g., `+1 888 804 9791`)
4. Click **"Add"**

### Step 4: Configure Trunk Settings

1. Click **"General"** tab
2. **Secure Trunking:** Enable (recommended)
3. **Call Transfer:** Enable
4. **Geo Permissions:** Enable countries you want to receive calls from
5. Click **"Save"**

---

## 🔧 Part 3: Update Main App Configuration

Add these environment variables to your **main audioroad-broadcast service** (not the SIP service):

### Railway Variables (Main App)

```bash
# LiveKit (already have these)
LIVEKIT_API_KEY=<your-api-key>
LIVEKIT_API_SECRET=<your-api-secret>
LIVEKIT_WS_URL=<your-ws-url>

# NEW: SIP Configuration
LIVEKIT_SIP_DOMAIN=sip.your-project.railway.app
LIVEKIT_SIP_PASSWORD=<create-a-secure-password>

# Twilio (already have these)
TWILIO_ACCOUNT_SID=<your-account-sid>
TWILIO_AUTH_TOKEN=<your-auth-token>
TWILIO_PHONE_NUMBER=<your-phone-number>
```

---

## 🧪 Part 4: Testing

### Test 1: Check SIP Service Health

```bash
curl https://sip.your-project.railway.app:8080/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "livekit-sip",
  "version": "1.0.0"
}
```

### Test 2: Call Your Phone Number

1. **Start a live episode** in your dashboard
2. **Call your Twilio number** from your phone
3. **Expected flow:**
   - You hear: "Welcome to [Show Name]. Please hold while we connect you to a screener."
   - You're placed in the **lobby room**
   - Screener sees your call in the **Screening Queue**

### Test 3: Complete Call Flow

**Test the FULL flow** (this is the critical one!):

1. ☎️ **Call in** → Hear greeting → Wait in lobby
2. 🎯 **Screener picks up** → You move to screening room → Talk privately
3. ⏸️ **Screener puts you on hold** → You hear the LIVE SHOW (audio from broadcast)
4. 📡 **Host puts you on air** → You're live on the show! → Talk with host
5. ⏸️ **Host puts you on hold** → You hear live show again
6. 📡 **Host puts you on air again** → You're back on air!
7. 📴 **Call ends** → Hang up cleanly

**✅ Success criteria:** ALL 7 steps work smoothly with bidirectional audio!

---

## 🔍 Part 5: Monitoring & Debugging

### Check SIP Service Logs

In Railway (livekit-sip-service):
```bash
# Click "Deployments" → Click latest deployment → View logs
```

Look for:
- `✅ [LIVEKIT-SIP] Service started`
- `📞 [SIP] Incoming call from Twilio`
- `🎯 [SIP] Routed to room: lobby`

### Check Main App Logs

In Railway (audioroad-broadcast):
```bash
# Look for SIP-related logs
```

Expected:
- `✅ [SIP] SIP service initialized`
- `📞 [CALL-FLOW] Incoming call: <CallSid>`
- `🎯 [CALL-FLOW] Call moved to screening`

### Common Issues & Solutions

#### Issue 1: "SIP service not responding"

**Solution:**
1. Check SIP service is running in Railway
2. Verify `LIVEKIT_SIP_DOMAIN` matches your Railway domain
3. Check port 5060 is open (Railway handles this automatically)

#### Issue 2: "Calls connect but no audio"

**Solution:**
1. Check firewall allows UDP ports 10000-20000 (RTP media)
2. Verify `SIP_PUBLIC_IP` is set correctly
3. Check LiveKit credentials are correct

#### Issue 3: "Screener can't hear caller"

**Solution:**
1. Verify both participants are in the same LiveKit room
2. Check browser has microphone permissions
3. Look for WebRTC connection errors in browser console

#### Issue 4: "Caller can't hear host"

**Solution:**
1. This was the ORIGINAL problem with Media Streams!
2. With SIP, this should work automatically
3. If it doesn't, check SIP service logs for audio routing errors

---

## 📊 Part 6: Architecture Diagram

```
┌─────────────────┐
│  Phone Caller   │
│    (PSTN)       │
└────────┬────────┘
         │
         │ Regular phone call
         │
         ↓
┌─────────────────┐
│ Twilio Number   │
│ +1-888-804-9791 │
└────────┬────────┘
         │
         │ SIP Trunk
         │
         ↓
┌─────────────────┐
│  LiveKit SIP    │
│    Service      │
│   (Railway)     │
└────────┬────────┘
         │
         │ WebRTC
         │
         ↓
┌─────────────────┐
│  LiveKit Cloud  │
│  (WebRTC Rooms) │
└────────┬────────┘
         │
         ├──────────────┬──────────────┐
         │              │              │
         ↓              ↓              ↓
    ┌────────┐    ┌────────┐    ┌────────┐
    │ Lobby  │    │Screening│    │ Live   │
    │ Room   │    │  Room   │    │ Room   │
    └────────┘    └────────┘    └────────┘
         ↑              ↑              ↑
         │              │              │
    Browser        Browser        Browser
   (Waiting)     (Screener)       (Host)
```

---

## 🎓 What Each Component Does

### LiveKit SIP Service
- Receives SIP calls from Twilio
- Converts SIP audio to WebRTC
- Routes phone participants into LiveKit rooms
- Handles bidirectional audio (SIP ↔ WebRTC)

### LiveKit Cloud
- Manages WebRTC rooms
- Handles audio mixing
- Routes audio between all participants
- Provides low-latency real-time communication

### Your Node.js App
- Manages call state (queued → screening → hold → on-air)
- Creates and destroys rooms
- Moves participants between rooms
- Provides UI for host and screeners

---

## 💰 Cost Breakdown

### One-Time Costs
- Development time: ~8 hours (already done!)

### Monthly Costs
- **LiveKit SIP Service (Railway):** $5-10/month (small instance)
- **Redis (Railway):** $5/month or free with hobby plan
- **LiveKit Cloud:** $0-50/month (based on usage)
- **Twilio:** Existing costs (no change)

**Total new monthly cost:** ~$10-65/month

---

## ✅ Deployment Checklist

Before going live:

- [ ] LiveKit SIP service deployed to Railway
- [ ] SIP service health check passes
- [ ] Redis connected and working
- [ ] Twilio SIP trunk created
- [ ] Origination URI configured
- [ ] Phone number assigned to trunk
- [ ] Main app has SIP environment variables
- [ ] Test call connects to lobby
- [ ] Screener can pick up call
- [ ] Caller can hear screener (bidirectional audio!)
- [ ] Caller moves to hold and hears live show
- [ ] Caller moves to on-air and talks with host
- [ ] Multiple hold ↔ on-air transitions work
- [ ] Call ends cleanly

---

## 🚨 Rollback Plan

If something goes wrong:

1. **Quick rollback:** Update Twilio phone number webhook back to `/api/twilio/incoming-call` (old endpoint)
2. **System falls back to:** Twilio conferences (legacy mode)
3. **You'll lose:** Bidirectional audio for on-hold callers
4. **But you'll keep:** Basic calling functionality

---

## 📚 Additional Resources

- **LiveKit SIP Docs:** https://docs.livekit.io/sip/
- **Twilio SIP Trunking:** https://www.twilio.com/docs/sip-trunking
- **Railway Docs:** https://docs.railway.app/

---

## 🎉 Success!

If you've completed all steps and the test flow works:

**🎊 CONGRATULATIONS! 🎊**

You now have:
- ✅ Full bidirectional audio (phone ↔ browser)
- ✅ Unlimited state transitions (hold ↔ on-air ↔ hold)
- ✅ On-hold callers hear the live show
- ✅ No echo/feedback issues
- ✅ Production-ready phone call system

**This is exactly how commercial products like BlogTalkRadio work!**

---

## 💡 Next Steps

After successful deployment:

1. **Monitor for a week** - Watch logs, check audio quality
2. **Gather feedback** - Ask screeners and hosts about experience
3. **Optimize** - Adjust room settings, audio levels
4. **Scale** - If you get more calls, upgrade Railway instances

---

**Last Updated:** November 15, 2025  
**Status:** Ready for deployment

