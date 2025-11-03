# Comprehensive Fix Plan - Audio On Hold System

**Date:** November 3, 2025, 9:00 PM  
**Status:** STOP - No more rapid fixes. Plan first, then execute carefully.

---

## Current State Assessment

### ✅ **What's Working:**
1. 24/7 Auto DJ plays at correct speed
2. Live show audio switching (with 10-20 sec transition)
3. Auto DJ lock prevents restart during live (liveModeActive)
4. Basic hold audio is playing to callers

### ❌ **What's Broken:**
1. **Screener Room** - NO audio in either direction (caller ↔ screener)
2. **Host Room** - One-way audio only (caller can hear host, host can't hear caller)
3. **Hold Audio Quality** - Distorted/broken after stopping and restarting show
4. **Host vs Screener Audio** - No differentiation for local audio source

---

## Root Cause Analysis

### **Issue #1: Conference Audio Broken**

**What Changed:**
- We added hold audio system (audioCache, wait-audio endpoints)
- These changes may have interfered with conference audio routing

**Likely Causes:**
1. **Mixer routing issue** - Host audio not being sent to conference
2. **Mute/unmute state** - Participants stuck in wrong state
3. **Conference settings** - startConferenceOnEnter or muted flags wrong
4. **Audio device conflict** - Browser trying to use mic for both broadcast and conference

### **Issue #2: Distorted Hold Audio**

**Symptoms:**
- After stop/start cycle, hold audio is distorted
- Audio filtering may be too aggressive (highpass/lowpass)
- Or audioCache not restarting properly after show ends

### **Issue #3: Host vs Screener Audio**

**The Problem:**
- Both use same "voice" WebRTC call
- Both try to send local mic to conference
- But host also broadcasts (needs mic for stream)
- Screener just screens (needs mic for conference only)

**Current Flow (Broken):**
```
Host clicks "Go Live":
  ↓
Local audio starts → Goes to:
  1. Streaming server (for broadcast) ✅
  2. MP3 stream (for phone callers) ✅
  3. Conference??? (should go here but doesn't) ❌

Screener joins conference:
  ↓
No local audio source started??? ❌
```

---

## The Plan (Execute in Order)

### **Phase 1: Understand Current Conference Audio Routing** (Don't Change Yet!)

**Questions to Answer:**
1. How does host audio get to conference currently?
2. How does screener audio get to conference currently?
3. Where did it break? (worked before we added hold audio)

**Action:**
- Review conference code
- Check WebRTC/Twilio voice connection setup
- Find where host mic → conference routing happens
- Document current flow

### **Phase 2: Fix Conference Audio** (Priority #1)

**Goal:** Host and screener can talk to each other and to callers

**Approach:**
1. Check if hold audio changes affected conference settings
2. Verify host audio is being sent to Twilio conference (not just broadcast stream)
3. Check screener voice connection setup
4. Test mute/unmute states

**Don't Touch:**
- Hold audio system (working, don't break it again)
- Auto DJ system (finally working)

### **Phase 3: Improve Hold Audio Quality**

**Issues:**
- Distorted after stop/start
- May be audio filtering too aggressive

**Approach:**
1. Test without filtering first (remove highpass/lowpass temporarily)
2. If clean without filtering, adjust filter settings
3. Check audioCache restart behavior

### **Phase 4: Differentiate Host vs Screener Audio**

**Two Options:**

**Option A: Separate Audio Sources**
```
Host: 
  - Broadcast mic → Streaming server + Conference
  
Screener:
  - Conference mic only → Conference (no broadcast)
```

**Option B: Single Source, Smart Routing**
```
All audio captured once → Routed based on role:
  - Host role: Send to both broadcast and conference
  - Screener role: Send only to conference
```

---

## Immediate Next Steps (Before Any More Fixes)

### **Step 1: Document Current Conference Setup**

**I need to review:**
- How host joins conference via WebRTC
- How screener joins conference
- Where host mic audio goes (should go to conference AND broadcast)
- Conference mute/unmute settings

**Files to check:**
- `server/routes/twilio.ts` (conference TwiML)
- `server/services/conferenceService.ts` (conference operations)
- `src/pages/BroadcastControl.tsx` (host audio routing)
- `src/pages/ScreeningRoom.tsx` (screener audio routing)

### **Step 2: Identify What Broke Conference Audio**

**Compare:**
- Conference audio flow BEFORE we added hold audio
- Conference audio flow AFTER

**Find:**
- Which change broke it
- Why host can't hear caller
- Why screener room has no audio

### **Step 3: Create Minimal Fix**

**Goal:**
- Fix conference audio WITHOUT touching hold audio
- Keep all current working features
- Test thoroughly before moving on

---

## Questions for You

### **Before we continue, I need to know:**

1. **When did conference audio break?**
   - After which specific change/deployment?
   - Did it work yesterday/earlier today?

2. **When you're in screener room:**
   - Can YOU hear your own mic in headphones?
   - Does the caller card show "screening" status?
   - Any errors in browser console?

3. **When you're in host room:**
   - Can YOU hear your own mic in headphones?
   - Can you see audio levels moving for the caller?
   - Any errors in browser console?

4. **Most Important:**
   - Should I focus ONLY on fixing conference audio right now?
   - Or try to fix everything at once?

---

## My Recommendation

**STOP deploying rapid fixes.**

**START with:**
1. Understanding current conference audio flow
2. Finding what broke it
3. Making ONE targeted fix
4. Testing thoroughly
5. Then move to next issue

**This will prevent the cycle of breaking one thing while fixing another.**

---

**Please answer the questions above so I can create a proper fix plan!** 🎯

