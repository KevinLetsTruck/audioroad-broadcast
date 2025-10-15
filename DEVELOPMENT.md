# 🛠️ Development Guide

This guide explains how the AudioRoad Broadcast Platform works under the hood, so you can understand and modify it.

## Architecture Overview

The system is built in two parts that talk to each other:

### 1. **Backend (Server)**
- Runs on Node.js/Express
- Handles database operations
- Integrates with Twilio, Claude AI, and AWS
- Provides REST API endpoints
- Manages WebSocket connections for real-time updates

**Location:** `/server/`

### 2. **Frontend (Client)**
- React application that runs in the browser
- Three main interfaces: Host Dashboard, Screening Room, Caller Portal
- Connects to backend via HTTP and WebSockets
- Handles real-time UI updates

**Location:** `/src/`

## How Data Flows

### Example: A Caller Calls In

1. **Caller dials Twilio number** → Twilio receives call
2. **Twilio webhook** → Sends HTTP request to `/api/twilio/incoming-call`
3. **Server creates Call record** → Saves to PostgreSQL database
4. **Server emits WebSocket event** → `call:incoming` sent to all connected clients
5. **Screening Room updates** → Call appears in screener's interface
6. **Screener clicks Approve** → Sends HTTP POST to `/api/calls/:id/approve`
7. **Server updates Call status** → Database updated to "approved"
8. **Server emits WebSocket** → `call:approved` sent to host's dashboard
9. **Host sees call in queue** → Host Dashboard UI updates automatically
10. **Host clicks Take Call** → Sends HTTP PATCH to `/api/calls/:id/onair`
11. **Twilio connects audio** → Call goes live on-air

## Key Technologies Explained

### Prisma (Database)

**What it is:** A tool that makes database operations easy.

**How it works:**
- You define your data structure in `prisma/schema.prisma`
- Prisma generates TypeScript code to interact with the database
- No need to write SQL queries manually

**Example:**
```typescript
// Instead of SQL: SELECT * FROM callers WHERE phoneNumber = '555-1234'
const caller = await prisma.caller.findUnique({
  where: { phoneNumber: '555-1234' }
});
```

### Socket.io (Real-time Communication)

**What it is:** Lets the browser and server talk instantly without refreshing.

**How it works:**
- Server broadcasts events (e.g., "new call incoming")
- All connected browsers receive the event instantly
- Browsers can send events back to server

**Example:**
```typescript
// Server emits event
io.to(`episode:${episodeId}`).emit('call:incoming', callData);

// Browser receives event
socket.on('call:incoming', (callData) => {
  // Update UI with new call
});
```

### Twilio (Phone System)

**What it is:** Handles all phone call functionality.

**How it works:**
- Receives incoming calls
- Can connect/disconnect participants
- Records conversations
- Sends webhooks (HTTP notifications) to your server

**Example flow:**
1. Call comes in → Twilio holds caller with music
2. Your server says "add to episode conference"
3. Twilio connects caller audio to host's browser via WebRTC
4. Host and caller can talk
5. When done, Twilio uploads recording to your server

### Claude AI (Document Analysis)

**What it is:** Anthropic's AI that reads and understands documents.

**How it works:**
- You send document text to Claude API
- Claude analyzes it based on your instructions
- Returns structured findings and recommendations

**Example:**
```typescript
// Send blood work to Claude
const analysis = await analyzeDocument(
  documentUrl,
  'blood_work',
  documentContent
);

// Returns:
// {
//   summary: "Patient's cholesterol is elevated...",
//   keyFindings: ["HDL low", "LDL high"],
//   recommendations: ["Discuss diet", "Consider medication"]
// }
```

## File Structure Explained

### Backend Files

```
server/
├── index.ts                   # Main server file - starts everything
├── routes/                    # API endpoints
│   ├── calls.ts              # /api/calls - manage calls
│   ├── callers.ts            # /api/callers - caller database
│   ├── episodes.ts           # /api/episodes - show episodes
│   ├── twilio.ts             # /api/twilio - Twilio webhooks
│   ├── analysis.ts           # /api/analysis - AI document analysis
│   ├── audio-assets.ts       # /api/audio-assets - soundboard
│   └── chat.ts               # /api/chat - team messaging
└── services/                  # Reusable logic
    ├── twilioService.ts      # Twilio API interactions
    ├── aiService.ts          # Claude AI integration
    ├── audioService.ts       # Audio processing with FFmpeg
    └── socketService.ts      # WebSocket event handlers
```

### Frontend Files

```
src/
├── App.tsx                    # Main app - navigation between pages
├── pages/                     # Full page views
│   ├── HostDashboard.tsx     # Host control center
│   ├── ScreeningRoom.tsx     # Call screening interface
│   └── CallerPortal.tsx      # Public-facing call form
└── components/                # Reusable UI pieces
    ├── CallQueue.tsx         # List of calls in queue
    ├── AudioMixer.tsx        # Volume/mute controls
    ├── Soundboard.tsx        # Audio asset buttons
    ├── CallerInfo.tsx        # Caller details display
    ├── ChatPanel.tsx         # Team chat interface
    └── DocumentViewer.tsx    # Document display with AI analysis
```

## Database Schema Explained

### Main Tables

**Show**
- Represents a radio show (e.g., "The AudioRoad Show")
- Has many Episodes

**Episode**
- A single broadcast (e.g., "Monday Oct 16, 2025")
- Has many Calls
- Belongs to one Show

**Caller**
- Person who calls in
- Stores phone number, history, AI summary
- Has many Calls and Documents

**Call**
- A single phone call during an episode
- Tracks status: incoming → queued → screening → approved → on-air → completed
- Stores recording URL, transcript, duration

**CallerDocument**
- Documents uploaded by callers
- Medical labs, blood work, oil analysis, etc.
- Stores AI analysis results

