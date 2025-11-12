# WebRTC Deployment & Testing Guide

**Goal:** Get your WebRTC broadcast system running and test the complete call flow.

---

## Step 1: Deploy Janus Gateway to Railway

### Option A: Railway (Recommended - Easiest)

**1. Create New Railway Service**

```bash
# In Railway dashboard:
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose: audioroad-broadcast repository
4. Click "Add variables" before deploying
```

**2. Configure Build Settings**

```
Root Directory: /
Dockerfile Path: janus/Dockerfile
```

**3. Add Environment Variables**

```bash
JANUS_API_SECRET=your-secure-random-string-here
JANUS_ADMIN_SECRET=your-admin-secret-here
PUBLIC_IP=${{RAILWAY_PUBLIC_DOMAIN}}
```

Generate secrets:
```bash
# On your Mac:
openssl rand -base64 32  # Use for JANUS_API_SECRET
openssl rand -base64 32  # Use for JANUS_ADMIN_SECRET
```

**4. Deploy**

- Railway will auto-deploy from your Dockerfile
- Wait 2-3 minutes for build
- Note the public URL: `https://audioroad-janus.up.railway.app`

**5. Verify Deployment**

```bash
# Check if Janus is running:
curl https://your-janus-url.railway.app/janus/info

# Should return JSON with Janus info
```

---

### Option B: Render (Alternative)

**1. Create New Web Service**

- Go to Render dashboard
- Click "New +" → "Web Service"
- Connect GitHub repo: audioroad-broadcast

**2. Configure Service**

```
Name: audioroad-janus
Environment: Docker
Dockerfile Path: janus/Dockerfile
Instance Type: Starter ($7/month)
```

**3. Environment Variables**

Same as Railway above.

**4. Deploy**

- Click "Create Web Service"
- Wait for deployment
- Note the URL: `https://audioroad-janus.onrender.com`

---

### Option C: DigitalOcean Droplet (Advanced)

**1. Create Droplet**

```bash
# $12/month Ubuntu droplet
- 2 GB RAM
- 1 vCPU
- Ubuntu 22.04

# SSH into droplet
ssh root@your-droplet-ip
```

**2. Install Docker**

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y
```

**3. Clone & Deploy**

```bash
# Clone your repo
git clone https://github.com/YourUsername/audioroad-broadcast.git
cd audioroad-broadcast

# Set environment variables
export JANUS_API_SECRET=$(openssl rand -base64 32)
export JANUS_ADMIN_SECRET=$(openssl rand -base64 32)
export PUBLIC_IP=$(curl -s ifconfig.me)

# Deploy
docker-compose -f docker-compose.janus.yml up -d

# Check logs
docker logs audioroad-janus -f
```

**4. Configure Firewall**

```bash
# Allow WebSocket port
ufw allow 8188/tcp

# Allow RTP ports
ufw allow 20000:20100/udp

# Allow HTTP (if needed)
ufw allow 8088/tcp
```

---

## Step 2: Update Environment Variables

### Backend (.env in Railway)

Add these to your main app service on Railway:

```bash
# Janus Gateway WebSocket URL
JANUS_WS_URL=wss://your-janus-url.railway.app

# Or for local testing:
# JANUS_WS_URL=ws://localhost:8188
```

### Frontend (Build Environment Variables)

Add to Railway build environment:

```bash
VITE_JANUS_WS_URL=wss://your-janus-url.railway.app
```

**Redeploy main app** after adding these variables!

---

## Step 3: Test Connection

### Test 1: Server Can Connect to Janus

```bash
# Check Railway logs for your main app:
# Should see:
🔌 [WEBRTC] Initializing WebRTC infrastructure...
   Janus URL: wss://your-janus-url.railway.app
✅ [WEBRTC] Connected to Janus Gateway

# If you see:
ℹ️ [WEBRTC] Janus WebSocket URL not configured
# Then environment variable is missing!
```

### Test 2: Browser Can Connect

**Open browser console on your app:**

```javascript
// In browser console:
const ws = new WebSocket('wss://your-janus-url.railway.app');
ws.onopen = () => console.log('✅ Connected to Janus!');
ws.onerror = (e) => console.error('❌ Connection failed:', e);
```

If connection fails:
- Check CORS settings
- Verify Janus is running
- Check firewall rules

---

## Step 4: Complete Call Flow Test

### Test Scenario: One Complete Show

**Setup:**
1. Open 3 browser tabs:
   - Tab 1: Host Dashboard
   - Tab 2: Screener Page
   - Tab 3: Have your phone ready

**Test Flow:**

**1. Start Show (Host)**
```
Host Dashboard → Click "Start Live Show"

