# 🚀 Deployment Checklist

**Date:** November 14, 2025, 7:20 PM  
**Commit:** `8142093` - CallSession state machine implementation

---

## ✅ Step 1: Code Pushed (DONE)

- ✅ Changes committed
- ✅ Pushed to GitHub
- ✅ Railway will auto-deploy

---

## ⏳ Step 2: Wait for Railway Build (2-5 minutes)

Check deployment status:
```
https://railway.app → Your Project → Deployments
```

**Expected:**
- 🔄 Building...
- 🔄 Deploying...
- ❌ Crashed (CallSession table missing)

---

## 🔧 Step 3: Run Database Migration (YOU NEED TO DO THIS)

### Quick Method:
```bash
# In your terminal:
cd /Users/kr/Development/audioroad-broadcast
railway login
railway link
railway run npx prisma db push
```

### Alternative Method:
```bash
# Get DATABASE_URL from Railway dashboard
# Then run locally:
DATABASE_URL="your_railway_database_url" npx prisma db push
```

---

## ✅ Step 4: Verify Deployment

After migration, check:
```bash
curl https://audioroad-broadcast-production.up.railway.app/api/health
```

Should return `"status": "ok"`

---

## 🧪 Step 5: Test on Production

1. Open: `https://audioroad-broadcast-production.up.railway.app/screening-room`
2. Click "Open Phone Lines"
3. Call your Twilio number
4. Click "Screen"
5. **Check:** Audio working?
6. Click "Approve"
7. Open Host Dashboard
8. Click "Join Live Room"
9. Click "On Air"
10. **Check:** Button works? Audio works?

---

## 📊 Expected Results

### ✅ Success:
- Call appears in UI
- Audio works in screening
- "On Air" button works
- Audio works on air
- State transitions smoothly

### ❌ If Issues:
- Check Railway logs
- Look for errors
- Report back with logs

---

## 🎯 Current Status

- [x] Code committed
- [x] Code pushed to GitHub
- [ ] Railway build complete
- [ ] Database migration run
- [ ] App running successfully
- [ ] Production test complete

---

**Next: Run the migration on Railway, then test! 🚀**

Commands:
```bash
railway login
railway link
railway run npx prisma db push
```

