# LiveKit Cloud Setup Guide

**This replaces Janus Gateway with LiveKit Cloud - production-ready WebRTC infrastructure.**

---

## Step 1: Create LiveKit Cloud Account (5 minutes)

1. **Go to:** https://livekit.io/
2. Click **"Get Started"** or **"Sign Up"**
3. Sign up with:
   - GitHub (easiest)
   - Or email
4. **Verify your email** if prompted

---

## Step 2: Create Your First Project (2 minutes)

After logging in:

1. You'll see **"Create Project"** button
2. Click it
3. **Project Name:** `audioroad-broadcast` (or your choice)
4. Click **"Create"**

---

## Step 3: Get Your Credentials (Copy These!)

After creating the project, you'll see:

### API Key & Secret

LiveKit will show you:
```
API Key: APxxxxxxxxxxxxxx
API Secret: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**IMPORTANT: Copy both of these!** You'll need them.

### WebSocket URL

You'll also see:
```
WebSocket URL: wss://audioroad-xxxxxx.livekit.cloud
```

**Copy this too!**

---

## Step 4: Configure Your App

Add these to your Railway environment variables:

### Main App Service (audioroad-broadcast)

**Add these variables:**

```bash
# LiveKit Server SDK (for backend)
LIVEKIT_API_KEY=APxxxxxxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LIVEKIT_WS_URL=wss://audioroad-xxxxxx.livekit.cloud

# LiveKit Client SDK (for frontend - build time)
VITE_LIVEKIT_WS_URL=wss://audioroad-xxxxxx.livekit.cloud
```

### How to Add in Railway:

1. Go to your **audioroad-broadcast** service (not WebRTC Server)
2. Click **"Variables"** tab
3. Click **"+ New Variable"**
4. Add each variable above
5. Click **"Redeploy"** after adding all 4

---

## Step 5: You're Done!

**That's it!** No servers to deploy, no Docker complexity.

LiveKit provides:
- ✅ Global WebRTC infrastructure
- ✅ Automatic scaling
- ✅ Built-in TURN servers
- ✅ 99.9% uptime SLA
- ✅ Real-time monitoring dashboard

---

## Free Tier Limits

**LiveKit Free:**
- 10,000 participant minutes/month
- ~33 hours of broadcast time
- Perfect for testing and small shows
- Upgrade anytime if you need more

**Example usage:**
- 1 hour show with 5 callers = 5 participant minutes
- You can do ~2,000 shows/month on free tier

---

## LiveKit Dashboard

After setup, you can monitor:
- Active rooms
- Connected participants
- Bandwidth usage
- Connection quality
- Real-time metrics

Much better than managing your own Janus server!

---

## Costs (When You Need to Scale)

**Free:** 10,000 minutes/month  
**Starter:** $29/month - 30,000 minutes  
**Pro:** $99/month - 100,000 minutes  
**Enterprise:** Custom pricing

For comparison:
- Self-hosted Janus: $25/month + your time managing it
- LiveKit: $0-29/month + zero management time

---

## Ready to Continue

Once you have your 4 credentials from LiveKit:
1. API Key
2. API Secret  
3. WebSocket URL
4. Same WebSocket URL for frontend

Tell me **"I have LiveKit credentials"** and I'll finish the integration!

---

**I'm refactoring the code now while you set up your account...**

