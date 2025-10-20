# 🔧 Railway Deployment Loop - Root Cause & Fix

**Date:** October 20, 2025  
**Status:** ✅ **FIXED** (Just pushed new deployment)

---

## 🐛 The Real Problem

### Why Railway Was Stuck in a Loop

Railway was stuck in an **initialization loop** because of this issue:

**The Build Script Was Running Migrations During Build Time**

```json
// OLD (BROKEN)
"build": "prisma generate && prisma migrate deploy && ..."
```

### What Was Happening:

1. **Railway starts building** → Runs `npm run build`
2. **Build script tries to run** `prisma migrate deploy`
3. **Prisma needs** `DATABASE_URL` environment variable
4. **❌ DATABASE_URL isn't available** during the build phase in Railway
5. **Migration fails** → Build completes but broken
6. **Server starts** → Tries to query database with unmigrated schema
7. **Server crashes** → Railway thinks deployment failed
8. **Railway retries** → Loop begins again ♾️

---

## ✅ The Solution

### Moved Database Migrations from Build Time → Runtime

**Key Insight:** Environment variables (like `DATABASE_URL`) are available at **runtime** but might not be during **build time**.

### What I Changed:

#### 1. **Created a Startup Script** (`start.sh`)
```bash
#!/bin/bash
# Run migrations AFTER build, when DATABASE_URL is available
npx prisma migrate deploy

# Then start the server
exec node dist/server/index.js
```

#### 2. **Updated Build Script** (Removed migration from build)
```json
// NEW (FIXED)
"build": "prisma generate && tsc && vite build && tsc -p server/tsconfig.json"
"start": "bash start.sh"
```

Now:
- ✅ **Build phase**: Only compiles code (no database needed)
- ✅ **Start phase**: Runs migrations THEN starts server

#### 3. **Added Node.js Version Lock** (`.nvmrc`)
```
20.14.0
```
Ensures Railway uses the correct Node version.

#### 4. **Added Nixpacks Config** (`nixpacks.toml`)
```toml
[phases.setup]
nixPkgs = ["nodejs-20_x", "openssl"]

[phases.install]
cmds = ["npm ci"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm start"
```
Tells Railway exactly how to build the project.

#### 5. **Added Procfile**
```
web: npm start
```
Railway convention for web processes.

#### 6. **Updated Railway Config** (`railway.json`)
```json
{
  "deploy": {
    "startCommand": "bash start.sh",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 300
  }
}
```
Added health check and explicit startup command.

---

## 📊 What Happens Now

### New Deployment Flow:

```
1. Railway receives Git push ✅
   ↓
2. Build Phase (no database needed)
   - npm ci (install dependencies)
   - prisma generate (generate Prisma client)
   - tsc (compile TypeScript)
   - vite build (build frontend)
   ↓
3. Deploy Phase (DATABASE_URL available)
   - bash start.sh runs
   - Migrations run: npx prisma migrate deploy ✅
   - Server starts: node dist/server/index.js ✅
   ↓
4. Health Check
   - Railway checks /api/health endpoint
   - Gets 200 OK response ✅
   ↓
5. Deployment ACTIVE! 🎉
```

### Expected Timeline:
- **Build**: 2-4 minutes
- **Deploy & Migrate**: 30-60 seconds
- **Total**: ~3-5 minutes

---

## 👀 What to Watch For

### In Railway Dashboard:

#### ✅ Good Signs:
- New deployment appears with commit message "Fix Railway build loop..."
- Status changes: INITIALIZING → BUILDING → DEPLOYING → **ACTIVE**
- Timestamp updates (not stuck)
- Green checkmark appears

#### View Logs - Look For:
```
✅ Prisma schema loaded from prisma/schema.prisma
✅ 1 migration found in prisma/migrations
✅ Applying migration...
✅ Applied migration in Xms
🎙️ Starting AudioRoad Broadcast Platform...
✅ Server running on port 3001
```

#### ❌ Bad Signs (If Still Failing):
- Stuck at "INITIALIZING" for >10 minutes
- Error messages in logs
- Status keeps resetting