Expected:
- ✅ Show status: LIVE
- ✅ Host mic connected (check mixer)
- ✅ If using WebRTC, see "Connected to Janus Gateway"

Check logs:
🔌 [WEBRTC] Joining live room for episode: {id}
✅ [WEBRTC] Joined live room
```

**2. Make Test Call (Your Phone)**
```
Call your Twilio number

Expected:
- ✅ Call appears in screener queue
- ✅ Status: "queued" or "ringing"
- ✅ In 'lobby' room

Check logs:
📞 [MEDIA-BRIDGE] Starting media stream for {CallSid} → lobby
▶️ [MEDIA-BRIDGE] Stream started: {StreamSid}
```

**3. Pick Up Call (Screener)**
```
Screener Page → Click "Pick Up" on queued call

Expected:
- ✅ Call moves to screening
- ✅ Screener can talk to caller
- ✅ Caller can hear screener
- ✅ Private conversation

Check logs:
📞 [SCREENING] Picking up call: {id}
🔄 [MEDIA-BRIDGE] Moving stream from lobby to screening-{episode}-{call}
✅ [SCREENING] Moved caller to screening room
```

**4. Join Screening (Screener - WebRTC)**
```
If using WebRTC mode:
- Toggle "Use WebRTC"
- Browser asks for mic permission → Allow
- Should hear caller

Check logs:
🔌 [WEBRTC] Joining screening room: episode={id}, call={id}
✅ [WEBRTC] Joined screening room
```

**5. Approve Call (Screener)**
```
Screener Page → Click "Approve"

Expected:
- ✅ Call disappears from screener
- ✅ Call appears in host queue
- ✅ Status: "approved"
- ✅ Caller now in live room (muted, hearing show)

Check logs:
✅ [SCREENING] Approving call: {id}
🔄 [MEDIA-BRIDGE] Moving stream to live-{episode}
✅ [SCREENING] Moved caller to live room
```

**6. Put On Air (Host)**
```
Host Dashboard → Find approved call → Click "Put On Air"

Expected:
- ✅ Call status: ON AIR
- ✅ Caller audio appears in mixer
- ✅ Host hears caller
- ✅ Caller hears host

Check logs:
🔊 [LIVE-ROOM] Putting caller on air: {id}
✅ [LIVE-ROOM] Unmuted participant in Janus
✅ [LIVE-ROOM] Caller {id} is now ON AIR
```

**7. Put On Hold (Host)**
```
Host Dashboard → Click "Put On Hold"

Expected:
- ✅ Call status: ON HOLD
- ✅ Caller audio muted in mixer
- ✅ Host doesn't hear caller
- ✅ Caller STILL hears host/show

Check logs:
⏸️ [LIVE-ROOM] Putting caller on hold: {id}
✅ [LIVE-ROOM] Muted participant in Janus
✅ [LIVE-ROOM] Caller {id} is now ON HOLD (hearing show, muted)
```

**8. Put On Air Again (Host)**
```
Host Dashboard → Click "Put On Air" (again!)

Expected:
- ✅ Call status: ON AIR (again!)
- ✅ No audio drops
- ✅ No "call not in progress" errors
- ✅ WORKS INSTANTLY

This is the magic - infinite toggles!

Check logs:
🔊 [LIVE-ROOM] Putting caller on air: {id}
✅ [LIVE-ROOM] Caller {id} is now ON AIR
```

**9. Send Back to Screening (Host)**
```
Host Dashboard → Click "Back to Screening"

Expected:
- ✅ Call returns to screening status
- ✅ Screener can pick up again
- ✅ Private conversation resumed

Check logs:
↩️ [LIVE-ROOM] Sending caller back to screening: {id}
🔄 [MEDIA-BRIDGE] Moving stream to screening-{episode}-{call}
✅ [LIVE-ROOM] Caller {id} sent back to screening
```

**10. End Call**
```
Caller hangs up OR Host clicks "Hang Up"

Expected:
- ✅ Call marked completed
- ✅ Call removed from all queues
- ✅ Clean disconnection

Check logs:
📴 [MEDIA-BRIDGE] Stopping media stream for {CallSid}
📊 [MEDIA-BRIDGE] Final stats: {stats}
✅ [MEDIA-BRIDGE] Media stream stopped
```

---

## Step 5: Verify Audio Quality

### Check Statistics

Every 100 packets (every 2 seconds), you should see:

```
📊 [MEDIA-BRIDGE] CA1234... - 10.0s
   Packets: 500 received, 498 played
   Jitter: 2.35ms avg, buffer: 5/5
   Loss: 2 late, 0 dropped
