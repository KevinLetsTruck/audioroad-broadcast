# 🧪 Test Clerk Authentication - RIGHT NOW!

## Quick 5-Minute Test

### Step 1: Start Everything

**Terminal 1:**
```bash
cd /Users/kr/Development/audioroad-broadcast
npm run dev:server
```

**Terminal 2:**
```bash
cd /Users/kr/Development/audioroad-broadcast
npm run dev
```

Wait for: `✅ Server running on port 3001`

---

### Step 2: Open Your App

Go to: **http://localhost:5173**

You'll be redirected to: **http://localhost:5173/sign-in**

**🎨 You should see Clerk's beautiful sign-in page!**

---

### Step 3: Sign Up

Click **"Sign up"** at the bottom

**Option A: Use Google (Easiest)**
1. Click "Continue with Google"
2. Choose your Google account
3. Done! You're signed in!

**Option B: Use Email**
1. Enter your email
2. Create a password (min 8 characters)
3. Check your email for verification code
4. Enter the code
5. Done! You're signed in!

---

### Step 4: You're In... But Access Denied?

You'll see an **"Access Denied"** message. This is normal!

**Why?** You don't have a role assigned yet.

---

### Step 5: Assign Your Role

1. Go to: **https://dashboard.clerk.com**
2. Sign in (same account you used to create Clerk app)
3. Click your "AudioRoad Broadcast" application
4. Click **"Users"** in left sidebar
5. Click on **your user** (the one you just created)
6. Scroll down to **"Public metadata"**
7. Click **"Edit"**
8. Paste this:
   ```json
   {
     "role": "admin"
   }
   ```
9. Click **"Save"**

---

### Step 6: Refresh Your App

Go back to: **http://localhost:5173**

Press: **Ctrl+R** (Windows) or **Cmd+R** (Mac)

**🎉 You should now see the Broadcast Control page!**

---

### Step 7: Explore!

**What you should see:**
- Navigation bar at top
- Your name and role displayed
- User button in top-right (click it!)
- All pages accessible
- Beautiful, professional interface

**Click the user button (top-right) to:**
- See your profile
- Manage account
- Sign out
- View settings

---

## 🎭 Test Different Roles

### Make Yourself a Screener

1. Go back to Clerk dashboard
2. Edit your metadata to:
   ```json
   {
     "role": "screener"
   }
   ```
3. Save and refresh app

**Result:** You should ONLY see:
- Screening Room
- Recordings  
- Settings

Try accessing `/` - you'll see "Access Denied"! ✅

### Make Yourself Admin Again

1. Change metadata back to:
   ```json
   {
     "role": "admin"
   }
   ```
2. Refresh app
3. Now you can access everything again!

---

## 📱 Test Social Login

### Google Login

1. Sign out (click user button → Sign out)
2. You'll see sign-in page again
3. Click **"Continue with Google"**
4. Choose your Google account
5. Instantly signed in! ✅

### Microsoft Login (if enabled)

Same process, just click "Continue with Microsoft"

---

## 🧪 Test Complete Call Flow (With Auth)

### Now Test the Actual Broadcast System:

1. **Sign in as admin**
2. Go to **Broadcast Control**
3. Click **"START SHOW"**
4. Open new incognito window: http://localhost:5173/call-now
5. Click **"Call Now"** (no login needed - public page!)
6. Back in main window, go to **Screening Room**
7. See the call appear
8. Pick it up, approve it
9. Go to **Host Dashboard**
10. Take call on-air
11. **Make multiple calls** - they should all work!
12. Click **"END SHOW"** - everything cleans up!

---

## ✅ What Should Work

### Authentication:
- ✅ Sign up with email
- ✅ Sign in with email/password
- ✅ Sign in with Google
- ✅ Email verification
- ✅ Password reset (click "Forgot password?")
- ✅ Sign out
- ✅ Role-based page access

### Call System:
- ✅ Start show
- ✅ Receive calls
- ✅ Screen calls
- ✅ Take calls on-air
- ✅ Multiple calls per episode
- ✅ Clean episode endings

---

## 🐛 If Something Doesn't Work

### "Missing Clerk Publishable Key"

Check `.env` file has:
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_cmVhZHktZG92ZS02NC5jbGVyay5hY2NvdW50cy5kZXYk
CLERK_SECRET_KEY=sk_test_aTul5B4ldsXsIB76IbdM1OaXAvcJt1xHzCbWe7O6p4
```

Restart servers after adding!

### "Access Denied" after sign-in

Assign a role in Clerk dashboard (see Step 5 above)

### Social login not working

Check Clerk dashboard → "Social Connections" → Enable the providers

### Calls not working

Make sure you:
1. Started both servers
2. Are signed in
3. Have "host" or "admin" role
4. Clicked "START SHOW"

---

## 🎊 Success Indicators

You know it's working when:

✅ Beautiful Clerk sign-in page appears  
✅ Can sign up and sign in  
✅ See your name in top-right  
✅ Role-based pages show/hide correctly  
✅ User button works (profile, sign out)  
✅ Calls work perfectly  
✅ Everything feels professional  

---

## 📸 What You Should See

### Sign-In Page:
- Clean, modern design
- AudioRoad logo/branding (can customize)
- Email + password fields
- Social login buttons
- "Sign up" link
- "Forgot password?" link

### After Sign-In (Admin):
- Navigation bar with all pages
- Your name + role in nav
- User button (avatar) in top-right
- Broadcast Control page
- Professional, polished interface

### User Button Dropdown:
- Manage account
- Sign out
- Profile picture
- Email address

---

## ⏱️ Time Required

- **First sign-up:** 2 minutes
- **Assigning role:** 1 minute  
- **Testing pages:** 2 minutes
- **Testing calls:** 5 minutes
- **Total:** ~10 minutes

---

## 🎯 After Testing

Once you've confirmed everything works:

1. **Invite your team:**
   - Send them http://localhost:5173/sign-up
   - They create accounts
   - You assign roles in Clerk dashboard
   - They can immediately use the platform!

2. **Customize branding:**
   - Go to Clerk dashboard → Customization
   - Upload your logo
   - Set your colors
   - Match AudioRoad brand

3. **Enable MFA (optional):**
   - Clerk dashboard → User & Authentication
   - Turn on MFA
   - Users can enable 2FA in their profile

---

## 🚀 Ready to Test?

**Right now, do this:**

1. Open Terminal 1: `npm run dev:server`
2. Open Terminal 2: `npm run dev`
3. Open Browser: http://localhost:5173
4. Sign up with Clerk
5. Assign admin role
6. Refresh
7. **Enjoy your professional auth system!** 🎉

---

**Questions? Just ask! Otherwise, go test it - you're going to love it!** 😊