---

## 🔍 If It's Still Not Working

### Step 1: Check Environment Variables in Railway

Make sure these are set in Railway → Your Project → Variables:

**Required:**
- ✅ `DATABASE_URL` (Railway Postgres provides this automatically)
- ✅ `NODE_ENV=production`

**Optional but recommended:**
- `PORT` (Railway auto-assigns if not set)
- `TWILIO_*` (all your Twilio credentials)
- `GEMINI_API_KEY`
- `APP_URL` (your Railway app URL)

### Step 2: View Deployment Logs

1. Click "View logs" on the newest deployment
2. Scroll through to find the error
3. Common errors:

**"Cannot find module 'prisma'"**
→ Database connection issue

**"Migration failed"**
→ Check DATABASE_URL is correct

**"Port already in use"**
→ Railway port conflict (rare)

### Step 3: Cancel Old Deployments

In Railway:
1. Find the stuck old deployments
2. Click "..." menu → Cancel
3. Let only the newest deployment run

### Step 4: Restart the Service

In Railway:
1. Go to your service
2. Settings → Restart
3. Watch the fresh deployment

---

## 🎯 Next Steps After Deployment Succeeds

### 1. **Verify Your App is Live**

Visit: `https://your-project.up.railway.app`

You should see the AudioRoad dashboard.

### 2. **Test the Health Endpoint**

Visit: `https://your-project.up.railway.app/api/health`

Should return:
```json
{
  "status": "ok",
  "timestamp": "2025-10-20T...",
  "service": "AudioRoad Broadcast Platform",
  "version": "1.0.0"
}
```

### 3. **Update APP_URL Environment Variable**

1. Copy your Railway URL
2. Go to Variables
3. Set `APP_URL=https://your-project.up.railway.app`
4. Railway will auto-redeploy (should be quick this time)

### 4. **Configure Twilio Webhooks**

Update your Twilio TwiML app to point to:
```
https://your-project.up.railway.app/api/twilio/incoming-call
```

### 5. **Test a Call**

Visit: `https://your-project.up.railway.app/call-now`

Click the call button and make sure it connects!

---

## 📚 What You Learned

### The Core Lesson:

**Different deployment phases have different capabilities:**

| Phase | What It Does | Has DATABASE_URL? |
|-------|-------------|-------------------|
| **Build** | Compile code, install dependencies | ❌ Maybe not |
| **Deploy/Start** | Run the application | ✅ Yes |

**Rule:** Database operations should happen at **runtime** (start), not **build time**.

### Why This Matters:

- ✅ Builds are faster (no waiting for database)
- ✅ Same build can deploy to multiple environments
- ✅ Migrations run with fresh database connection
- ✅ Easier to debug (logs are clearer)

---

## 🎓 For Your Learning

You mentioned you're new to coding, so here's what happened in simple terms:

**Think of it like cooking:**
- **Build phase** = Prep work (chop vegetables, measure ingredients)
- **Deploy phase** = Cooking (turn on the stove, combine ingredients)

We were trying to use the stove during the prep phase! 🔥

The database is like the stove - it's only available when we're actually cooking (deploying), not while we're just chopping vegetables (building).

**The fix:** We moved the "turn on the stove" step from prep to cooking time.

---

## 📋 Files Changed

| File | Purpose |
|------|---------|
| `start.sh` | Runs migrations then starts server |
| `.nvmrc` | Locks Node.js version |
| `nixpacks.toml` | Tells Railway how to build |
| `Procfile` | Tells Railway what command to run |
| `railway.json` | Railway-specific config |
| `package.json` | Moved migration from build to start |

---

## ✅ Status Check

**Current Status:** New deployment is initializing
**Expected Outcome:** Should be ACTIVE in ~3-5 minutes
**What to Do:** Watch the Railway dashboard

---

**Last Updated:** October 20, 2025  
**Commit:** `7088813` - "Fix Railway build loop: Move migrations to runtime..."

🚀 **Check Railway now - new deployment should be in progress!**