```

**Good Stats:**
- Jitter: < 10ms average
- Loss: < 1% packets
- Buffer depth: Near target (5)

**Bad Stats:**
- Jitter: > 50ms (network issues)
- Loss: > 5% (quality problems)
- Buffer: Constantly changing (instability)

---

## Step 6: Test Edge Cases

**Test A: Caller Hangs Up During Screening**
- Should clean up gracefully
- Should remove from all queues

**Test B: Browser Refresh**
- Should reconnect to WebRTC
- Should restore state

**Test C: Network Interruption**
- Should attempt reconnection
- Should show user notification

**Test D: Multiple Callers**
- Pick up multiple calls
- Approve multiple calls
- Put multiple callers on air (one at a time or together)

---

## Troubleshooting

### Problem: Can't connect to Janus

**Check:**
```bash
# Verify Janus is running
curl https://your-janus-url/janus/info

# Check firewall
# Verify WebSocket port 8188 is open

# Check logs
# Railway: View logs in dashboard
# DigitalOcean: docker logs audioroad-janus
```

**Fix:**
- Restart Janus service
- Check environment variables
- Verify PUBLIC_IP is set correctly

### Problem: No audio from caller

**Check:**
```bash
# Look for:
📞 [MEDIA-BRIDGE] Starting media stream
▶️ [MEDIA-BRIDGE] Stream started

# Should see packets:
📊 [MEDIA-BRIDGE] ... Packets: N received, M played
```

**Fix:**
- Verify Media Stream endpoint is working
- Check Twilio webhook configuration
- Verify muLaw conversion is working

### Problem: Audio quality poor

**Check jitter buffer stats:**
```bash
# Should see:
Jitter: X.XXms avg, buffer: 5/5
Loss: N late, M dropped
```

**Fix:**
- If jitter > 50ms: Network issues
- If loss > 5%: Increase buffer size
- If buffer fluctuating: Unstable connection

### Problem: "Call is not in progress" error

**This should NEVER happen with WebRTC!**

If you see this:
- You're still using Twilio redirects (old system)
- WebRTC not enabled
- Check JANUS_WS_URL is set

---

## Success Criteria

✅ **Your system is working if:**

1. Host connects via WebRTC (or Twilio Device)
2. Caller connects via phone
3. Screener can hear caller in screening room
4. Host can put caller on air
5. Host can put caller on hold
6. Host can put caller on air AGAIN (infinite toggles!)
7. Audio quality is good (< 5ms jitter)
8. No "call not in progress" errors

---

## Next Steps After Testing

**If everything works:**
1. 🎉 Celebrate! You built a production WebRTC broadcast system!
2. Update documentation with your specific setup
3. Train your team on new workflow
4. Consider Phase 6-7 (edge cases, optimization)

**If issues found:**
1. Check logs for specific errors
2. Test one component at a time
3. Verify environment variables
4. Check firewall/network settings

---

## Performance Tuning (Optional)

**After basic testing works:**

1. **Optimize Jitter Buffer:**
   - Default: 3-20 packets, target 5
   - Low latency network: target 3
   - High latency network: target 8

2. **Monitor Statistics:**
   - Set up logging/monitoring
   - Track audio quality metrics
   - Alert on high packet loss

3. **Scale Janus:**
   - Start with 1 instance
   - Scale up for > 50 concurrent callers
   - Consider dedicated server for > 100

---

## Cost Breakdown

**Janus Gateway:** $25/month (Railway Pro)  
**Main App:** Existing Railway cost  
**Total New Cost:** ~$25/month

**Cheaper alternatives:**
- DigitalOcean Droplet: $12/month
- Self-hosted: $0 (use existing server)

---

## Support & Documentation

**Documentation:**
- `WEBRTC_IMPLEMENTATION.md` - Technical details
- `ENVIRONMENT_SETUP.md` - Environment variables
- `WEBRTC_PROGRESS.md` - Status tracking

**Logs to Check:**
- Railway main app logs
- Railway Janus logs
- Browser console (Network tab)
- Browser console (Console tab)

**Key Log Prefixes:**
- `[WEBRTC]` - WebRTC service
- `[JANUS]` - Janus Gateway
- `[MEDIA-BRIDGE]` - Phone call bridge
- `[SCREENING]` - Screening room
- `[LIVE-ROOM]` - Live room transitions
- `[RTP]` - Packet handling
- `[JITTER]` - Jitter buffer

---

**Ready to deploy! Follow Step 1 to get started.**

