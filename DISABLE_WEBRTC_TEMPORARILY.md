# 🚨 Quick Fix: Disable WebRTC Mode Temporarily

To make Twilio Conferences work RIGHT NOW:

## Option 1: Remove LiveKit Variables from Railway (5 minutes)

1. Go to Railway Dashboard
2. Click your project → Variables
3. **Delete or rename** these 3 variables:
   - `LIVEKIT_WS_URL` → `LIVEKIT_WS_URL_DISABLED`
   - `LIVEKIT_API_KEY` → `LIVEKIT_API_KEY_DISABLED`
   - `LIVEKIT_API_SECRET` → `LIVEKIT_API_SECRET_DISABLED`

4. Railway will redeploy (~3 min)
5. Test - calls will go to Twilio Conferences

## Option 2: Quick Code Fix (10 minutes)

I can add code to check episode settings instead of just env vars.

---

## Why This Matters

Currently the backend code says:
```javascript
const useWebRTC = !!(process.env.LIVEKIT_WS_URL && process.env.LIVEKIT_API_KEY);
```

This means: "If LiveKit is configured, ALWAYS use Media Streams"

Your frontend checkbox doesn't affect this!

---

**Try Option 1 first - just rename those 3 variables in Railway. This will force conference mode and we can test if conferences work for your full workflow!**

