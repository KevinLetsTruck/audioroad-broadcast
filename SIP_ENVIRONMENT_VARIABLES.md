# 🔐 SIP Integration - Environment Variables

**Complete list of environment variables needed for SIP + LiveKit integration**

---

## 📦 Service 1: LiveKit SIP Service (Separate Railway Service)

**Service Name:** `livekit-sip-service`

```bash
# ========================================
# LiveKit Connection
# ========================================
LIVEKIT_API_KEY=APxxxxxxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LIVEKIT_WS_URL=wss://audioroad-xxxxxx.livekit.cloud

# ========================================
# Redis (State Management)
# ========================================
# Option 1: Railway Redis (recommended)
REDIS_URL=redis://default:password@redis.railway.internal:6379

# Option 2: External Redis
# REDIS_URL=redis://your-redis-host:6379

# ========================================
# SIP Configuration
# ========================================
# Public IP/domain that Twilio connects to
SIP_PUBLIC_IP=${RAILWAY_PUBLIC_DOMAIN}

# SIP signaling port (standard)
SIP_PORT=5060

# RTP port range for audio (10,000 ports!)
RTP_PORT_START=10000
RTP_PORT_END=20000

# ========================================
# Logging
# ========================================
LOG_LEVEL=info

# Options: debug, info, warn, error
# Use 'debug' for troubleshooting, 'info' for production

# ========================================
# Health Check
# ========================================
HTTP_PORT=8080
# Used for health checks: http://your-domain:8080/health
```

---

## 📦 Service 2: Main App (audioroad-broadcast)

**Service Name:** `audioroad-broadcast`

### New Variables (Add These!)

```bash
# ========================================
# SIP Integration (NEW!)
# ========================================
# Your LiveKit SIP service domain from Railway
LIVEKIT_SIP_DOMAIN=livekit-sip-service.railway.app

# Password for SIP authentication (create a strong one!)
LIVEKIT_SIP_PASSWORD=your-secure-password-here

# Example: Generate with: openssl rand -base64 32
```

### Existing Variables (Keep These!)

```bash
# ========================================
# LiveKit (WebRTC)
# ========================================
LIVEKIT_API_KEY=APxxxxxxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LIVEKIT_WS_URL=wss://audioroad-xxxxxx.livekit.cloud

# Frontend needs this too:
VITE_LIVEKIT_WS_URL=wss://audioroad-xxxxxx.livekit.cloud

# ========================================
# Twilio (Phone Calls)
# ========================================
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+18888049791
TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_SECRET=your_twilio_api_secret

# ========================================
# Database
# ========================================
DATABASE_URL=postgresql://user:password@host:5432/database

# ========================================
# Clerk (Authentication)
# ========================================
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx

# ========================================
# AWS S3 (Recordings & Files)
# ========================================
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_S3_BUCKET_NAME=audioroad-recordings
AWS_REGION=us-east-1

# ========================================
# AI Services (Optional)
# ========================================
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx
ELEVENLABS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_GREETING_VOICE=your-voice-id

# ========================================
# Application
# ========================================
NODE_ENV=production
PORT=3001
APP_URL=https://audioroad-broadcast-production.up.railway.app

# Streaming server (if separate)
STREAM_SERVER_URL=https://streaming.audioroad.app
```

---

## 🔒 How to Get Each Value

### LiveKit Credentials
1. Go to https://cloud.livekit.io/
2. Log in to your account
3. Select your project
4. Click **"Settings"** → **"Keys"**
5. Copy **API Key**, **API Secret**, and **WebSocket URL**

### Twilio Credentials
1. Go to https://console.twilio.com/
2. Find **Account SID** and **Auth Token** on dashboard
3. Phone number: Find in **Phone Numbers** section
4. API Key/Secret: Create in **Account** → **API Keys**

### Redis URL (Railway)
1. In Railway project, add Redis database:
   - Click **"+ New"** → **"Database"** → **"Add Redis"**
2. Click on Redis service → **"Variables"** tab
3. Copy **REDIS_URL** value
4. Paste it in your SIP service variables

