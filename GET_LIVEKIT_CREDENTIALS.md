# Get LiveKit Credentials

## 🚨 URGENT: You need LiveKit credentials to test WebRTC audio

The WebRTC token endpoint is returning 503 because LiveKit credentials are missing from your `.env` file.

---

## Option 1: Get from Railway (Recommended)

Your production app already has LiveKit configured. Get the credentials from Railway:

1. **Go to Railway Dashboard:**
   ```
   https://railway.app
   ```

2. **Open your project:** `audioroad-broadcast-production`

3. **Click on your service** (the one running the backend)

4. **Go to "Variables" tab**

5. **Find and copy these 3 values:**
   - `LIVEKIT_WS_URL` (should be: `wss://audioroad-broadcast-st6f3yzp.livekit.cloud`)
   - `LIVEKIT_API_KEY` (looks like: `APIxxxxxxxxxxxxxxx`)
   - `LIVEKIT_API_SECRET` (looks like: a long random string)

6. **Update your local `.env` file:**
   ```bash
   cd /Users/kr/Development/audioroad-broadcast
   nano .env
   ```

   Replace these lines at the bottom:
   ```env
   LIVEKIT_WS_URL=wss://audioroad-broadcast-st6f3yzp.livekit.cloud
   LIVEKIT_API_KEY=paste_your_actual_key_here
   LIVEKIT_API_SECRET=paste_your_actual_secret_here
   ```

7. **Save and restart the backend:**
   ```bash
   pkill -f "tsx watch server/index.ts"
   npm run dev:server
   ```

---

## Option 2: Create New LiveKit Project (If Railway doesn't have it)

1. **Go to LiveKit Cloud:**
   ```
   https://cloud.livekit.io
   ```

2. **Sign in or create account**

3. **Create a new project:**
   - Name: `audioroad-broadcast-local`
   - Region: Choose closest to you

4. **Copy credentials:**
   - After creating, you'll see:
     - WebSocket URL (starts with `wss://`)
     - API Key (starts with `API`)
     - API Secret (long random string)

5. **Add to `.env`** (same as Option 1, step 6-7)

---

## ✅ Verify It Works

After adding credentials and restarting:

```bash
# Check health endpoint
curl http://localhost:3001/api/webrtc/health

# Should see:
# {
#   "status": "ok",
#   "roomManager": "initialized",
#   "mediaBridge": "initialized",
#   "connected": true
# }
```

---

## 🧪 Then Test Again

1. Open Screening Room: `http://localhost:5173/screening-room`
2. Click "Open Phone Lines"
3. Call your Twilio number
4. Click "Screen" to pick up
5. **You should now hear audio!** 🎉

---

## 🐛 Still Not Working?

Check server logs for:
```
✅ [WEBRTC] Connected to LiveKit Cloud
✅ [WEBRTC] Phone call bridge enabled
```

If you see:
```
❌ [WEBRTC] Failed to connect to LiveKit
```

Then your credentials are wrong. Double-check them in Railway.

---

## 📝 Quick Command Reference

```bash
# View current .env (without secrets)
cat .env | grep LIVEKIT

# Edit .env
nano .env

# Restart backend
pkill -f "tsx watch server/index.ts" && npm run dev:server

# Check if LiveKit is working
curl http://localhost:3001/api/webrtc/health
```

---

**Once you have the credentials, the WebRTC audio will work! 🚀**

