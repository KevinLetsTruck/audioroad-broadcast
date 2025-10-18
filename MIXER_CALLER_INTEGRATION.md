# Caller Integration with Audio Mixer

## Overview

This guide explains how to automatically add callers to the mixer when they go on-air.

## Current Setup

The mixer is now integrated into the Host Dashboard, but we need to connect it to the call system so that when you take a caller on-air, their audio automatically appears in the mixer.

## How to Connect Caller Audio

### Option 1: Automatic Integration (Recommended)

Update the "Take Call" button handler in `HostDashboard.tsx` to add the caller to the mixer:

```typescript
// In HostDashboard.tsx, find the "Take Call" button handler (around line 437)

const handleTakeCall = async (call: any) => {
  setOnAirCall(call);
  
  // Initialize caller volume
  setVolumes({
    ...volumes,
    callers: { ...volumes.callers, [call.id]: 75 }
  });
  setMuted({
    ...muted,
    callers: { ...muted.callers, [call.id]: false }
  });
  
  if (hostReady && activeEpisode) {
    try {
      // Connect to Twilio conference
      await connectToConference({
        callId: call.id,
        episodeId: activeEpisode.id,
        role: 'host'
      });
      
      // ADD THIS: Get the audio stream and add to mixer
      const audioStream = getAudioStream();
      if (audioStream && (window as any).broadcastMixer) {
        const callerName = call.caller?.name || 'Caller';
        (window as any).broadcastMixer.addCaller(
          call.id, 
          callerName, 
          audioStream
        );
      }
    } catch (error) {
      console.error('Error connecting:', error);
    }
  }
};
```

### Option 2: Manual Testing

For testing, you can manually add caller audio using the browser console:

```javascript
// In browser console while on the Mixer tab
const fakeStream = new MediaStream();
window.broadcastMixer.addCaller('test-caller-1', 'Test Caller', fakeStream);
```

### Option 3: Hook into Call Events

Add a listener in the BroadcastMixer component:

```typescript
// In BroadcastMixer.tsx, add this useEffect:

useEffect(() => {
  const socket = io();
  socket.emit('join:episode', episodeId);
  
  socket.on('call:on-air', (data: { callId: string, callerName: string }) => {
    // Get the audio stream from Twilio
    // This would need to be passed from the parent component
    console.log('Caller went on-air:', data.callerName);
    // addCallerAudio(data.callId, data.callerName, audioStream);
  });
  
  return () => {
    socket.close();
  };
}, [episodeId]);
```

## Complete Integration Example

Here's the full flow for automatic caller integration:

### Step 1: Update HostDashboard.tsx

```typescript
import { useState, useEffect, useRef } from 'react';
// ... other imports ...

export default function HostDashboard() {
  // ... existing state ...
  
  // Add ref to track mixer instance
  const mixerCallbacksRef = useRef<any>(null);
  
  // ... existing code ...
  
  // Twilio Device for host
  const {
    isReady: hostReady,
    makeCall: connectToConference,
    getAudioStream // <-- Make sure this is destructured
  } = useTwilioCall({
    identity: hostIdentity,
    onCallConnected: () => {
      console.log('✅ Host connected to caller!');
      
      // When call connects, add to mixer
      if (onAirCall && mixerCallbacksRef.current) {
        const audioStream = getAudioStream();
        if (audioStream) {
          const callerName = onAirCall.caller?.name || 'Caller';
          mixerCallbacksRef.current.addCaller(
            onAirCall.id,
            callerName,
            audioStream
          );
          console.log('🎚️ Added caller to mixer:', callerName);
        }
      }
    },
    onCallDisconnected: () => {
      console.log('📴 Host disconnected from caller');
      
      // Remove from mixer
      if (onAirCall && mixerCallbacksRef.current) {
        mixerCallbacksRef.current.removeCaller(onAirCall.id);
        console.log('🎚️ Removed caller from mixer');
      }
      
      setOnAirCall(null);
    }
  });
  
  // Listen for mixer callbacks from BroadcastMixer
  useEffect(() => {
    const checkMixer = setInterval(() => {
      if ((window as any).broadcastMixer) {
        mixerCallbacksRef.current = (window as any).broadcastMixer;
      }
    }, 1000);
    
    return () => clearInterval(checkMixer);
  }, []);
  
  // ... rest of component ...
}
```

