# Testing Locally with Twilio - ngrok Required

## 🚨 The Problem

Your Twilio phone number is configured to call the **production server** on Railway:
```
https://audioroad-broadcast-production.up.railway.app
```

When you make a test call, it goes to production, not your local server at `localhost:3001`.

**This is why:**
- ❌ No call logs in your local server
- ❌ No audio (because the call isn't on your local server)
- ❌ Can't test your fixes

---

## ✅ The Solution: Use ngrok

To test locally with real phone calls, you need to expose your local server to the internet using ngrok.

### Step 1: Install ngrok

```bash
# If you don't have ngrok:
brew install ngrok

# Or download from: https://ngrok.com/download
```

### Step 2: Start ngrok

```bash
ngrok http 3001
```

You'll see output like:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3001
```

**Copy that `https://abc123.ngrok.io` URL!**

### Step 3: Update Twilio Phone Number Configuration

1. Go to Twilio Console: https://console.twilio.com
2. Go to Phone Numbers → Manage → Active Numbers
3. Click on your phone number: `+18888049791`
4. Scroll to "Voice Configuration"
5. Find "A CALL COMES IN" webhook
6. Change from:
   ```
   https://audioroad-broadcast-production.up.railway.app/api/twilio/incoming
   ```
   To:
   ```
   https://abc123.ngrok.io/api/twilio/incoming
   ```
   (Use YOUR ngrok URL!)

7. Click "Save"

### Step 4: Test Again

Now when you call your Twilio number:
- ✅ Call goes to your local server
- ✅ You'll see logs in your terminal
- ✅ Audio routing will work
- ✅ You can test all your fixes

---

## 🎯 Alternative: Test Without Phone Calls

If you don't want to use ngrok, you can test the state machine without actual phone calls:

### Use Prisma Studio to Simulate Calls

1. Open Prisma Studio:
   ```bash
   npx prisma studio
   ```

2. Go to `Call` table

3. Create a test call manually:
   - Click "Add record"
   - Fill in:
     - `callerId`: (use an existing caller ID)
     - `episodeId`: `cmhz6vqlk0001oqc1p3651915`
     - `status`: `queued`
     - `twilioCallSid`: `TEST123` (fake)
     - `phoneNumber`: `+14075551234` (fake)

4. Create a `CallSession` for it:
   - Go to `CallSession` table
   - Click "Add record"
   - Fill in:
     - `callId`: (the ID from step 3)
     - `phase`: `incoming`
     - `currentRoom`: `lobby`
     - `twilioCallSid`: `TEST123`
     - `sendMuted`: `true`
     - `recvMuted`: `false`

5. The call should now appear in your UI!

6. Test state transitions (without audio):
   - Click "Screen" → Check if `CallSession.phase` changes to `screening`
   - Click "Approve" → Check if phase changes to `live_muted`
   - Click "On Air" → Check if phase changes to `live_on_air`

**This tests the state machine without needing phone calls!**

---

## 🔍 Why Your Test Didn't Work

When you called your Twilio number:
1. Twilio received the call
2. Twilio called the webhook: `https://audioroad-broadcast-production.up.railway.app/api/twilio/incoming`
3. **Production server** handled it (not your local server)
4. Your local server never saw the call
5. Browser connected to `localhost:5173` but the call was on production
6. No audio because the call isn't on your local server

---

## 🎯 Recommended Approach

### For Full Testing (with audio):
Use ngrok to route Twilio to your local server.

### For State Machine Testing (no audio):
Use Prisma Studio to create fake calls and test transitions.

### For Production Testing:
Deploy your fixes to Railway and test there.

---

## 📋 What to Do Next

**Option A: Test Locally with ngrok**
1. Install ngrok
2. Run `ngrok http 3001`
3. Update Twilio webhook
4. Make test call
5. See logs in your terminal!

**Option B: Test State Machine Only**
1. Use Prisma Studio to create fake call
2. Test UI transitions
3. Verify `CallSession` updates correctly
4. Deploy to Railway for audio testing

**Option C: Deploy to Railway**
1. Push your changes to git
2. Railway auto-deploys
3. Test on production
4. Check Railway logs

---

## 💡 My Recommendation

**Use Option B (Prisma Studio) to test the state machine first.**

This will verify:
- ✅ UI shows calls correctly
- ✅ "On Air" button works
- ✅ State transitions work
- ✅ `CallSession` updates correctly

Then deploy to Railway to test audio with real calls.

---

**Which option do you want to try?**

