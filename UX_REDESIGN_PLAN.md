# Host Dashboard UX Redesign Plan

## Current Layout Issues:
- Left pane (33% width) - episode info + call queue
- Middle pane (67% width) - caller info when on-air OR audio mixer
- Too much wasted space
- Audio controls separated from call cards

## New Streamlined Layout:

### Header (Compact):
```
[🔴 The PowerHour - 10/17/2025  Episode 1]  [END SHOW]
```

### Main Content (Single Column):
```
┌─ Host Mic Card ─────────────────────┐
│ 🎙️ Host Mic                  Vol: 80│
│ [========>          ] 0 - 100       │
│ [Mute] [Settings]                   │
└─────────────────────────────────────┘

┌─ ON AIR: Web Caller ────────────────┐
│ 🔴 Web Caller                       │
│ Red Wing MN                         │
│ Topic: testing audio                │
│ [Caller Muted]  Vol: [====>   ]    │
│ [End Call]                          │
└─────────────────────────────────────┘

┌─ Call Queue (2 Ready) ──────────────┐
│ ┌─ Web Caller ───────────┐          │
│ │ Red Wing MN            │          │
│ │ testing topic          │          │
│ │ [Take Call On-Air]     │          │
│ └────────────────────────┘          │
└─────────────────────────────────────┘

┌─ Co-host ───────────────────────────┐
│ 🎤 Co-host                 Vol: --  │
│ [Muted]  [Invite]                   │
└─────────────────────────────────────┘
```

## Benefits:
- More space for caller info
- Audio controls right where you need them
- Less clicking/switching
- Cleaner visual hierarchy
- Mobile-friendly single column

This will be a significant rewrite - should I proceed?