### Step 2: Update BroadcastMixer.tsx

The mixer is already set up to expose methods via `window.broadcastMixer`. No changes needed!

### Step 3: Test the Integration

1. Start your dev server
2. Open Host Dashboard
3. Go to Mixer tab and initialize it
4. Take a call on the Calls tab
5. Return to Mixer tab
6. You should see the caller appear as a new channel!

## Troubleshooting Integration

### Caller Doesn't Appear in Mixer

**Check 1**: Is the mixer initialized?
```javascript
// In console:
console.log(window.broadcastMixer); // Should show object with methods
```

**Check 2**: Did you get the audio stream?
```javascript
// Add logging in onCallConnected:
const audioStream = getAudioStream();
console.log('Audio stream:', audioStream);
console.log('Tracks:', audioStream?.getTracks());
```

**Check 3**: Is the Twilio call actually connected?
```javascript
// Check Twilio call state
console.log('Call state:', call?.state());
```

### Audio Stream is Null

The Twilio SDK might not expose `getRemoteStream()` immediately. Try:

```typescript
// In useTwilioCall.ts, update getAudioStream:
const getAudioStream = (): MediaStream | null => {
  if (!call) return null;

  try {
    // Try multiple methods
    // Method 1: Direct remote stream
    // @ts-ignore
    let stream = call.getRemoteStream();
    
    if (!stream) {
      // Method 2: Via media handler
      // @ts-ignore
      const pc = call.peerConnection;
      const receivers = pc?.getReceivers() || [];
      if (receivers.length > 0 && receivers[0].track) {
        stream = new MediaStream([receivers[0].track]);
      }
    }
    
    return stream || null;
  } catch (error) {
    console.warn('Could not get remote stream:', error);
    return null;
  }
};
```

## Alternative: Mixer API

Instead of using window globals, you could pass mixer methods as props:

```typescript
// In HostDashboard.tsx
const [mixerApi, setMixerApi] = useState<{
  addCaller: (id: string, name: string, stream: MediaStream) => void;
  removeCaller: (id: string) => void;
} | null>(null);

// Pass to BroadcastMixer
<BroadcastMixer 
  episodeId={activeEpisode.id}
  onMixerReady={(api) => setMixerApi(api)}
/>

// Use in call handler
if (mixerApi) {
  mixerApi.addCaller(callId, callerName, stream);
}
```

Then update BroadcastMixer to accept and call the prop:

```typescript
interface BroadcastMixerProps {
  episodeId: string;
  onMixerReady?: (api: {
    addCaller: (id: string, name: string, stream: MediaStream) => void;
    removeCaller: (id: string) => void;
  }) => void;
}

// In useEffect after initialization:
if (onMixerReady) {
  onMixerReady({
    addCaller: addCallerAudio,
    removeCaller: removeCallerAudio
  });
}
```

## Testing Without Real Callers

Create a test audio stream:

```javascript
// In browser console
const audioContext = new AudioContext();
const oscillator = audioContext.createOscillator();
const dest = audioContext.createMediaStreamDestination();
oscillator.connect(dest);
oscillator.frequency.value = 440; // A note
oscillator.start();

// Add to mixer
window.broadcastMixer.addCaller('test-1', 'Test Tone', dest.stream);

// Stop after 5 seconds
setTimeout(() => {
  oscillator.stop();
  window.broadcastMixer.removeCaller('test-1');
}, 5000);
```

## Summary

The mixer is ready to accept caller audio! You just need to:

1. Get the audio stream from Twilio when a call connects
2. Call `window.broadcastMixer.addCaller()` with the stream
3. Call `window.broadcastMixer.removeCaller()` when call ends

The mixer will automatically:
- Create a new channel for the caller
- Set up volume control (default 75%)
- Add VU meter
- Mix the audio into the output
- Route to recording and stream

Each caller will have **fully independent volume control** as requested! 🎚️

