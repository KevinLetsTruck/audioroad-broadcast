# Audio Mixer User Guide

## Overview

The **Broadcast Mixer** is now built directly into your AudioRoad Broadcast app! This replaces Audio Hijack and lets you mix your microphone, caller audio, and soundboard directly in your browser, then stream to Radio.co and record locally.

## Getting Started

### Step 1: Open the Mixer

1. Log into your Host Dashboard
2. Start or select a live episode
3. Click the **🎚️ Mixer** tab at the top

### Step 2: Initialize the Mixer

1. Click the **"Start Mixer"** button
2. Your browser will ask for microphone permission - click **"Allow"**
3. The mixer will initialize (this takes a few seconds)

### Step 3: Connect Your Microphone

1. Once initialized, click **"Connect Mic"**
2. Your microphone will appear as the first channel in the mixer
3. You'll see a VU meter (volume indicator) showing your mic level

## Using the Mixer

### Understanding the Interface

Each audio source gets its own **mixer channel** with:
- **🎤 Icon** - Shows what type of source it is (mic, caller, soundboard)
- **Volume Slider** - Adjust from 0-100%
- **Mute Button** - Instantly mute/unmute this source
- **VU Meter** - Visual indicator of audio level (green = good, yellow = loud, red = too loud)

### Audio Sources

1. **Host Microphone** 🎤
   - Your main mic input
   - Default volume: 80%
   - Appears immediately when you connect your mic

2. **Callers** 📞
   - Each caller gets their own channel automatically
   - Shows caller name
   - Appears when you take a call
   - Disappears when call ends
   - Default volume: 75%

3. **Soundboard** 🎵 (Coming soon)
   - Audio from your soundboard will appear here
   - Mix in music, jingles, sound effects

### Master Output

The **Master Output** section at the bottom shows:
- Combined output of all sources
- Master volume control (affects everything)
- Recording and streaming controls

## Streaming to Radio.co

### Configure Radio.co Settings (One-Time Setup)

1. Click **⚙️ Settings** in the mixer
2. Enter your Radio.co information:
   - **Server URL**: `pear.radio.co` (from your screenshot)
   - **Port**: `5568` (from your screenshot)
   - **Password**: Your Radio.co password
   - **Bitrate**: Select `256 kbps` (your current setting)
3. Click **"Save Settings"**

### Go Live

1. Make sure your microphone is connected
2. Adjust volumes to your liking
3. Click **📡 Go Live** button
4. You'll see a red "LIVE" indicator when streaming

**Important Note**: Direct browser-to-Radio.co streaming may require additional backend setup. The system will prepare the audio stream, but you may need to coordinate with Radio.co for the best connection method.

### Stop Streaming

- Click **⏹️ Stop Stream** when done
- The LIVE indicator will disappear

## Recording Your Show

### Start Recording

1. Click **⏺️ Record** at any time (even while streaming)
2. The button will pulse red while recording
3. Recording saves everything in the mix (all sources combined)

### Stop & Download Recording

1. Click **⏹️ Stop Recording**
2. Your recording automatically downloads as a `.webm` file
3. File name includes date and time: `audioroad-2025-10-18T00-00-00.webm`

**Recording Quality**: 256 kbps stereo, high quality suitable for archiving

## Tips for Best Sound Quality

### Volume Levels (VU Meters)

- **Green** = Perfect! This is where you want to be
- **Yellow** = Getting loud, but still okay
- **Red** = Too loud! Turn it down to avoid distortion

### Recommended Settings

- **Host Mic**: 70-80%
- **Callers**: 70-80%
- **Master Output**: 90-100%

### Avoid These Common Issues

1. **Feedback/Echo**
   - Use headphones when mixing
   - Don't have your own stream playing in the background
   
2. **Distorted Audio**
   - If VU meters are in the red, lower volumes
   - Start with all sources at 75% and adjust from there

3. **One Source Too Quiet**
   - Boost just that channel's volume
   - Don't raise master volume (affects everything)

## Individual Volume Control

Each source has **independent volume control**! This means:

✅ **You can**: Turn up a quiet caller without affecting your mic
✅ **You can**: Lower your mic during a caller's story
✅ **You can**: Adjust soundboard volume separately

This gives you **full mixing power** like a professional broadcast console!

## Troubleshooting

### "Microphone Access Denied"

1. Your browser blocked mic access
2. Click the 🔒 lock icon in your browser's address bar
3. Allow microphone access
4. Refresh the page and try again

### "No Audio from Caller"

1. Check if caller's channel is muted (red mute button)
2. Check if caller's volume is at 0%
3. Make sure the call is actually connected (on-air)

### "Can't Click Go Live"

1. Make sure you've configured Radio.co settings first
2. Make sure your microphone is connected
3. Try refreshing the page and reconnecting

### Recording Won't Download

1. Check if your browser is blocking downloads
2. Make sure you have storage space
3. Try a different browser (Chrome works best)

## Browser Compatibility

**Best Browser**: **Google Chrome** (recommended and fully tested)

The mixer is optimized specifically for Chrome and may not work properly in other browsers.

## What's Different from Audio Hijack?

### You Gain:
✅ Built directly into your app (no extra software)
✅ Automatic caller integration (no manual routing)
✅ Visual VU meters for each source
✅ One-click recording
✅ Individual volume control for each participant
✅ Settings saved for next broadcast

### Similar Features:
- Mix multiple audio sources
- Stream to Radio.co
- Record locally
- Professional quality output

## Next Steps

Once you're comfortable with the basics:

1. **Experiment with volumes** during a test show
2. **Record a test session** to check your sound
3. **Configure your Radio.co settings** for live streaming
4. **Practice taking calls** to see caller channels appear

## Need Help?

If you run into issues:
1. Check the browser console for error messages (F12 in Chrome)
2. Make sure you're using Chrome browser
3. Refresh the page and try again
4. Check that your microphone is working in other apps

---

**Happy Broadcasting!** 🎙️

