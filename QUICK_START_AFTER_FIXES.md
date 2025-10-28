# 🚀 Quick Start Guide - After Today's Fixes

**Everything is ready to test!** Here's how to get started in 5 minutes.

---

## Step 1: Start the Servers (2 terminals)

**Terminal 1 - Backend:**
```bash
cd /Users/kr/Development/audioroad-broadcast
npm run dev:server
```

**Terminal 2 - Frontend:**
```bash
cd /Users/kr/Development/audioroad-broadcast
npm run dev
```

---

## Step 2: Create Admin User

**Terminal 3:**
```bash
cd /Users/kr/Development/audioroad-broadcast
npm run create:admin
```

**You'll see:**
```
✅ Admin user created successfully!

📧 Email: admin@audioroad.com
🔑 Password: admin123
👤 Name: Admin User
🎭 Role: admin
```

---

## Step 3: Login

1. Open browser: http://localhost:5173
2. You'll be redirected to: http://localhost:5173/login
3. Enter credentials:
   - Email: `admin@audioroad.com`
   - Password: `admin123`
4. Click "Sign In"
5. You're in! 🎉

---

## Step 4: Test the Call Flow

### Option A: Quick Test (Solo)

1. After login, you'll see **Broadcast Control**
2. Click **"START SHOW"**
3. Open a new incognito window: http://localhost:5173/call-now
4. Click **"Call Now"**
5. Back in main window, go to **Screening Room**
6. You should see the incoming call!
7. Pick it up, approve it
8. Go to **Host Dashboard**
9. Take the call on-air
10. Test multiple calls - no refresh needed!

### Option B: Full Test (With Partner)

1. **You (Host):** Login as admin
2. **Partner (Caller):** Open http://localhost:5173/call-now
3. **Partner:** Clicks "Call Now"
4. **You:** Go to Screening Room
5. **You:** Pick up call, chat with partner
6. **You:** Approve the call
7. **You:** Go to Host Dashboard
8. **You:** Take call on-air
9. **Both:** Verify two-way audio works!
10. **You:** End call
11. **Partner:** Make another call (no refresh!)
12. **Repeat:** It should work perfectly

---

## Step 5: Test END SHOW Cleanup

1. While on a call, click **"END SHOW"**
2. Call should disconnect immediately
3. Database should show call as completed
4. Start new show - fresh state confirmed!

---

## 🎯 What Should Work Now

✅ Login/logout  
✅ Multiple calls per episode  
✅ No page refresh needed between calls  
✅ Calls always appear in screener  
✅ Clean episode endings  
✅ Role-based access (host vs screener pages)  
✅ Two-way audio  
✅ Call state persistence  

---

## 🔧 Creating More Users

### Host User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "host@audioroad.com",
    "password": "host123",
    "name": "John Host",
    "role": "host"
  }'
```

### Screener User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "screener@audioroad.com",
    "password": "screener123",
    "name": "Jane Screener",
    "role": "screener"
  }'
```

Then login with those credentials!

---

## 🐛 Troubleshooting

### "No live episode found"
- Click "START SHOW" first
- Make sure you're logged in as host/admin

### "Authentication required"
- Login expired
- Go to /login and sign in again

### Call doesn't appear in screener
- Wait 1-2 seconds (WebSocket sync)
- Check that show is live
- Refresh the screening room page

### Can't login
- Did you run `npm run create:admin`?
- Check credentials are correct
- Check server is running (Terminal 1)

### Build errors
- Run `npm install` to ensure all packages installed
- Check that Node.js is up to date

---

## 📊 Check Logs

### Server Logs (Terminal 1)
Look for:
- `✅ [AUTH] Login successful` - Login working
- `📞 [VOICE] Creating call record` - Calls coming in
- `✅ [EPISODE] Episode ended` - Clean endings

### Browser Console (F12)
Look for:
- `✅ Login successful` - Frontend auth working
- `✅ [SCREENER] Successfully joined episode room` - WebSocket connected
- `📞 [SCREENER] Incoming call event received` - Calls arriving

---

## 🎉 Success Indicators

You know everything is working when:

1. ✅ Can login and see dashboard
2. ✅ Can start a show
3. ✅ Calls appear in screening room
4. ✅ Can make multiple calls without refresh
5. ✅ END SHOW disconnects all calls
6. ✅ Different users see different pages based on role

---

## 🚀 Next Steps

Once testing confirms everything works:

1. **Deploy to Railway**
   ```bash
   git add .
   git commit -m "Added authentication and fixed call state"
   git push
   ```

2. **Run migration on Railway**
   - Railway will auto-run `prisma migrate deploy`

3. **Create production admin user**
   - SSH into Railway or use Railway CLI
   - Run `npm run create:admin` with custom credentials

4. **Update environment variables**
   - Add strong `JWT_SECRET` in Railway
   - Update `APP_URL` to production URL

5. **Test in production**

6. **Launch! 🎊**

---

## 📝 Important Notes

- **Change admin password** after first login (add this feature soon)
- **JWT_SECRET** should be different in production
- **HTTPS** required for production (Railway provides this)
- **Backup database** regularly
- **Monitor logs** for issues

---

## ✅ Checklist

Before going live:

- [ ] Tested login/logout
- [ ] Tested multiple calls
- [ ] Tested END SHOW cleanup
- [ ] Created host and screener users
- [ ] Tested role-based access
- [ ] Deployed to Railway
- [ ] Updated production environment variables
- [ ] Created production admin user
- [ ] Tested production deployment
- [ ] Changed admin password
- [ ] Ready to launch! 🚀

---

**You're all set! Start testing and enjoy your production-ready broadcast platform!** 🎉

