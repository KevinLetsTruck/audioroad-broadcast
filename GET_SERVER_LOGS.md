# How to Get Server Logs

## 🚨 I Need Server Logs to Fix Audio!

The servers are running in the background, so I can't see their output. Here's how to get the logs:

---

## Option 1: Restart Servers in Foreground (Recommended)

This will show logs in real-time:

### Step 1: Stop Background Servers
```bash
cd /Users/kr/Development/audioroad-broadcast
pkill -f "tsx watch server/index.ts"
pkill -f "vite"
```

### Step 2: Start Backend in One Terminal
```bash
cd /Users/kr/Development/audioroad-broadcast
npm run dev:server
```

**Keep this terminal open** - you'll see server logs here.

### Step 3: Start Frontend in Another Terminal
Open a new terminal tab/window:
```bash
cd /Users/kr/Development/audioroad-broadcast
npm run dev -- --host
```

### Step 4: Make a Test Call
1. Open `http://localhost:5173/screening-room` in incognito
2. Click "Open Phone Lines"
3. Call your Twilio number
4. Click "Screen"
5. **Watch the backend terminal** for log messages

### Step 5: Copy the Logs
From the backend terminal, copy everything from when you clicked "Screen" and paste it here.

---

## Option 2: Check Existing Logs (If Available)

If you started the servers from a terminal (not background), you can:

1. Find the terminal window where you ran `npm run dev:server`
2. Scroll up to see the logs
3. Copy from when the call came in
4. Paste here

---

## 🔍 What I'm Looking For

### Good Signs (Audio Working):
```
✅ [CALL-FLOW] Moved call X to screening room: screening-...
🔄 [MEDIA-BRIDGE] Moving stream from lobby to screening-...
✅ [MEDIA-BRIDGE] Stream moved to screening-...
📡 [LIVEKIT] First audio packet to forward
📞 [BROWSER→PHONE] Received X audio packets
```

### Bad Signs (Audio Broken):
```
❌ [CALL-FLOW] Failed to move stream to screening room
❌ [MEDIA-BRIDGE] Room mapping mismatch!
ℹ️ [BROWSER→PHONE] No caller in room: screening-...
```

---

## 🎯 Why This Matters

The browser logs show:
- ✅ Screener joins room: `screening-cmhz6vqlk0001oqc1p3651915-cmhz8alc60009r26eiryn1adg`
- ✅ Browser sends audio packets
- ❌ No audio received

This means either:
1. Server isn't moving the phone stream to the screening room
2. Server is moving it but the room name doesn't match
3. LiveKit isn't forwarding the data messages

**I can only tell which one by seeing the server logs!**

---

## 🚀 Quick Test (After Restarting in Foreground)

1. Backend terminal: `npm run dev:server`
2. Frontend terminal: `npm run dev -- --host`
3. Browser: Open screening room
4. Click "Open Phone Lines"
5. Call from your phone
6. Click "Screen"
7. **Watch backend terminal** - copy all output
8. Paste here

---

**Let's get those server logs and fix this audio! 🎧**