### SIP Domain
1. Deploy `livekit-sip-service` to Railway
2. Go to **"Settings"** → **"Networking"**
3. Click **"Generate Domain"**
4. Copy the generated domain (e.g., `livekit-sip-xxxxx.railway.app`)

### SIP Password
Generate a secure password:
```bash
# On Mac/Linux:
openssl rand -base64 32

# Or use a password manager to generate one
```

---

## ✅ Validation Checklist

Before deploying, verify:

### LiveKit SIP Service
- [ ] `LIVEKIT_API_KEY` starts with `AP`
- [ ] `LIVEKIT_API_SECRET` is ~40 characters
- [ ] `LIVEKIT_WS_URL` starts with `wss://`
- [ ] `REDIS_URL` starts with `redis://`
- [ ] `SIP_PUBLIC_IP` is set to `${RAILWAY_PUBLIC_DOMAIN}`
- [ ] `LOG_LEVEL` is set (info or debug)

### Main App
- [ ] `LIVEKIT_SIP_DOMAIN` matches your Railway SIP service domain
- [ ] `LIVEKIT_SIP_PASSWORD` is strong (20+ characters)
- [ ] All existing Twilio variables are present
- [ ] All existing LiveKit variables are present
- [ ] Database URL is correct

---

## 🚨 Security Best Practices

### Never Commit These to Git!
```bash
# These files should be in .gitignore:
.env
.env.local
.env.production

# Keep secrets in:
# - Railway variables (production)
# - .env files (local development only)
```

### Rotate Secrets Regularly
- Change `LIVEKIT_SIP_PASSWORD` every 3-6 months
- Rotate Twilio API keys annually
- Update database passwords on schedule

### Use Railway's Secret Management
- Railway encrypts all environment variables
- Variables are injected at runtime (not stored in code)
- Each service has isolated variables

---

## 🧪 Testing Your Configuration

### Test 1: Verify LiveKit Connection
```bash
# In main app logs, look for:
✅ [WEBRTC] Connected to LiveKit Cloud
✅ [SIP] SIP service initialized
```

### Test 2: Check SIP Service Health
```bash
curl https://your-sip-domain.railway.app:8080/health

# Expected response:
# {"status":"healthy","service":"livekit-sip"}
```

### Test 3: Make Test Call
1. Call your Twilio number
2. Check main app logs for:
```
📞 [TWILIO-SIP] Incoming call: CAxxxxxxxxx
🎯 [CALL-FLOW] Routing to LiveKit via SIP
✅ [SIP] Call connected to room: lobby
```

---

## 📝 Quick Copy/Paste Templates

### For LiveKit SIP Service (Railway)
```bash
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_WS_URL=
REDIS_URL=
SIP_PUBLIC_IP=${RAILWAY_PUBLIC_DOMAIN}
SIP_PORT=5060
RTP_PORT_START=10000
RTP_PORT_END=20000
LOG_LEVEL=info
HTTP_PORT=8080
```

### For Main App (Railway)
```bash
# Add these to existing variables:
LIVEKIT_SIP_DOMAIN=
LIVEKIT_SIP_PASSWORD=
```

---

## 🔍 Troubleshooting

### "SIP service won't start"
- Check `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` are correct
- Verify `REDIS_URL` is accessible
- Look for errors in deployment logs

### "Calls don't connect"
- Verify `LIVEKIT_SIP_DOMAIN` in main app matches SIP service domain
- Check Twilio SIP trunk is configured with correct URI
- Ensure `SIP_PUBLIC_IP` resolves correctly

### "No audio on calls"
- Check firewall allows UDP ports 10000-20000
- Verify both RTP_PORT_START and RTP_PORT_END are set
- Look for "RTP" errors in SIP service logs

---

## 📞 Support

If you have issues:
1. Check all variables are set correctly
2. Review deployment logs in Railway
3. Test each component individually
4. Compare your setup to this guide

---

**Last Updated:** November 15, 2025  
**For:** AudioRoad Broadcast SIP Integration

