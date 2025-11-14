# Check Call State - Diagnostic Guide

## 🔍 What We Need from Server Logs

When you make a test call and click "Screen", I need to see these specific log messages:

### 1. Call Incoming
```
📞 Incoming call from: +1XXX
✅ [MEDIA-STREAM] Call bridged to room: lobby
```

### 2. Screener Clicks "Screen"
```
✅ [CALL-FLOW] Transition: incoming → screening
✅ [CALL-FLOW] Moved call X to screening room: screening-cmhz6vqlk0001oqc1p3651915-cmhz8alc60009r26eiryn1adg
🔄 [MEDIA-BRIDGE] Moving stream from lobby to screening-...
✅ [MEDIA-BRIDGE] Stream moved to screening-...
```

### 3. Audio Forwarding (Phone → Browser)
```
📡 [LIVEKIT] First audio packet to forward:
   Room: screening-...
   Audio Buffer size: 320 bytes
```

### 4. Audio Forwarding (Browser → Phone)
```
📞 [BROWSER→PHONE] Received X audio packets in 5s for room: screening-...
```

---

## 🚨 What's Probably Happening

Based on your browser logs, I can see:
- ✅ Screener joins screening room: `screening-cmhz6vqlk0001oqc1p3651915-cmhz8alc60009r26eiryn1adg`
- ✅ Browser sends audio: `🎤 [AUDIO-TO-PHONE] Sent 59 audio packets`
- ❌ No audio received

**Most likely cause:**
The server is still forwarding phone audio to `lobby` instead of `screening-X-Y`.

---

## 📋 Action Items

### For You:
1. Make a new test call
2. Click "Screen" to pick up
3. Copy the **server console output** (not browser console)
4. Paste it so I can see if the room move is happening

### What I'm Looking For:
```
# Should see this:
✅ [CALL-FLOW] Moved call X to screening room: screening-...

# If missing, the moveStreamToRoom() isn't being called
# If present but followed by error, the method is failing
```

---

## 🔧 Temporary Workaround

If you want to test the "On Air" button fix without waiting for audio:

1. Refresh Host Dashboard
2. Click "Join Live Room"
3. Click "On Air" button
4. It should work now (no error)
5. The call will transition to "On Air" state
6. (Audio still won't work until we fix the room routing)

---

## 📊 Current Status

### ✅ Fixed:
- Host "On Air" button (removed bad check)
- CallFlowService now calls moveStreamToRoom()
- Backend restarted with fixes

### ❌ Still Broken:
- Audio in screening room (need server logs to diagnose)
- Possible issues:
  - moveStreamToRoom() not being called
  - moveStreamToRoom() failing silently
  - Room name mismatch
  - LiveKit not forwarding data messages

---

**Please paste the server logs from your last test call!**

