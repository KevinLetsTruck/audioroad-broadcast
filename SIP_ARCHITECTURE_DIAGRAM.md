# 📐 SIP Integration - Architecture Diagram

**Visual guide to understand how everything connects**

---

## 🎯 The Complete System

```
┌─────────────────────────────────────────────────────────────────┐
│                        PHONE CALLER (PSTN)                       │
│                     📱 Regular Phone Call                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ Traditional phone call
                            │ (Circuit-switched voice)
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                      TWILIO PHONE NUMBER                         │
│                      +1 (888) 804-9791                          │
│                  (Public facing phone number)                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ Webhook triggers on incoming call
                            │ GET call metadata (From, To, CallSid)
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    YOUR NODE.JS APP                              │
│                   (audioroad-broadcast)                          │
│                    Railway Service #1                            │
│                                                                   │
│  1. Receives webhook from Twilio                                │
│  2. Creates Call record in database                             │
│  3. Determines which room to route to                           │
│  4. Generates TwiML with SIP dial command                       │
│  5. Manages call state transitions                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ TwiML Response:
                            │ <Dial><Sip>sip:lobby@your-sip-service</Sip></Dial>
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                      TWILIO SIP TRUNK                            │
│                   (Twilio's SIP Router)                          │
│                                                                   │
│  Converts phone call → SIP protocol                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ SIP INVITE (Session Initiation)
                            │ RTP Audio Streams (UDP, bidirectional)
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   LIVEKIT SIP SERVICE                            │
│                   (livekit-sip-service)                          │
│                    Railway Service #2                            │
│                     (Go Application)                             │
│                                                                   │
│  Ports:                                                          │
│  - 5060: SIP signaling (TCP/UDP)                                │
│  - 10000-20000: RTP media (UDP, audio packets)                  │
│  - 8080: Health check (HTTP)                                    │
│                                                                   │
│  Functions:                                                      │
│  1. Receives SIP call from Twilio                               │
│  2. Converts SIP audio → WebRTC audio                           │
│  3. Creates participant in LiveKit room                         │
│  4. Routes audio bidirectionally                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ WebRTC Connection
                            │ (Encrypted, low-latency)
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                      LIVEKIT CLOUD                               │
│                (Managed WebRTC Infrastructure)                   │
│                   wss://audioroad-xxx.livekit.cloud             │
│                                                                   │
│  Manages:                                                        │
│  - WebRTC rooms                                                  │
│  - Audio mixing                                                  │
│  - Participant routing                                           │
│  - Echo cancellation                                             │
│  - Bandwidth optimization                                        │
└────────┬──────────────────┬──────────────────┬─────────────────┘
         │                  │                  │
         │                  │                  │
         ↓                  ↓                  ↓
    ┌─────────┐        ┌─────────┐       ┌─────────┐
    │  LOBBY  │        │SCREENING│       │  HOLD   │
    │  ROOM   │        │  ROOM   │       │  ROOM   │
    └────┬────┘        └────┬────┘       └────┬────┘
         │                  │                  │
         ↓                  ↓                  ↓
    Waiting Queue    Private 1-on-1    Hears Live Show!
         │                  │                  │
         │                  │                  │
         ↓                  ↓                  ↓
                   ┌─────────────┐
                   │  LIVE ROOM  │
                   │ (On-Air!)   │
                   └──────┬──────┘
                          │
                          ↓
                   Talks with Host
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         ↓                ↓                ↓
    ┌─────────┐      ┌─────────┐     ┌─────────┐
    │ Browser │      │ Browser │     │ Browser │
    │ Screener│      │  Host   │     │Co-Host  │
    └─────────┘      └─────────┘     └─────────┘
         │                │                │
         ↓                ↓                ↓
   Your Dashboard   Host Dashboard   Co-Host View
```

---

## 🔄 Call Flow State Transitions

