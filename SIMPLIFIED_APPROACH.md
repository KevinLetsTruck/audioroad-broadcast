# Simplified Approach - Single Session Device

## The New Architecture

**OLD (broken):**
- Separate devices for screener and host (`screener-xxx`, `host-xxx`)
- Destroyed and recreated device when switching roles
- Race conditions with React state updates
- "Device has been destroyed" errors

**NEW (simple):**
- **ONE device per browser session** (`session-xxx`)
- Same device handles both screener AND host connections
- NO destruction when switching roles
- Just disconnect old calls before new ones

## Why This Works

Twilio Device SDK allows multiple conference connections from the same device. You don't need separate devices for different roles - the `role` parameter in the connection params is what matters.

## Key Changes

**BroadcastContext:**
```typescript
// Before: Created new device each time
const device = await initializeTwilio(`${role}-${Date.now()}`);

// After: Reuses existing session device
if (twilioDevice) {
  return twilioDevice; // Reuse for all roles
}
```

**HostDashboard (START SHOW):**
```typescript
// Before: Destroyed device, created new one as host
await destroyTwilioDevice();
const device = await initializeTwilio(`host-${Date.now()}`);
await connectToCall(callId, name, epId, 'host', device);

// After: Just connect using existing device
await connectToCall(callId, name, epId, 'host');
```

**ScreeningRoom (Pickup):**
```typescript
// Before: Checked device state, destroyed if had calls
if (device.calls.length > 0) {
  await destroyTwilioDevice();
}

// After: Just disconnect the current call
if (activeCall) {
  await disconnectCurrentCall();
}
```

## Benefits

✅ No race conditions with React state
✅ No "Device has been destroyed" errors
✅ No identity mismatch issues
✅ Simpler code
✅ More reliable

## Expected Behavior

- Screener picks up calls → Uses session device ✓
- Host starts show → Uses SAME session device ✓
- Switching between pages → Device persists ✓
- Multiple calls → Just disconnect previous, reuse device ✓

This architecture matches how Twilio is designed to work.

