# 🚂 Railway Deployment - Clerk Integration

## Current Status

✅ Code pushed to GitHub  
✅ Railway is deploying...  
⏳ Need to add Clerk environment variables  

---

## 🔧 Step 1: Add Environment Variables to Railway

### Go to Railway Dashboard

1. Go to: **https://railway.app**
2. Sign in
3. Click your **audioroad-broadcast** project
4. Click on your **web service** (the main app)

### Add Clerk Variables

Click **"Variables"** tab, then add these:

**Add Variable #1:**
- Name: `VITE_CLERK_PUBLISHABLE_KEY`
- Value: `pk_test_cmVhZHktZG92ZS02NC5jbGVyay5hY2NvdW50cy5kZXYk`

**Add Variable #2:**
- Name: `CLERK_SECRET_KEY`
- Value: `sk_test_aTul5B4ldsXsIB76IbdM1OaXAvcJt1xHzCbWe7O6p4`

**Add Variable #3 (Important!):**
- Name: `JWT_SECRET`
- Value: Generate a random secret (use this):
  ```
  your-super-secret-jwt-key-change-in-production-abc123xyz789
  ```

Click **"Add"** after each one.

---

## 🔄 Step 2: Wait for Deployment

After adding variables, Railway will automatically redeploy.

**Watch the deployment:**
- Click **"Deployments"** tab
- Watch the build logs
- Wait for **"Success"** status
- Usually takes 2-3 minutes

**Look for:**
```
✅ Server running on port 3001
📊 Database: Connected
📞 Twilio: Configured
🔌 WebSocket available
```

---

## 🌐 Step 3: Update Clerk Allowed Origins

### In Clerk Dashboard:

1. Go to: **https://dashboard.clerk.com**
2. Select **"AudioRoad Broadcast"** app
3. Go to **"Domains"** (in left sidebar)
4. Under **"Allowed redirect URLs"**, add your Railway URL:
   - Get it from Railway → Settings → Domains
   - Should look like: `https://audioroad-broadcast-production.up.railway.app`
   - Add: `https://audioroad-broadcast-production.up.railway.app/*`
5. Click **"Save"**

---

## 🧪 Step 4: Test on Production

### Find Your Railway URL

In Railway dashboard:
- Click your project
- Look for the URL (usually shows at top)
- Or go to Settings → Domains

Example: `https://audioroad-broadcast-production.up.railway.app`

### Test Authentication

1. **Open your Railway URL** in browser
2. You should be redirected to `/sign-in`
3. **Sign up** with Google or email
4. **Verify email** (check inbox)
5. You should be logged in!

### Assign Your Role

1. Go to Clerk dashboard → Users
2. Click your user
3. Edit Public metadata:
   ```json
   {
     "role": "admin"
   }
   ```
4. Save
5. Refresh your Railway app
6. **You should see Broadcast Control!** 🎉

---

## 🎯 Step 5: Test the Call Flow

### On Production:

1. **Sign in as admin**
2. Go to **Broadcast Control**
3. Click **"START SHOW"**
4. Open **new incognito window** → `your-railway-url/call-now`
5. Click **"Call Now"**
6. In main window, go to **Screening Room**
7. Should see the call!
8. Test complete flow

---

## 🐛 Troubleshooting

### "Missing Clerk Publishable Key"

**Solution:** 
- Check Railway variables are set correctly
- Variable names must be EXACT (including VITE_ prefix)
- Redeploy after adding variables

### "Redirect URI mismatch"

**Solution:**
- Add your Railway URL to Clerk "Allowed redirect URLs"
- Include the `/*` at the end
- Example: `https://your-app.railway.app/*`

### Database Migration Not Applied

Railway should auto-run `prisma migrate deploy` on deployment.

**Check logs:**
- Railway → Deployments → Latest → View logs
- Look for: `✅ Migrations applied`

**If migrations didn't run:**
```bash
# In Railway, go to your service
# Click "..." menu → "Run Command"
# Enter: npx prisma migrate deploy
```

### Build Failed

Check Railway build logs for errors.

**Common issues:**
- Missing environment variables
- TypeScript errors (we already tested locally, so should be fine)

---

## 📋 Deployment Checklist

- [ ] Pushed code to GitHub ✅
- [ ] Railway is deploying ✅
- [ ] Added VITE_CLERK_PUBLISHABLE_KEY to Railway
- [ ] Added CLERK_SECRET_KEY to Railway
- [ ] Added JWT_SECRET to Railway
- [ ] Added Railway URL to Clerk allowed origins
- [ ] Deployment succeeded
- [ ] Can access Railway URL
- [ ] Sign-in page appears
- [ ] Can sign up
- [ ] Email verification works
- [ ] Assigned admin role in Clerk
- [ ] Can access all pages
- [ ] Calls work on production
- [ ] Multiple calls work
- [ ] END SHOW cleanup works

---

## 🎨 Optional: Custom Domain

If you want a custom domain (like broadcast.audioroad.com):

### In Railway:
1. Settings → Domains
2. Click "Add Domain"
3. Enter your domain
4. Add DNS records (Railway shows you exactly what to add)

### In Clerk:
1. Add your custom domain to allowed origins
2. Update branding to match

---

## 🔐 Security Note

**Current Keys:** Test/Development keys  
**For Production:** You should create production Clerk keys

### When Ready for Production:

1. In Clerk dashboard, switch to "Production" environment
2. Copy production keys (pk_live_... and sk_live_...)
3. Update Railway variables with production keys
4. Redeploy

**For now, test keys are fine for testing!**

---

## 📊 What to Monitor

### Railway Logs:

Watch for:
- ✅ Build success
- ✅ Migrations applied
- ✅ Server started
- ✅ Database connected
- ✅ Twilio configured

### Clerk Dashboard:

Monitor:
- User signups
- Login attempts
- Session activity
- Social login usage

---

## 🎯 Expected Timeline

- **Push to GitHub:** Done ✅
- **Railway build:** 2-3 minutes
- **Add environment variables:** 2 minutes (you)
- **Redeploy:** 2-3 minutes
- **Configure Clerk origins:** 1 minute (you)
- **Test:** 5 minutes
- **Total:** ~10-15 minutes

---

## 🚀 After Successful Deployment

### You'll Have:

1. **Live broadcast platform** accessible anywhere
2. **Professional authentication** with Clerk
3. **Social logins** working
4. **Role-based access** protecting pages
5. **Reliable call system** with all fixes
6. **Ready for beta testing** with real users!

### Next Steps:

1. **Invite your team:**
   - Send them your Railway URL
   - They sign up
   - You assign roles in Clerk
   - They start using it!

2. **Test thoroughly:**
   - Run a practice show
   - Test all features
   - Gather feedback

3. **Customize branding:**
   - Add your logo to Clerk
   - Match your colors
   - Professional look!

4. **Plan beta launch:**
   - Pick a test show
   - Invite beta testers
   - Run real broadcast
   - Iterate based on feedback

---

## 💡 Pro Tips

**Tip 1: Watch Railway Logs Live**
- Railway dashboard → Deployments → View Logs
- See what's happening in real-time

**Tip 2: Use Railway CLI**
```bash
npm i -g @railway/cli
railway login
railway logs
```

**Tip 3: Quick Variable Updates**
- Railway dashboard → Variables
- Add/edit anytime
- Auto-redeploys

---

## ✅ Ready!

**Go to Railway dashboard now and add those environment variables!**

Then watch the deployment and test your live app! 🎉

**Your Railway URL will be like:**
`https://audioroad-broadcast-production-xxxx.up.railway.app`

---

**Let me know when deployment succeeds and I'll help you test!** 🚀