```
┌──────────────────────────────────────────────────────────────┐
│                    PHONE CALL LIFECYCLE                       │
└──────────────────────────────────────────────────────────────┘

   📞 INCOMING CALL
        ↓
   [ LOBBY ROOM ]
   - Waiting for screener
   - Hears hold music
   - Queue position: #1, #2, etc.
        ↓
   🎯 Screener clicks "Pick Up"
        ↓
   [ SCREENING ROOM ]
   - Private 1-on-1 conversation
   - Room: screening-{episodeId}-{callId}
   - Bidirectional audio ✅
   - Screener asks questions
        ↓
   ✅ Screener clicks "Approve"
        ↓
   [ ON HOLD ROOM ]
   - Room: hold-{episodeId}
   - 🎵 HEARS LIVE SHOW! 🎵
   - Multiple callers can be here
   - Waiting for host to bring on air
        ↓
   📡 Host clicks "Put On Air"
        ↓
   [ LIVE ROOM ]
   - Room: live-{episodeId}
   - 📡 ON AIR! 📡
   - Talks with host
   - Bidirectional audio ✅
   - Everyone listening hears this!
        ↓
   ⏸️ Host clicks "Put On Hold"
        ↓
   [ ON HOLD ROOM ]
   - 🎵 HEARS LIVE SHOW AGAIN! 🎵
   - Can be brought back on air
   - Unlimited transitions!
        ↓
   📡 Host clicks "Put On Air" again
        ↓
   [ LIVE ROOM ]
   - 📡 BACK ON AIR! 📡
   - Talks with host again
   - Repeat as many times as needed!
        ↓
   📴 Host clicks "End Call" or Caller hangs up
        ↓
   [ COMPLETED ]
   - Call record updated
   - Recording saved (if enabled)
   - Metrics logged
```

---

## 🎵 Audio Flow Diagram

### Caller → Host (Upstream Audio)

```
Phone Microphone
      ↓
PSTN (Phone Network)
      ↓
Twilio
      ↓
SIP Protocol (Port 5060)
      ↓
RTP Audio Stream (Ports 10000-20000, UDP)
      ↓
LiveKit SIP Service
      ↓
WebRTC Encoding
      ↓
LiveKit Cloud (Audio Mixer)
      ↓
WebRTC Stream
      ↓
Host's Browser
      ↓
Host's Speakers
      ↓
HOST HEARS CALLER ✅
```

### Host → Caller (Downstream Audio)

```
Host Microphone
      ↓
Browser Audio Capture (WebRTC)
      ↓
LiveKit Cloud (Audio Mixer)
      ↓
WebRTC Stream
      ↓
LiveKit SIP Service
      ↓
RTP Audio Stream (Ports 10000-20000, UDP)
      ↓
SIP Protocol
      ↓
Twilio
      ↓
PSTN (Phone Network)
      ↓
Phone Speaker
      ↓
CALLER HEARS HOST ✅
```

**This is BIDIRECTIONAL audio - the holy grail we've been seeking!**

---

## 🏢 Infrastructure Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                         RAILWAY PROJECT                          │
│                      (audioroad-broadcast)                       │
└─────────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ↓                   ↓                   ↓
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Main App     │   │ SIP Service  │   │ Redis DB     │
│ Node.js      │   │ Go/LiveKit   │   │ (State Mgmt) │
│              │   │              │   │              │
│ Port: 3001   │   │ Port: 5060   │   │ Port: 6379   │
│ HTTP/WS      │   │ SIP/RTP      │   │ Redis Proto  │
└──────────────┘   └──────────────┘   └──────────────┘
        │                   │                   │
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ↓
                    All connected via
                    Railway private network
                    (redis.railway.internal)
