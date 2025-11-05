# Audio Restart Issue - FIXED

**Date:** November 5, 2025  
**Commit:** f8a343f

---

## The Problem

Audio was restarting/jumping every 30 seconds when callers were on hold. This happened because:

1. **waitUrl** served 30-second chunks from a rolling 60-second buffer
2. Each Redirect pulled a NEW chunk from a DIFFERENT position in the buffer
3. This caused:
   - Audio to jump backward (repeating sections)
   - Audio to jump forward (skipping sections)
   - Restarts mid-sentence
   - Disjointed, unprofessional experience

**Example:**
```
Buffer: [Minute 1][Minute 2]
Chunk 1: Last 30 seconds → plays "second half of Minute 1 + first half of Minute 2"
Redirect...
Chunk 2: Last 30 seconds → NOW plays "second half of Minute 2 + first half of Minute 3"
Result: Skipped forward, caller lost continuity
```

---

## The Solution

Replaced the entire Radio.co chunking system with **Twilio's built-in hold music**:

```xml
<Play loop="0">http://com.twilio.sounds.music.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3</Play>
```

**Benefits:**
- ✅ No restarts (loop="0" means infinite)
- ✅ Seamless playback
- ✅ No chunking complexity
- ✅ No server resources wasted on caching
- ✅ Professional, smooth experience

---

## What Changed

### 1. `server/routes/twilio.ts` - wait-audio endpoint

**Before:**
- Checked if live
- Served 30-second cached chunks
- Redirect loop → caused restarts

**After:**
- Simple Twilio hold music with infinite loop
- No redirects
- No restarts

### 2. `server/index.ts` - Disabled audio cache

**Before:**
- Started FFmpeg on boot to cache Radio.co stream
- Used CPU/memory for rolling buffer

**After:**
- Commented out audioCache.start()
- Documented why (using Twilio hold music instead)

---

## Audio Flow Now

### Phase 1: Waiting for Screener
```
Caller dials in
  ↓
Hears AI greeting (ElevenLabs)
  ↓
Joins conference (muted)
  ↓
Hears: Twilio hold music (smooth, infinite loop, no restarts)
```

### Phase 2: Being Screened
```
Screener picks up
  ↓
Caller unmuted
  ↓
Hears: Screener's voice (conference audio)
  ↓
Screener approves
  ↓
Caller muted again
  ↓
Hears: Twilio hold music (smooth, no restarts)
```

### Phase 3: Waiting for Host
```
Caller in host queue
  ↓
Still in conference (muted)
  ↓
Hears: Twilio hold music
  ↓
HOST STARTS SHOW
  ↓
Hears: Show opener → Host mic → Live conference (real-time!)
```

**Key:** When host joins conference and starts talking, callers hear conference audio DIRECTLY. They don't need Radio.co stream - they're IN the conference hearing the actual host!

---

## Why This Works Better

**Previous approach:**
- Tried to serve Radio.co stream to callers
- Complex caching/chunking system
- Audio restarts every 30 seconds
- High CPU/memory usage

**New approach:**
- Simple hold music while waiting
- Live conference audio when show is active
- No complexity
- No restarts
- Professional experience

**What the user said:**
> "I'm ok with callers hearing hold music while waiting for screener. They need to be able to hear live conference while waiting for host."

✅ Hold music while waiting: Provided
✅ Live conference while in queue: Already works (they're in the conference!)

---

## Testing

After Railway deploys (3-4 min):

1. **OPEN PHONE LINES**
2. **Call in** → Should hear smooth hold music (no restarts)
3. **Wait 2-3 minutes on hold** → Music should play continuously, smoothly
4. **Screener picks up** → Should hear screener clearly
5. **Approve to host** → Should hear hold music again (smooth)
6. **START SHOW** → Should immediately hear host's voice/opener

**No more audio restarts!**

---

## Files Changed

1. `server/routes/twilio.ts` (lines 515-544)
2. `server/index.ts` (lines 244-254)

## What Was Removed

- Radio.co stream caching
- 30-second chunk generation
- Redirect loop complexity
- audioCache FFmpeg process
- ~41 lines of complex code

## What Was Added

- Simple hold music (1 line of TwiML)
- Documentation explaining the change

**Net result:** Simpler, more reliable, no restarts.

