# 🧪 Beta Testing Guide - AudioRoad Broadcast Platform

## Welcome Beta Testers!

Thank you for helping test the new AudioRoad broadcast platform! This guide will help you test the system effectively.

---

## 🎯 What We're Testing

**WORKING (Please Test):**
- ✅ Single caller workflow (one at a time)
- ✅ Web calls (browser-based calling)
- ✅ Phone calls (traditional phone number)
- ✅ Call screening process
- ✅ Host dashboard interface
- ✅ Document uploads
- ✅ Team chat

**NOT READY (Do Not Test):**
- ❌ Multiple simultaneous callers (Twilio upgrade pending)
- ❌ Advanced audio mixing

---

## 🔗 Access URLs

**For Host:**
- Main Dashboard: `https://audioroad-broadcast-production.up.railway.app/`
- Direct to Host Dashboard: `https://audioroad-broadcast-production.up.railway.app/host-dashboard`

**For Screener:**
- Screening Room: `https://audioroad-broadcast-production.up.railway.app/screening-room`

**For Callers (Testing):**
- Call Now Page: `https://audioroad-broadcast-production.up.railway.app/call-now`
- OR call the Twilio phone number directly

---

## 📱 Test Scenarios

### Scenario 1: Basic Web Call (15 min)

**Role: Caller**
1. Open Call Now page in browser
2. Wait for "LIVE NOW" indicator
3. (Optional) Upload a document
4. Click "Call Now" button
5. Wait for screener to connect
6. Talk to screener about your topic

**Role: Screener**
1. Open Screening Room
2. Wait for incoming call notification
3. Click "Pick Up" when call appears
4. Talk to caller, gather info
5. Fill in Name and Topic fields
6. Click "✓ Approve" to send to host

**Role: Host**
1. Open Host Dashboard
2. Wait for approved call to appear in queue
3. Click "Connect" button
4. Talk to the caller
5. Click "End Call" when finished

**Expected Result:** Full call flow works smoothly, audio both ways, clean disconnection

---

### Scenario 2: Phone Call (10 min)

**Role: Caller**
1. Call the Twilio phone number from your phone
2. Listen to greeting message
3. Wait for screener
4. Discuss your topic

**Rest is same as Scenario 1** (screener approves, host connects)

**Expected Result:** Phone calls work as well as web calls

---

### Scenario 3: Multiple Calls (Sequential) (20 min)

**Test calling ONE AT A TIME:**

1. **Call #1**: Complete full workflow (caller → screener → host → end call)
2. **Call #2**: New caller calls AFTER first call ended
3. **Call #3**: Another caller calls AFTER second call ended

**Expected Result:** Each call works perfectly when done sequentially

**KNOWN LIMITATION:** Cannot have 2 callers on air simultaneously (Twilio upgrade pending)

---

### Scenario 4: Document Upload & Analysis (15 min)

**Role: Caller**
1. Before calling, upload a document (PDF, image, etc.)
2. Make the call
3. Mention you uploaded a document

**Role: Host**
1. While on call with caller
2. Click "📄 Documents" button in Host Dashboard
3. View AI-generated analysis
4. Ask caller questions based on AI findings

**Expected Result:** Document uploads successfully, AI analysis appears, helps conversation

---

### Scenario 5: Team Chat (10 min)

**Role: Screener**
1. Send message in chat panel (right side of Screening Room)
2. Message should appear for host

**Role: Host**
1. See screener's message in chat panel (right side of Host Dashboard)
2. Reply to screener
3. Screener should see reply instantly

**Expected Result:** Real-time chat works, no delays

---

## 🐛 What to Look For

### Things to Report:

**Audio Issues:**
- Can't hear caller?
- Caller can't hear you?
- Echo or feedback?
- Choppy/delayed audio?

**Connection Issues:**
- Call won't connect?
- Gets stuck on "Connecting..."?
- Drops unexpectedly?
- Takes multiple tries?

**UI/UX Issues:**
- Buttons don't work?
- Confusing labels or workflows?
- Information missing?
- Hard to find something?

**Bugs:**
- Error messages?
- Page crashes?
- Data not saving?
- Features not working as expected?

---

## 📝 How to Report Issues

**For each issue, note:**
1. **What you were trying to do**
2. **What happened instead**
3. **Your role** (Host/Screener/Caller)
4. **Browser** (Chrome, Firefox, Safari, etc.)
5. **Any error messages** (screenshot if possible)

**Send to:** [Your contact method]

---

## ✅ Success Criteria

**Call it a success if:**
- ✅ Calls connect reliably (90%+ success rate)
- ✅ Audio quality is good (clear, no major issues)
- ✅ Workflow makes sense (not confusing)
- ✅ No major bugs or crashes
- ✅ Screener can efficiently vet callers
- ✅ Host can manage calls easily

**Nice to have:**
- Documents upload and analyze correctly
- Chat works smoothly
- Interface is intuitive
- Looks professional

---

## 🎓 Tips for Effective Testing

1. **Test on different browsers** - Chrome, Firefox, Safari
2. **Test on mobile** - Try calling from phone browser
3. **Try to break it** - Click buttons multiple times, refresh during calls, etc.
4. **Use real scenarios** - Pretend you're a real caller with a real topic
5. **Note small issues too** - Even tiny UX improvements help!

---

## ⏰ Testing Timeline

**Before Show:**
- 15-30 min of testing
- Report any blocking issues immediately

**During Show:**
- Use legacy system (this is BETA!)
- Note any features you wish you had

**After Show:**
- Longer testing session
- Try all scenarios
- Provide detailed feedback

---

## 🙏 Thank You!

Your feedback will help make AudioRoad's broadcast platform world-class!

**Remember:**
- This is BETA - some quirks are expected
- Single caller mode only (for now)
- Your input shapes the final product

**Questions?** Contact [Your info here]

---

**Happy Testing!** 🎙️✨

