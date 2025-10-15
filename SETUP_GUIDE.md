# 🚀 Setup Guide for Non-Developers

This guide will help you set up the AudioRoad Broadcast Platform step-by-step, even if you have no coding experience.

## What You'll Need

1. A computer (Mac or Windows)
2. About 2 hours for initial setup
3. Credit card for service signups (most have free tiers)

## Step 1: Install Required Software

### Install Node.js

Node.js is what runs the application.

1. Go to https://nodejs.org
2. Download the "LTS" version (left button)
3. Run the installer
4. Keep clicking "Next" with default settings
5. Restart your computer

**Test it worked:**
- Open Terminal (Mac) or Command Prompt (Windows)
- Type: `node --version`
- You should see something like `v20.10.0`

### Install Git

Git helps manage your code.

1. Go to https://git-scm.com
2. Download for your operating system
3. Install with default settings

## Step 2: Get API Keys

You need accounts with these services. Don't worry - I'll walk you through each one.

### 2a. Twilio (for phone calls)

**What it costs:** ~$20-30/month for your show

1. Go to https://www.twilio.com/try-twilio
2. Sign up for free account
3. Verify your phone number and email
4. Once logged in, go to Console Dashboard

**Get your credentials:**
- Find "Account SID" - copy it
- Find "Auth Token" - click to reveal, copy it
- Click "Get a Trial Number" or "Buy a Number"
  - Choose a number
  - Make sure it has "Voice" capability
  - Copy the phone number

