# Environment Variables Setup

This document lists all required and optional environment variables for AudioRoad Broadcast.

## Required Variables

### Application
```bash
NODE_ENV=development # or 'production'
PORT=3001
APP_URL=http://localhost:5173 # Frontend URL (production: https://your-domain.com)
```

### Database
```bash
DATABASE_URL=postgresql://user:password@host:5432/audioroad
```

### Clerk Authentication
```bash
CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
```

### Twilio (Phone System)
```bash
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_API_KEY=SKxxxxx
TWILIO_API_SECRET=xxxxx
```

### AWS S3 (Recordings & Audio Assets)
```bash
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
AWS_REGION=us-east-1
AWS_S3_BUCKET=audioroad-recordings
```

## Optional Variables

### OpenAI (AI Features)
```bash
OPENAI_API_KEY=sk-xxxxx
```

### ElevenLabs (Voice Generation)
```bash
ELEVENLABS_API_KEY=xxxxx
```

### Shopify (Product Commercials)
```bash
SHOPIFY_SHOP_NAME=your-shop
SHOPIFY_ACCESS_TOKEN=xxxxx
```

### Streaming Server (Dedicated Audio Streaming)
```bash
STREAMING_SERVER_URL=http://localhost:8000
```

## WebRTC / Janus Gateway (NEW - Phase 1)

**Status:** Optional - Leave blank to use current Twilio conference system

These variables enable the new WebRTC-based call management system:

```bash
# Janus Gateway WebSocket URL
# Example: ws://localhost:8188 (local) or wss://janus.yourdomain.com (production)
JANUS_WS_URL=

# Janus API secret (for administrative operations)
JANUS_API_SECRET=your-secure-secret

# Janus admin secret (for server management)
JANUS_ADMIN_SECRET=your-admin-secret

# Public IP for Janus server (needed for WebRTC NAT traversal)
# In production: Your Janus server's public IP
# Example: 123.456.789.012
PUBLIC_IP=auto
```

### TURN Server (WebRTC NAT Traversal)

Optional - defaults to Twilio's TURN if not set:

```bash
TURN_SERVER_URL=turn:turn.example.com:3478
TURN_USERNAME=your-username
TURN_PASSWORD=your-password
```

## How to Deploy Janus Gateway

### Local Development (Docker)

```bash
# Start Janus in Docker
docker-compose -f docker-compose.janus.yml up -d

# Check logs
docker logs audioroad-janus -f

# Your local Janus URL:
JANUS_WS_URL=ws://localhost:8188
```

### Production (Railway/Render)

**Option 1: Railway (Recommended)**

1. Create new Railway service
2. Select "Deploy from GitHub repo"
3. Point to `janus/Dockerfile`
4. Add environment variables:
   - `JANUS_API_SECRET`
   - `JANUS_ADMIN_SECRET`
   - `PUBLIC_IP` (Railway provides this)
5. Expose port 8188 (WebSocket)
6. Get public URL: `wss://janus-xxx.railway.app`

**Option 2: Render**

1. Create new "Web Service"
2. Docker runtime
3. Dockerfile path: `janus/Dockerfile`
4. Add environment variables
5. Expose port 8188
6. Get WebSocket URL

**Option 3: DigitalOcean Droplet**

1. Create Ubuntu droplet ($12/month)
2. Install Docker
3. Clone repo
4. Run docker-compose
5. Configure firewall (ports 8188, 20000-20100)
6. Use droplet IP for `PUBLIC_IP`

## Environment Variable Validation

The server validates critical environment variables on startup.

Missing required variables will:
- Log warnings to console
- Prevent server from starting (in production)
- Continue with degraded features (in development)

Check server logs for:
```
✅ [ENV] All required variables present
⚠️ [ENV] Missing optional variable: JANUS_WS_URL
ℹ️ [WEBRTC] Janus WebSocket URL not configured - WebRTC features disabled
```

## Migration Path

### Current System (Twilio Conferences)
- No WebRTC variables needed
- System works as-is
- Call routing via Twilio conferences

### Future System (WebRTC + Janus)
- Add `JANUS_WS_URL`
- Deploy Janus Gateway
- Gradual cutover (both systems work simultaneously)
- Full migration when tested

### Rollback
- Remove `JANUS_WS_URL` from environment
- System falls back to Twilio conferences
- Zero downtime

## Testing Your Configuration

Start the server and check logs:

```bash
npm run dev

# Look for:
🔌 [WEBRTC] Initializing WebRTC infrastructure...
✅ [WEBRTC] Connected to Janus Gateway

# Or if not configured:
ℹ️ [WEBRTC] Janus WebSocket URL not configured - WebRTC features disabled
```

## Security Notes

1. **Never commit `.env` files** - they're in .gitignore
2. **Rotate secrets regularly** - especially in production
3. **Use strong secrets** - minimum 32 characters
4. **Restrict Janus access** - firewall rules for production
5. **HTTPS/WSS in production** - never use WS:// in production

## Support

If you need help configuring environment variables:
1. Check `WEBRTC_IMPLEMENTATION.md` for deployment guides
2. Review Railway logs for error messages
3. Test locally with Docker first

