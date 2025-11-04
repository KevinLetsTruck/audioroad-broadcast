# Testing Instructions - Audio On Hold

## IMPORTANT: How to Test Auto DJ

The Auto DJ **IS working at correct speed** (arealtime filter working!). The issue is you keep starting broadcasts while testing, which pauses it.

### Step-by-Step Test:

1. **Close ALL browser tabs** with broadcast control open
2. **Check you're not live:**
   - Go to: `https://audioroad-broadcast-production.up.railway.app/api/stream/status`
   - Should say: `{"live":false}`
   - If it says `{"live":true}`, you're broadcasting! Close the broadcast tab.

3. **Wait 2 minutes** for Auto DJ segments to build up (arealtime paces audio, so segments created in real-time)

4. **Open NEW incognito window**

5. **Load:** `https://audioroad-streaming-server-production.up.railway.app/live.m3u8`

6. **Should hear:** Auto DJ playing at normal speed

---

## Current Status (From Your Logs):

✅ **Auto DJ speed** - FIXED! Playing at normal speed (2809 chunks in 60s = correct!)

✅ **Live switching** - WORKING! Segments cleared, live audio comes through

⚠️ **50-second delay** - This is because:
- Server just restarted
- Auto DJ needs to create first segments (6 sec each, real-time)
- Then you went live at 28 seconds
- Cleared segments, started over with live audio
- Total: ~50 seconds to first playback

❌ **Phone caller static** - Audio filtering deployed, needs testing

---

## To Test Phone Caller Audio:

1. **Make sure you're broadcasting** (not Auto DJ - callers need live audio to test)
2. **Start episode and go live**
3. **Call in from your phone**
4. **Listen for:**
   - Clear audio (no static)
   - Your live voice
   - No white noise

The audio filtering I added should remove the static!

---

## Summary:

**The systems ARE working!** You just need to:
- Test Auto DJ when NOT broadcasting (close all broadcast tabs)
- Test phone calls WHILE broadcasting (so there's audio to hear)
- Give systems time to buffer after cold starts

Your next test: **Start a broadcast, then call in** to test if the static is fixed!