**AudioAsset**
- Sound files for soundboard
- Openers, bumpers, commercials, closers

**ChatMessage**
- Messages between host, co-host, screener
- Real-time communication during show

## Common Development Tasks

### Add a New API Endpoint

1. Create or edit file in `server/routes/`
2. Define the route:
```typescript
router.get('/my-new-endpoint', async (req, res) => {
  try {
    // Your logic here
    const data = await prisma.myTable.findMany();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});
```
3. Import and use in `server/index.ts`:
```typescript
import myRoutes from './routes/my-routes.js';
app.use('/api/my-routes', myRoutes);
```

### Add a New UI Component

1. Create file in `src/components/MyComponent.tsx`:
```typescript
interface MyComponentProps {
  data: string;
}

export default function MyComponent({ data }: MyComponentProps) {
  return (
    <div className="p-4 bg-gray-800 rounded">
      <h3>{data}</h3>
    </div>
  );
}
```
2. Import in page or parent component:
```typescript
import MyComponent from '../components/MyComponent';

// In your JSX:
<MyComponent data="Hello" />
```

### Add a New Database Table

1. Edit `prisma/schema.prisma`:
```prisma
model MyNewTable {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
}
```
2. Create migration:
```bash
npm run prisma:migrate
```
3. Use in code:
```typescript
const item = await prisma.myNewTable.create({
  data: { name: 'Test' }
});
```

### Add a New WebSocket Event

1. In `server/services/socketService.ts`, add handler:
```typescript
socket.on('my:event', (data) => {
  console.log('Received:', data);
  io.to(`episode:${data.episodeId}`).emit('my:response', data);
});
```
2. In frontend component:
```typescript
useEffect(() => {
  socket.emit('my:event', { episodeId, data: 'hello' });
  
  socket.on('my:response', (data) => {
    console.log('Server responded:', data);
  });
}, []);
```

## Testing Workflow

Since you're learning, here's how to test changes:

### 1. Make Code Changes
Edit any file in `src/` or `server/`

### 2. Check for Errors
Watch your two terminal windows:
- Terminal 1 (server): Shows backend errors
- Terminal 2 (frontend): Shows React errors

### 3. Test in Browser
1. Go to http://localhost:5173
2. Open browser console (F12 or Cmd+Option+I)
3. Look for errors in Console tab
4. Check Network tab for failed API calls

### 4. Common Errors

**"Cannot read property of undefined"**
- Something is null/undefined
- Add safety check: `if (data) { ... }`

**"Network Error" or "Failed to fetch"**
- Backend not running
- Wrong API endpoint URL
- CORS issue (check server CORS config)

**"Prisma Client not found"**
- Run: `npm run prisma:generate`

**"Port already in use"**
- Kill other processes or change PORT in .env

## Debugging Tips

### Server-Side Debugging

Add console.logs in your code:
```typescript
console.log('📞 Call received:', callData);
console.log('🔍 Caller info:', caller);
```

### Frontend Debugging

Use React DevTools (Chrome extension):
1. Install React Developer Tools
2. Open browser DevTools
3. Check "Components" tab to see state

Add logs:
```typescript
console.log('State updated:', calls);
```

### Database Debugging

Use Prisma Studio:
```bash
npm run prisma:studio
```
- View all tables
- See exact data
- Manually edit records
- Check relationships

### Network Debugging

In browser (F12):
1. Go to Network tab
2. Make a request
3. See request/response
4. Check status code (200 = good, 500 = server error, 404 = not found)

## Environment Variables

Different values for development vs production:

### Development (.env)
```env
NODE_ENV=development
APP_URL=http://localhost:5173
DATABASE_URL=postgresql://localhost:5432/audioroad
```

### Production (Railway)
```env
NODE_ENV=production
APP_URL=https://audioroad-production.up.railway.app
DATABASE_URL=postgresql://railway-host:5432/railway
```

Railway automatically uses production values when deployed.

## Best Practices

### 1. Always Test Locally First
- Make changes
- Test in browser
- Fix errors
- THEN deploy to production

### 2. Use Git for Backup
```bash
git add .
git commit -m "Added new feature"
git push
```

### 3. Read Error Messages
- Error messages tell you what's wrong
- Google the error if unclear
- Check line numbers mentioned

### 4. Keep Dependencies Updated
```bash
npm update
```

### 5. Comment Your Code
```typescript
// This function generates an AI summary of the caller
// Input: caller object with history
// Output: { summary, topics, sentiment }
async function generateCallerSummary(caller) {
  // ...
}
```

## Getting Unstuck

If you're stuck:

1. **Read the error message** - it usually tells you exactly what's wrong
2. **Check the logs** - Server terminal and browser console
3. **Google it** - "React error [your error]" or "Node.js [your error]"
4. **Simplify** - Comment out code until it works, then add back piece by piece
5. **Start fresh** - Delete `node_modules`, run `npm install` again
6. **Ask for help** - Stack Overflow, Reddit r/webdev, Discord servers

## Next Steps for Learning

1. **Modify UI** - Change colors, text, layout in components
2. **Add fields** - Add new fields to database tables
3. **Create features** - Add a "favorites" system for callers
4. **Improve AI** - Customize Claude prompts for better summaries
5. **Add analytics** - Track show statistics

Remember: Everyone starts somewhere. Don't be afraid to break things - that's how you learn! The app is fully backed up in Git, so you can always go back.

## Useful Resources

- **React Docs**: https://react.dev
- **TypeScript Docs**: https://www.typescriptlang.org/docs/
- **Prisma Docs**: https://www.prisma.io/docs
- **Twilio Docs**: https://www.twilio.com/docs
- **Tailwind CSS**: https://tailwindcss.com/docs

Happy coding! 🚀

