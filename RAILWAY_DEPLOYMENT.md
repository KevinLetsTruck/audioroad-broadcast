# Railway Deployment - Database Migration Required

**Status:** 🟡 Code pushed, waiting for migration  
**Date:** November 14, 2025, 7:15 PM

---

## ✅ Code Deployed

Your changes have been pushed to GitHub:
```
commit 8142093
feat: Implement CallSession state machine and fix audio routing
```

Railway will automatically detect this and start deploying.

---

## 🚨 CRITICAL: Database Migration Required

The new code requires the `CallSession` table, but Railway's database doesn't have it yet.

### What Will Happen:
1. Railway builds and deploys the new code
2. App starts
3. **App will crash** with error: `relation "public.CallSession" does not exist`
4. You need to run the migration

---

## 🔧 How to Run Migration on Railway

### Option 1: Railway CLI (Recommended)

```bash
# Install Railway CLI if you don't have it
npm install -g @railway/cli

# Login
railway login

# Link to your project
cd /Users/kr/Development/audioroad-broadcast
railway link

# Run migration
railway run npx prisma db push
```

### Option 2: Railway Dashboard

1. Go to Railway dashboard: https://railway.app
2. Open your project: `audioroad-broadcast-production`
3. Click on your service
4. Go to "Settings" → "Deploy"
5. Wait for the deployment to finish (it will crash)
6. Go to "Settings" → "Variables"
7. Click "Raw Editor"
8. Copy your `DATABASE_URL`
9. In your local terminal:
   ```bash
   cd /Users/kr/Development/audioroad-broadcast
   DATABASE_URL="paste_railway_database_url_here" npx prisma db push
   ```
10. Restart the Railway service

### Option 3: Railway Shell

1. Go to Railway dashboard
2. Open your project
3. Click on your service
4. Click "Shell" tab (if available)
5. Run:
   ```bash
   npx prisma db push
   ```

---

## ⏱️ Deployment Timeline

### Immediate (0-2 minutes):
- ✅ Code pushed to GitHub
- 🔄 Railway detects changes
- 🔄 Railway starts building

### 2-5 minutes:
- 🔄 Railway builds Docker image
- 🔄 Railway deploys new image
- ❌ App crashes (CallSession table missing)

### After Migration (5-10 minutes):
- ✅ You run `prisma db push` on Railway
- ✅ CallSession table created
- ✅ App restarts successfully
- ✅ Ready to test!

---

## 📊 How to Check Deployment Status

### Check Railway Dashboard:
```
https://railway.app
→ Your project
→ Deployments tab
→ Look for latest deployment
```

### Check if it's running:
```bash
curl https://audioroad-broadcast-production.up.railway.app/api/health
```

Should return:
```json
{
  "status": "ok",
  "services": {
    "database": { "status": "connected" }
  }
}
```

---

## 🧪 After Migration - Test Procedure

Once the migration is complete and the app is running:

1. **Open Production App:**
   ```
   https://audioroad-broadcast-production.up.railway.app/screening-room
   ```

2. **Open Phone Lines**

3. **Make Test Call** from your phone

4. **Click "Screen"**
   - ✅ Should hear audio now!

5. **Click "Approve"**

6. **Open Host Dashboard** (new tab)

7. **Click "Join Live Room"**

8. **Click "On Air"**
   - ✅ Should work now!
   - ✅ Should hear audio!

---

## 🔍 What to Watch For

### Good Signs (Working):
```
✅ Call appears in UI
✅ Audio in screening (both directions)
✅ "On Air" button works
✅ Audio on air (both directions)
✅ State transitions smoothly
```

### Bad Signs (Still Broken):
```
❌ App crashes on Railway
❌ 500 errors in browser
❌ No audio
❌ "On Air" button errors
```

---

## 📝 Railway Logs

After deployment, check Railway logs:
```
Railway Dashboard → Your Service → Logs
```

Look for:
```
✅ [CALL-FLOW] State machine initialized
✅ [WEBRTC] Connected to LiveKit Cloud
✅ [CALL-FLOW] Moved call X to screening room
```

---

## 🚀 Next Steps

1. **Run the migration on Railway** (choose one of the 3 options above)
2. **Wait for app to restart** (check Railway dashboard)
3. **Test on production** (make a real call)
4. **Report results!**

---

**The code is deployed! Now run the migration and test! 🎉**

See: `TWILIO_LOCAL_TESTING.md` for why local testing didn't work.