```

---

## 🔌 Port Usage

### Main App (Node.js)
- **3001:** HTTP/WebSocket server
  - API endpoints
  - WebSocket for real-time updates
  - Serves frontend in production

### SIP Service (Go)
- **5060:** SIP signaling (TCP/UDP)
  - Call setup
  - Call teardown
  - Session management
  
- **10000-20000:** RTP media (UDP)
  - Audio packets
  - Bidirectional
  - Real-time streaming
  
- **8080:** Health check (HTTP)
  - Monitoring
  - Status endpoint

### Redis
- **6379:** Redis protocol
  - SIP state storage
  - Session tracking
  - Call metadata

---

## 🌐 External Services

```
┌─────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                           │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   TWILIO     │    │  LIVEKIT     │    │  POSTGRES    │
│              │    │   CLOUD      │    │   DATABASE   │
│ - Phone #    │    │              │    │              │
│ - SIP Trunk  │    │ - WebRTC     │    │ - Call logs  │
│ - Call logs  │    │ - Rooms      │    │ - Callers    │
│ - Recordings │    │ - Audio mix  │    │ - Episodes   │
└──────────────┘    └──────────────┘    └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ↓
                   Your Railway App
                   (integrates all)
```

---

## 📊 Data Flow

### Incoming Call Flow

```
1. Phone dials +1-888-804-9791
        ↓
2. Twilio receives call
        ↓
3. Twilio sends webhook to /api/twilio-sip/incoming-call
        ↓
4. Node.js app:
   - Finds/creates Caller record
   - Finds active Episode
   - Creates Call record
   - Determines room (usually "lobby")
        ↓
5. Node.js returns TwiML with SIP dial
        ↓
6. Twilio connects call to SIP service
        ↓
7. SIP service:
   - Creates SIP session
   - Converts to WebRTC
   - Adds to LiveKit room
        ↓
8. LiveKit Cloud:
   - Participant joined
   - Audio routing active
        ↓
9. Browser (Screener):
   - Receives real-time notification
   - Shows caller in queue
   - Can click "Pick Up"
```

### State Transition Flow

```
User clicks "Pick Up" in browser
        ↓
POST /api/twilio-sip/move-to-screening
        ↓
SIP Call Flow Manager:
   - Gets call participant
   - Creates new room: screening-{episodeId}-{callId}
   - Moves SIP participant to new room
        ↓
LiveKit Cloud:
   - Removes from lobby room
   - Adds to screening room
        ↓
Browser (Screener):
   - Switches to screening room
   - Audio connects
   - Conversation begins!
```

---

## 🎯 Room Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          LIVEKIT ROOMS                           │
└─────────────────────────────────────────────────────────────────┘

LOBBY ROOM
├── Name: "lobby"
├── Purpose: Hold incoming calls before screening
├── Max Participants: 100
├── Participants: Phone callers only (no screeners)
└── Audio: Hold music or silence

SCREENING ROOMS (One per call)
├── Name: "screening-{episodeId}-{callId}"
├── Purpose: Private 1-on-1 between screener and caller
├── Max Participants: 2 (caller + screener)
├── Participants: 1 phone caller + 1 browser screener
└── Audio: Bidirectional conversation

HOLD ROOM (One per episode)
├── Name: "hold-{episodeId}"
├── Purpose: Approved callers waiting to go on air
├── Max Participants: 50
├── Participants: Multiple phone callers
└── Audio: LIVE SHOW FEED! 🎵

LIVE ROOM (One per episode)
├── Name: "live-{episodeId}"
├── Purpose: On-air conversation with host
├── Max Participants: 20
├── Participants: Host + on-air callers + co-hosts
└── Audio: Broadcast to all listeners!
```

---

## 🔐 Security Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        SECURITY LAYERS                           │
└─────────────────────────────────────────────────────────────────┘

Layer 1: Twilio Webhook Authentication
├── Validates requests come from Twilio
├── Checks signature header
└── Rejects unauthorized requests

Layer 2: SIP Authentication
├── SIP username/password required
├── Only configured trunk can connect
└── IP whitelist (optional)

Layer 3: LiveKit Access Tokens
├── JWT tokens for room access
├── Expires after session
├── Scoped to specific room + participant
└── Cannot access other rooms

