# Priority Fix Plan - Immediate Action Needed

**Current Status:** Live audio switching works, but system unstable

---

## CRITICAL DECISION NEEDED

We've been fighting the Auto DJ FFmpeg timing for hours. Here are your options:

### **Option A: Disable Auto DJ Temporarily** ⭐ RECOMMENDED
- Focus on making live shows work perfectly  
- Phone callers work during broadcasts
- Use simple hold music when no broadcast
- Add proper Auto DJ back later when stable

### **Option B: Continue Debugging Auto DJ**
- Keep trying to fix FFmpeg rate limiting
- Risk more instability
- Could take many more hours

---

## Immediate Issues to Fix (Either Option):

### 1. Conference Ending When It Shouldn't
**Logs show:**
```
17:30:07 - conference-end
17:30:07 - participant-leave (both caller and screener)
```

The conference is ending, disconnecting callers. Need to investigate why `startConferenceOnEnter="true"` isn't keeping it alive.

### 2. Multiple live-stop Signals
Each broadcast end triggers 3-4 "live-stop" signals, causing:
- Auto DJ to resume multiple times
- Overlapping streams
- Confusion

### 3. Auto DJ Playing at 100x Speed
Without proper rate limiting, Auto DJ is useless anyway.

---

## My Recommendation

**Let's simplify immediately:**

1. **Disable Auto DJ on streaming server**
2. **Use hold music for phone callers** when no broadcast
3. **Fix the conference ending issue** (critical!)
4. **Get live broadcasts working perfectly**
5. **Add back Auto DJ later** with a simpler approach (maybe pre-encoded MP3 loop)

This gets you a **working system TODAY** instead of fighting FFmpeg timing issues.

---

## What do you want to do?

**Reply with:**
- **"A"** = Disable Auto DJ, use hold music, fix live broadcasts
- **"B"** = Keep debugging Auto DJ (will take more time)

I recommend **Option A** - get your system stable and working for live shows, then enhance with Auto DJ later.

