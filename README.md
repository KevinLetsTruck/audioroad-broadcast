# 🎙️ AudioRoad Network Broadcast Platform

A comprehensive live radio broadcast management system designed for the trucking industry. Replaces traditional call-in studio software with enhanced AI-powered features for caller management, document analysis, and content creation.

## 🌟 Features

### Core Broadcast Management
- **Live Call Management**: Receive, screen, queue, and manage calls in real-time via Twilio
- **Call Screening Room**: Dedicated interface for call screeners to vet callers before going on-air
- **Caller Database**: Track caller history with AI-generated summaries and insights
- **Audio Mixer**: Individual line-level control for host, callers, and co-hosts
- **Soundboard**: Fire openers, closers, bumpers, commercials with hotkey support

### AI-Powered Intelligence
- **Caller Summaries**: Automatic AI analysis of caller history and common topics
- **Document Analysis**: Upload and analyze medical labs, blood work, CGM data, oil analysis reports
- **Content Suggestions**: AI-generated social media content and clip recommendations

### Communication
- **Real-time Chat**: In-app messaging between host, co-host, and call screener
- **WebSocket Integration**: Live updates for call status, audio levels, and chat messages
- **Document Sharing**: Callers can upload documents before calling in

### Content Creation (Planned for Phase 2)
- **Call Recording**: Individual call recordings and full episode recordings
- **Clip Creation**: Extract highlights and create "Call of the Day" content
- **Social Media**: Auto-generate captions, hashtags, and thumbnails

## 🏗️ Tech Stack

### Frontend
- **React 19** + TypeScript + Vite
- **Tailwind CSS** for styling
- **Socket.io Client** for real-time communication
- **Twilio Voice SDK** for WebRTC calls

### Backend
- **Node.js** + Express + TypeScript
- **Socket.io** for WebSocket communication
- **Twilio Programmable Voice** for call handling
- **Prisma** ORM with PostgreSQL database
- **Claude AI (Anthropic)** for document analysis and summaries
- **FFmpeg** for audio processing
- **AWS S3** for file storage

### Infrastructure
- **Railway** for deployment
- **PostgreSQL** database
- **Twilio** for telephony
- **AWS S3** for media storage

## 📋 Prerequisites

Before you begin, you'll need accounts and API keys for:

