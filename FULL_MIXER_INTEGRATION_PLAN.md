# Full Mixer Integration Plan

## Goal
Complete integration of Twilio calls with Web Audio mixer so volume controls actually work and navigation doesn't disconnect calls.

## Current Issues
1. ❌ Twilio audio bypasses mixer (not being mixed)
2. ❌ Volume sliders don't affect audio
3. ❌ Navigation disconnects calls
4. ❌ Call state not shared globally
5. ❌ Status indicators inaccurate
6. ❌ Timer not working

## Solution Architecture

### 1. Call Management Context
Extend BroadcastContext to include:
- Active calls map
- Call connection/disconnection handlers
- Twilio device management
- Global call state

### 2. Audio Routing
When a call connects:
- Get Twilio audio stream
- Add to mixer as caller source
- Volume controls affect mixer gain nodes
- Mute controls affect mixer

### 3. Unified State
- One source of truth for calls
- All pages read from context
- No duplicate call management
- Navigation safe

### 4. Implementation Steps

**Phase 1: Call State Context**
- Add call management to BroadcastContext
- Move Twilio device to app level
- Share call state globally

**Phase 2: Audio Integration**
- Route Twilio streams through mixer
- Add callers when they connect
- Remove when they disconnect

**Phase 3: UI Updates**
- Host Dashboard reads from context
- Broadcast Control shows calls
- Screening Room syncs

**Phase 4: Testing & Polish**
- Test full workflow
- Fix edge cases
- Polish UX

## Starting Implementation Now...

