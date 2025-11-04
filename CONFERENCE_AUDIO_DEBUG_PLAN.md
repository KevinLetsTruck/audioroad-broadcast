# Conference Audio Debug Plan

**Current Status:** Both screener and host conference audio broken  
**Priority:** CRITICAL - Blocks all testing

---

## 🔴 **Issues**

### **Issue A: Screener Room - No Audio Either Direction**
- Screener can't hear caller
- Caller can't hear screener
- This should be simplest (screener doesn't use mixer)

### **Issue B: Host Room - One-Way Audio**
- Host CAN hear caller ✅
- Caller CANNOT hear host ❌
- Host mic locked by mixer

### **Issue C: Overlapping Streams**
- 24/7 DJ + Live playing together
- **Fix deployed:** Reduced buffer from 60s to 12s
- **Test needed:** After Railway deployment

---

## 📊 **Deployments in Progress**

**Streaming Server:**
- Reduced HLS buffer to 12 seconds
- Should fix overlapping audio
- **ETA:** 3-5 minutes

**Main Broadcast App:**
- Reverted broken mic cloning
- Removed mixer changes that didn't work
- **ETA:** 3-5 minutes

---

##  🧪 **Testing Plan (After 5 Minutes)**

### **Test 1: Overlapping Audio Fix**
```
1. Safari incognito - load streaming URL
2. Auto DJ playing
3. Chrome - start broadcast
4. Expected: 10-15 seconds overlap (down from 60!)
5. Then: ONLY live audio
6. Success metric: Can hear your show opener clearly after 15 sec
```

### **Test 2: Screener Audio**
```
1. Start episode
2. Call in from phone
3. Open screener room
4. Click "Pick Up"
5. CHECK BROWSER CONSOLE for errors
6. Try talking - can caller hear you?
7. Can you hear caller?
8. Share any console errors with me
```

### **Test 3: Host Audio**
```
1. Keep caller on hold
2. Open host dashboard  
3. Click to join as host
4. CHECK BROWSER CONSOLE for errors
5. Try talking - can caller hear you?
6. Can you hear caller?
7. Share any console errors with me
```

---

## 🔍 **What I Need From You**

### **For Screener Issue:**

When you open screener room and click "Pick Up":
```
1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Click "Pick Up"
4. Screenshot or copy ALL console messages
5. Especially any red ERROR messages
6. Share with me
```

### **For Host Issue:**

When you join as host:
```
1. Open Chrome DevTools
2. Click to join conference as host
3. Copy all console messages
4. Look for:
   - "Microphone already in use"
   - "Permission denied"
   - "NotAllowedError"
   - Any Twilio errors
5. Share with me
```

---

## 🎯 **Next Steps**

### **After Testing (in 5-10 min):**

**If overlapping audio is fixed (reduced to ~12 sec):**
- ✅ Mark as acceptable
- Move to conference audio

**If screener audio broken:**
- Debug based on console errors
- Likely: Twilio device init issue or permission problem

**If host audio broken:**
- Probably: Mixer has mic, Twilio can't get it
- Solution: Release mixer mic, let Twilio have it, re-add to mixer after
- Or: Use different mic for conference

---

## 📋 **Information Needed**

1. **Console errors from screener room** (when picking up call)
2. **Console errors from host room** (when joining conference)
3. **How bad is the overlap after new deployment?** (should be ~12 sec not 60 sec)

---

**Please test after 5 minutes and share:**
- How much overlap you still hear (seconds)
- Console errors from screener pickup
- Console errors from host join

Then I can create targeted fixes instead of guessing! 🎯