**Create API Key:**
1. In Twilio Console, go to "Account" → "API keys & tokens"
2. Click "Create API Key"
3. Give it a name like "Broadcast Platform"
4. Copy the SID and Secret (you can't see secret again!)

**Create TwiML App:**
1. Go to "Voice" → "TwiML Apps"
2. Click "Create new TwiML App"
3. Name it "AudioRoad Broadcast"
4. Leave URLs blank for now (we'll add them after deployment)
5. Save and copy the "SID"

### 2b. Anthropic Claude (for AI)

**What it costs:** ~$10-20/month

1. Go to https://console.anthropic.com
2. Sign up for account
3. Go to "API Keys"
4. Create new key
5. Copy it immediately (you can't see it again!)

### 2c. AWS (for file storage)

**What it costs:** ~$1-5/month

1. Go to https://aws.amazon.com
2. Create free account
3. Go to "S3" service
4. Click "Create Bucket"
   - Name: `audioroad-recordings-yourname` (must be unique)
   - Region: Choose closest to you
   - Uncheck "Block all public access" (we need files accessible)
   - Create bucket

**Get credentials:**
1. Click your name (top right) → "Security Credentials"
2. Scroll to "Access Keys"
3. Click "Create access key"
4. Choose "Application running on AWS compute service"
5. Copy Access Key ID and Secret Access Key

### 2d. Railway (for hosting)

**What it costs:** $5/month

1. Go to https://railway.app
2. Sign up with GitHub account
3. No API key needed yet - we'll use it later

## Step 3: Set Up The Code

### Download the Project

1. Open Terminal (Mac) or Command Prompt (Windows)
2. Type these commands one at a time:

```bash
cd ~/Desktop
git clone https://github.com/yourusername/audioroad-broadcast
cd audioroad-broadcast
npm install
```

(This might take 5-10 minutes - it's downloading all the code libraries)

### Create Environment File

1. In the project folder, create a file named `.env`
2. Copy this template and fill in your keys from Step 2:

```env
# Server
PORT=3001
NODE_ENV=development

# Database (we'll set this up in Step 4)
DATABASE_URL="postgresql://user:password@localhost:5432/audioroad_broadcast"

# Twilio (paste your values from Step 2a)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_SECRET=your_api_secret_here
TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890

# Claude AI (paste from Step 2b)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# AWS S3 (paste from Step 2c)
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
S3_BUCKET_NAME=audioroad-recordings-yourname

# App URL
APP_URL=http://localhost:5173
```

**Important:** Replace all the `xxxxx` values with your actual keys!

## Step 4: Set Up Database

### Option A: Use Railway Database (Recommended)

1. Go to https://railway.app
2. Click "New Project"
3. Click "Provision PostgreSQL"
4. Wait for it to create (30 seconds)
5. Click on the PostgreSQL service
6. Go to "Connect" tab
7. Copy the "Postgres Connection URL"
8. Paste it as your `DATABASE_URL` in the `.env` file

### Option B: Local Database (More Complex)

1. Download PostgreSQL from https://www.postgresql.org/download/
2. Install with default settings
3. Remember the password you set
4. Use this as DATABASE_URL:
   ```
   DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/audioroad"
   ```

### Initialize the Database

Run these commands:

```bash
npm run prisma:generate
npm run prisma:migrate
```

You should see "Migration complete" messages.

## Step 5: Test Locally

### Start the Application

You need **TWO terminal windows**:

**Terminal 1:**
```bash
npm run dev:server
```

Wait until you see "Server running on port 3001"

**Terminal 2:**
```bash
npm run dev
```

Wait until you see "Local: http://localhost:5173"

### Open in Browser

1. Go to http://localhost:5173
2. You should see "AudioRoad Network - Broadcast Platform"
3. Try clicking through the different tabs

**If you see errors:**
- Make sure both terminals are running
- Check that all your API keys are correct in `.env`
- Look at the terminal output for clues

## Step 6: Deploy to Production

### Push to GitHub

1. Create repository at https://github.com/new
2. Name it `audioroad-broadcast`
3. In terminal:

```bash
git add .
git commit -m "Initial setup"
git remote add origin https://github.com/yourusername/audioroad-broadcast.git
git push -u origin main
```

### Deploy to Railway

1. Go to https://railway.app
2. Click "New Project"
3. Choose "Deploy from GitHub repo"
4. Select `audioroad-broadcast`
5. Click "Add Variables"
6. Copy ALL variables from your `.env` file
7. Change `APP_URL` to your Railway URL (shown after first deploy)
8. Click "Deploy"

Wait 3-5 minutes for first deployment.

### Update Twilio Webhooks

1. Go back to Twilio Console
2. Go to your TwiML App
3. Set Voice URL to: `https://your-railway-url.com/api/twilio/incoming-call`
4. Set Status Callback: `https://your-railway-url.com/api/twilio/conference-status`
5. Save

### Get Your Show's Call-In Number

The phone number from Step 2a is your show hotline!

Give this to callers: **Your Twilio number from Step 2a**

## Step 7: Create Your First Show

### Using Prisma Studio

1. In terminal: `npm run prisma:studio`
2. Opens in browser at http://localhost:5555
3. Click "Show" table
4. Click "Add record"
5. Fill in:
   - name: "The AudioRoad Show"
   - slug: "audioroad-show"
   - hostId: "host-1" (any ID)
   - hostName: "Your Name"
   - schedule: `{"days":["mon","tue","wed","thu"],"time":"15:00","duration":180}`
6. Save

### Create First Episode

1. In Prisma Studio, click "Episode"
2. Add record:
   - showId: (select the show you just created)
   - episodeNumber: 1
   - title: "Episode 1"
   - date: Today's date
   - scheduledStart: Today at show time
   - scheduledEnd: Today at show end time
   - status: "scheduled"
3. Save

## Step 8: Go Live!

### On Show Day

1. Go to your Railway URL
2. Click "Host Dashboard"
3. You should see your episode
4. Click "GO LIVE"
5. Audio mixer and call queue activate
6. Give callers your Twilio phone number
7. Screener approves calls in "Screening Room"
8. Calls appear in your queue
9. Click "Take Call On-Air"

### For Call Screener

1. Open a different browser/tab
2. Go to "Screening Room"
3. Wait for calls to come in
4. Review caller info
5. Click "Approve" or "Reject"

## Troubleshooting

### "Can't connect to database"
- Check your DATABASE_URL is correct
- Make sure Railway PostgreSQL is running

### "Twilio error"
- Verify all Twilio credentials are correct
- Check webhook URLs are set correctly

### "API key invalid"
- Double-check you copied keys correctly
- Make sure no extra spaces

### "Port already in use"
- Close other terminal windows
- Change PORT in .env to 3002

## Getting Help

**Logs to check:**
- Terminal 1 (server logs)
- Terminal 2 (frontend logs)
- Railway logs (in Railway dashboard)
- Twilio Console → Monitor → Logs

**Common fixes:**
1. Restart both terminal windows
2. Clear browser cache
3. Run `npm install` again
4. Delete `node_modules` folder and run `npm install`

## Next Steps

Once everything is working:

1. Upload audio assets for soundboard
2. Create more episodes for upcoming shows
3. Test the full call flow
4. Invite your co-host/screener to test
5. Do a dry run before first live show

## Costs Summary

- Twilio: ~$20-30/month
- Claude AI: ~$10-20/month
- AWS S3: ~$1-5/month
- Railway: $5/month

**Total: ~$40-60/month**

Much cheaper than traditional broadcast software! 🎉

