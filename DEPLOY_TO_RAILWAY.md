# 🚀 Deploy AudioRoad Broadcast Platform to Railway

## Quick Deploy (5 Minutes)

### Step 1: Push to GitHub

```bash
cd /Users/kr/Development/audioroad-broadcast

# Create GitHub repo first at: https://github.com/new
# Name it: audioroad-broadcast

# Then push:
git remote add origin https://github.com/YOUR_USERNAME/audioroad-broadcast.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Railway

1. Go to https://railway.app
2. Click **"New Project"**
3. Click **"Deploy from GitHub repo"**
4. Select `audioroad-broadcast`
5. Railway will auto-detect and start building!

### Step 3: Add Environment Variables

In Railway project settings → Variables, add these:

```env
PORT=3001
NODE_ENV=production

# Database (Railway will auto-generate, or use your existing one)
DATABASE_URL=postgresql://postgres:rsEmnhTMefpJxAwmgAXNLuYAhkmtYHiY@centerbeam.proxy.rlwy.net:19847/railway

# Twilio (get from Twilio Console)
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_API_KEY=your_api_key_here
TWILIO_API_SECRET=your_api_secret_here
TWILIO_TWIML_APP_SID=your_twiml_app_sid_here
TWILIO_PHONE_NUMBER=+1234567890

# AI (get from Google AI Studio)
GEMINI_API_KEY=your_gemini_api_key_here

# S3
S3_BUCKET_NAME=destinationhealth-medical-docs-dev

# App URL (get from Railway after first deploy)
APP_URL=https://your-app-name.up.railway.app
```

### Step 4: Update APP_URL

1. After Railway deploys, copy the URL (looks like: `audioroad-production.up.railway.app`)
2. Go back to Variables
3. Update `APP_URL` to: `https://audioroad-production.up.railway.app`
4. Railway will auto-redeploy

### Step 5: Configure Twilio Webhooks

1. Go to Twilio Console
2. Find your TwiML App: `APc5747fbee296f23951e03390130fba09`
3. Update **Voice Request URL** to: 
   ```
   https://your-app-name.up.railway.app/api/twilio/incoming-call
   ```
4. Save

---

## ✅ You're Live!

Visit: `https://your-app-name.up.railway.app`

You'll see:
- 🎬 Show Setup
- 🎙️ Host Dashboard  
- 🔍 Screening Room
- 📞 Call Now

Share the "Call Now" page URL with your listeners!

---

## 🎯 First Show Checklist

Before going live:
- [ ] Create your show in Show Setup
- [ ] Create today's episode
- [ ] Click GO LIVE
- [ ] Test Call Now button
- [ ] Brief your screener
- [ ] Upload soundboard assets
- [ ] Ready to broadcast!

---

## 🐛 Troubleshooting

**Build fails:**
- Check Railway logs
- Verify all environment variables are set
- Make sure Prisma migrations ran

**Calls don't connect:**
- Verify Twilio webhook URL is correct
- Check Twilio console for errors
- Test with a test call first

**Database errors:**
- Run migrations: Railway should auto-migrate
- Check DATABASE_URL is correct

---

## 📞 Give Callers This Info

**Web Call-In**: `https://your-app.up.railway.app/call-now`  
**Phone Number**: `+1 (888) 804-9791`

90% will use the web button, 10% will call the number!

---

**Deployment time: ~5-10 minutes total** 🚀

