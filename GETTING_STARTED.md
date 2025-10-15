# 🎯 Getting Started - Quick Reference

**New to coding?** Read [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed instructions.
**Want to understand the code?** Read [DEVELOPMENT.md](./DEVELOPMENT.md) for technical details.
**Full documentation?** Read [README.md](./README.md) for complete reference.

---

## ⚡ Quick Start (5 Minutes)

If you just want to see it running locally:

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env and add your API keys (see SETUP_GUIDE.md)

# 4. Set up database
npm run prisma:generate
npm run prisma:migrate

# 5. Start backend (Terminal 1)
npm run dev:server

# 6. Start frontend (Terminal 2, new window)
npm run dev

# 7. Open browser
# Go to: http://localhost:5173
```

---

## 📋 Pre-Flight Checklist

Before you can run the app, you need:

- [ ] Node.js installed (v18 or higher)
- [ ] Git installed
- [ ] Twilio account with phone number
- [ ] Anthropic Claude API key
- [ ] AWS S3 bucket configured
- [ ] PostgreSQL database (Railway recommended)
- [ ] All values filled in `.env` file

---

## 🔑 Environment Variables Quick Reference

Copy `.env.example` to `.env` and fill in these **required** values:

```env
DATABASE_URL="postgresql://..."           # Your PostgreSQL connection string
TWILIO_ACCOUNT_SID="ACxxxxx..."          # From Twilio Console
TWILIO_AUTH_TOKEN="xxxxx..."             # From Twilio Console
TWILIO_API_KEY="SKxxxxx..."              # Create in Twilio Console
TWILIO_API_SECRET="xxxxx..."             # From API Key creation
TWILIO_TWIML_APP_SID="APxxxxx..."        # Create TwiML App
TWILIO_PHONE_NUMBER="+1234567890"        # Your Twilio number
ANTHROPIC_API_KEY="sk-ant-xxxxx..."      # From Anthropic Console
AWS_ACCESS_KEY_ID="AKIAxxxxx..."         # From AWS IAM
AWS_SECRET_ACCESS_KEY="xxxxx..."         # From AWS IAM
S3_BUCKET_NAME="your-bucket-name"        # Your S3 bucket
```

---

## 🚀 Deployment Quick Steps

### Deploy to Railway:

```bash
# 1. Push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/audioroad-broadcast.git
git push -u origin main

# 2. Go to railway.app
# 3. New Project → Deploy from GitHub
# 4. Select your repo
# 5. Add PostgreSQL database
# 6. Add all environment variables
# 7. Deploy!
```

### Update Twilio Webhooks:

After deployment, update your Twilio TwiML App:
- Voice URL: `https://your-app.railway.app/api/twilio/incoming-call`
- Status Callback: `https://your-app.railway.app/api/twilio/conference-status`

---

## 📱 Usage Quick Guide

### Host Dashboard
1. Navigate to "Host Dashboard"
2. Click "GO LIVE" to start episode
3. View calls in queue (left panel)
4. Control audio with mixer (center)
5. Use soundboard for audio assets (center)
6. Chat with team (right panel)

### Screening Room
1. Navigate to "Screening Room"
2. View incoming calls
3. Review caller information
4. Click "Approve" to send to host queue
5. Click "Reject" to decline call

### Caller Portal
1. Navigate to "Caller Portal"
2. Fill out call information
3. Optionally upload documents
4. Submit form
5. Call the show hotline number

---

## 🐛 Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| "Cannot find module" | Run `npm install` |
| "Prisma Client not found" | Run `npm run prisma:generate` |
| "Port 3001 already in use" | Close other terminals or change PORT in .env |
| "Database connection failed" | Check DATABASE_URL is correct |
| "Twilio webhook error" | Check webhook URLs in Twilio Console |
| Frontend can't reach backend | Make sure both `npm run dev:server` and `npm run dev` are running |

---

## 📂 Important Files

| File | Purpose |
|------|---------|
| `.env` | Your secret API keys and configuration |
| `prisma/schema.prisma` | Database structure definition |
| `server/index.ts` | Main backend server |
| `src/App.tsx` | Main frontend application |
| `package.json` | Project dependencies and scripts |

---

## 🛠️ Useful Commands

```bash
# Development
npm run dev              # Start frontend dev server
npm run dev:server       # Start backend dev server

# Database
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open database GUI

# Production
npm run build            # Build for production
npm start                # Start production server

# Code quality
npm run lint             # Check code for errors
```

---

## 📊 System Architecture (Simple)

```
┌─────────────┐
│   Caller    │ ──► Calls Twilio Number
└─────────────┘
       │
       ▼
┌─────────────┐
│   Twilio    │ ──► Sends webhook to your server
└─────────────┘
       │
       ▼
┌─────────────┐
│  Your API   │ ──► Stores in database, notifies via WebSocket
└─────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Frontend (Browser)                 │
│  ┌──────────┬──────────┬─────────┐ │
│  │   Host   │ Screener │ Caller  │ │
│  │Dashboard │   Room   │ Portal  │ │
│  └──────────┴──────────┴─────────┘ │
└─────────────────────────────────────┘
```

---

## 🎓 Learning Path

1. **Week 1**: Get it running locally
2. **Week 2**: Deploy to production and test call flow
3. **Week 3**: Customize UI (colors, text, layout)
4. **Week 4**: Add your own features
5. **Month 2+**: Expand to multi-show network

---

## 💰 Cost Breakdown

- **Twilio**: ~$1/month (number) + ~$0.02/min (calls) = ~$20-30/month
- **Anthropic Claude**: ~$10-20/month (usage-based)
- **AWS S3**: ~$1-5/month
- **Railway**: $5/month (hobby plan)
- **Total**: ~$40-60/month

Much cheaper than traditional radio software ($100-500/month)!

---

## 🔗 Quick Links

- [Twilio Console](https://console.twilio.com)
- [Anthropic Console](https://console.anthropic.com)
- [AWS Console](https://console.aws.amazon.com)
- [Railway Dashboard](https://railway.app/dashboard)
- [Prisma Docs](https://www.prisma.io/docs)

---

## 🆘 Need Help?

1. Check error messages in terminal
2. Look at browser console (F12)
3. Read [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed help
4. Read [DEVELOPMENT.md](./DEVELOPMENT.md) to understand code
5. Google the error message
6. Check service status pages (Twilio, Railway, AWS)

---

## ✅ Success Checklist

Before going live with your first show:

- [ ] All dependencies installed
- [ ] Environment variables configured
- [ ] Database initialized and migrated
- [ ] Both dev servers running without errors
- [ ] Can access all three interfaces (Host, Screener, Caller)
- [ ] Test episode created in database
- [ ] Twilio webhooks configured
- [ ] Test call flow end-to-end
- [ ] Upload at least one soundboard asset
- [ ] Practice with co-host/screener

---

**Ready to broadcast? Let's go! 🎙️**