1. **Twilio Account**
   - Sign up at [twilio.com](https://www.twilio.com)
   - Purchase a phone number
   - Get Account SID and Auth Token
   - Create API Key and Secret
   - Create TwiML App

2. **Anthropic Claude API**
   - Sign up at [anthropic.com](https://www.anthropic.com)
   - Get API key from console

3. **AWS Account** (for S3)
   - Create S3 bucket
   - Get Access Key ID and Secret Access Key

4. **Railway Account** (for deployment)
   - Sign up at [railway.app](https://railway.app)
   - Connect your GitHub account

## 🚀 Quick Start

### 1. Clone and Install

```bash
cd /Users/kr/Development/audioroad-broadcast
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/audioroad_broadcast"

# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_API_KEY=your_api_key
TWILIO_API_SECRET=your_api_secret
TWILIO_TWIML_APP_SID=your_twiml_app_sid
TWILIO_PHONE_NUMBER=+1234567890

# Claude AI
ANTHROPIC_API_KEY=your_anthropic_key

# AWS S3
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1
S3_BUCKET_NAME=audioroad-recordings

# App
APP_URL=http://localhost:5173
```

### 3. Set Up Database

```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio to view/edit data
npm run prisma:studio
```

### 4. Run Development Servers

You'll need **two terminal windows**:

**Terminal 1 - Backend Server:**
```bash
npm run dev:server
```

**Terminal 2 - Frontend Dev Server:**
```bash
npm run dev
```

### 5. Access the Application

- **Frontend**: http://localhost:5173
- **API**: http://localhost:3001/api
- **Health Check**: http://localhost:3001/api/health

## 🎯 Usage Guide

### For Show Hosts

1. **Start Your Show**
   - Navigate to Host Dashboard
   - Click "GO LIVE" to start the episode
   - Your audio mixer and call queue will activate

2. **Manage Calls**
   - View incoming calls in the queue (left panel)
   - Click on a caller to see their history
   - Click "Take Call On-Air" to connect
   - Use audio mixer to control volume and mute

3. **Use Soundboard**
   - Click buttons to fire audio assets
   - Use hotkeys for quick access
   - Stop button to immediately cut audio

4. **Review Documents**
   - If caller uploaded a document, view AI analysis in right panel
   - See key findings and talking points
   - Download original document if needed

### For Call Screeners

1. **Open Screening Room**
   - Navigate to "Screening Room" tab
   - View all incoming calls

2. **Screen Callers**
   - Read caller information and history
   - Review AI-generated caller summary
   - Click "Approve" to add to host's queue
   - Click "Reject" to decline the call

3. **Add Notes**
   - When approving, add topic and notes for host
   - Prioritize urgent calls if needed

### For Callers

1. **Submit Call Request**
   - Go to "Caller Portal" tab
   - Fill out your information
   - Describe what you want to discuss
   - (Optional) Upload documents for analysis

2. **Call the Hotline**
   - After submitting, call the show's phone number
   - You'll be placed in queue with hold music
   - Screener will review your information
   - If approved, host will take your call live

## 📦 Project Structure

```
audioroad-broadcast/
├── prisma/
│   └── schema.prisma          # Database schema
├── server/
│   ├── index.ts               # Express server + Socket.io
│   ├── routes/                # API endpoints
│   │   ├── calls.ts           # Call management
│   │   ├── callers.ts         # Caller database
│   │   ├── episodes.ts        # Show episodes
│   │   ├── twilio.ts          # Twilio webhooks
│   │   ├── analysis.ts        # Document analysis
│   │   ├── audio-assets.ts    # Soundboard assets
│   │   ├── clips.ts           # Content clips
│   │   └── chat.ts            # Team chat
│   ├── services/
│   │   ├── twilioService.ts   # Twilio integration
│   │   ├── aiService.ts       # Claude AI integration
│   │   ├── audioService.ts    # Audio processing
│   │   └── socketService.ts   # WebSocket handlers
│   └── tsconfig.json
├── src/
│   ├── App.tsx                # Main app component
│   ├── pages/
│   │   ├── HostDashboard.tsx  # Host control center
│   │   ├── ScreeningRoom.tsx  # Call screening
│   │   └── CallerPortal.tsx   # Public caller portal
│   └── components/
│       ├── CallQueue.tsx      # Call queue display
│       ├── AudioMixer.tsx     # Audio controls
│       ├── Soundboard.tsx     # Audio asset buttons
│       ├── CallerInfo.tsx     # Caller details
│       ├── ChatPanel.tsx      # Team chat
│       └── DocumentViewer.tsx # Document display
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🔧 Configuration

### Twilio Setup

1. **Purchase Phone Number**
   - Log into Twilio Console
   - Buy a phone number with Voice capabilities

2. **Create TwiML Application**
   - Go to Voice → TwiML Apps
   - Create new app
   - Set Voice URL to: `https://your-domain.com/api/twilio/incoming-call`
   - Save and copy the App SID

3. **Configure Webhooks**
   - Set your phone number's webhook to your TwiML App
   - Enable recording callbacks

### Claude AI Setup

1. Sign up at anthropic.com
2. Get API key from console
3. Add to environment variables

### AWS S3 Setup

1. Create S3 bucket in your preferred region
2. Enable public read access (or use signed URLs)
3. Configure CORS for uploads
4. Create IAM user with S3 access
5. Add credentials to environment variables

## 🚢 Deployment to Railway

### 1. Prepare Your Repository

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin your-github-repo-url
git push -u origin main
```

### 2. Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Add PostgreSQL database
6. Configure environment variables (same as `.env`)

### 3. Configure Custom Domain (Optional)

1. In Railway project settings
2. Click "Generate Domain" or add custom domain
3. Update Twilio webhooks to use new domain

### 4. Set Up Automatic Deployments

- Railway automatically deploys on git push
- Monitor deployments in Railway dashboard

## 🧪 Testing

### Manual Testing Checklist

**Call Flow:**
- [ ] Caller submits information via portal
- [ ] Call appears in screening room
- [ ] Screener can approve/reject calls
- [ ] Approved calls appear in host queue
- [ ] Host can take calls on-air
- [ ] Audio mixer controls work
- [ ] Call completes and saves recording

**AI Features:**
- [ ] Caller summary generates correctly
- [ ] Document upload and analysis works
- [ ] AI findings display in dashboard

**Communication:**
- [ ] Real-time chat works between roles
- [ ] WebSocket updates are immediate
- [ ] No message delays or drops

**Soundboard:**
- [ ] Audio assets upload successfully
- [ ] Buttons play audio correctly
- [ ] Stop button works immediately
- [ ] Hotkeys function properly

## 📊 Database Models

### Key Tables

- **Show**: Radio shows on the network
- **Episode**: Individual show episodes
- **Caller**: Caller database with history
- **Call**: Individual calls with status tracking
- **CallerDocument**: Uploaded documents with AI analysis
- **AudioAsset**: Soundboard audio files
- **ChatMessage**: Team communication
- **Clip**: Content clips for social media

See `prisma/schema.prisma` for complete schema.

## 🔐 Security Considerations

- All API keys stored in environment variables
- Database credentials never in code
- Twilio webhooks should verify requests in production
- Rate limiting configured for all API endpoints
- File uploads limited to 10MB
- S3 buckets should use signed URLs in production

## 🐛 Troubleshooting

### Calls Not Coming Through
- Check Twilio phone number configuration
- Verify webhook URLs are publicly accessible
- Check server logs for Twilio webhook errors

### Audio Not Playing
- Verify S3 bucket permissions
- Check browser console for CORS errors
- Ensure audio files are valid MP3 format

### AI Analysis Failing
- Check Anthropic API key is valid
- Verify Claude API quota/limits
- Check document content extraction

### Database Connection Issues
- Verify DATABASE_URL is correct
- Run `npx prisma generate`
- Check PostgreSQL is running

## 📈 Future Enhancements (Phase 2)

- Multi-show network management
- Advanced audio processing (AI noise reduction)
- Automated content creation and posting
- Analytics dashboard
- Mobile app for hosts
- Video streaming integration
- Remote co-host support
- Listener call-in web widget

## 🤝 Support

For technical issues:
1. Check logs: `npm run dev:server`
2. Review Twilio console for call logs
3. Check Railway logs for production issues

## 📝 License

Private - All Rights Reserved

---

**Built with ❤️ for the AudioRoad Network**

*Empowering truckers with better broadcast technology*

# Deployment ready