Layer 4: Application Authentication (Clerk)
├── Browser users must log in
├── Role-based access (screener, host, admin)
├── Session management
└── Cannot impersonate other users

Layer 5: Database Security
├── All queries parameterized (SQL injection proof)
├── Row-level security on sensitive data
└── Encrypted connections
```

---

## 💾 Database Schema (Simplified)

```
┌──────────────┐
│    Caller    │
├──────────────┤
│ id (PK)      │
│ phoneNumber  │◄─────┐
│ name         │      │
│ email        │      │
└──────────────┘      │
                      │
┌──────────────┐      │
│   Episode    │      │
├──────────────┤      │
│ id (PK)      │◄─┐   │
│ showId (FK)  │  │   │
│ title        │  │   │
│ status       │  │   │
│ scheduledAt  │  │   │
└──────────────┘  │   │
                  │   │
┌──────────────┐  │   │
│     Call     │  │   │
├──────────────┤  │   │
│ id (PK)      │  │   │
│ episodeId───────┘   │
│ callerId────────────┘
│ twilioCallSid│
│ status       │ ← (queued, screening, on-hold, on-air, completed)
│ roomName     │ ← Current LiveKit room
│ onAirAt      │
│ duration     │
└──────────────┘
```

---

## 🎬 Real-World Example

**Scenario:** John calls in to the Trucking Network show

```
1. John dials +1-888-804-9791 from his truck
        ↓
2. System creates:
   - Caller record (if new)
   - Call record with status: "queued"
   - Adds to lobby room
        ↓
3. Sarah (screener) sees "John" in queue
   Clicks "Pick Up"
        ↓
4. System moves John to: screening-ep123-call456
   Sarah's browser joins same room
   They talk for 30 seconds
        ↓
5. Sarah clicks "Approve & Hold"
        ↓
6. System moves John to: hold-ep123
   John now HEARS the live show while waiting!
        ↓
7. Mike (host) sees John in hold queue
   Clicks "Put On Air"
        ↓
8. System moves John to: live-ep123
   John's voice is now BROADCAST!
   John and Mike have conversation
        ↓
9. Mike clicks "Put On Hold"
        ↓
10. John goes back to: hold-ep123
    Hears live show again
        ↓
11. Mike clicks "Put On Air" again
        ↓
12. John back in: live-ep123
    Talks with Mike again!
        ↓
13. Mike clicks "End Call"
        ↓
14. System:
    - Updates Call record: status = "completed"
    - Removes John from LiveKit
    - Twilio hangs up
    - Recording saved to S3
```

**Total transitions:** 7 room changes, all seamless! ✅

---

## 🚀 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          PRODUCTION                              │
│                      (Railway Platform)                          │
└─────────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ↓                   ↓                   ↓
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Service 1    │   │ Service 2    │   │ Service 3    │
│ Main App     │   │ SIP Bridge   │   │ Redis        │
│              │   │              │   │              │
│ Dockerfile   │   │ Dockerfile   │   │ Managed DB   │
│ (default)    │   │ (.sip)       │   │              │
└──────────────┘   └──────────────┘   └──────────────┘

Each service:
- Auto-deploys on git push
- Zero-downtime deploys
- Automatic HTTPS
- Environment variables isolated
- Private network between services
- Auto-scaling (if needed)
```

---

## 📈 Scalability

```
Current Capacity (Free Tier):
├── LiveKit: 10,000 participant-minutes/month
├── Railway: Hobby plan (sufficient for testing)
└── Twilio: Pay per use

Scale Up Path:
├── LiveKit: Upgrade to Starter ($29/month) = 30,000 min
├── Railway: Upgrade to Pro ($20/month) = more resources
└── Add load balancer if needed (for high traffic)

Max Capacity (with upgrades):
├── ~100 concurrent callers
├── ~1,000 hours of calls/month
└── Cost: ~$100-200/month at scale
```

---

This architecture is **production-ready** and follows industry best practices!

**Built:** November 15, 2025 by Claude  
**Status:** Ready for deployment 🚀

