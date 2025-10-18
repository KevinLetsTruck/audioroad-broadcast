# Audio Mixer - Quick Reference Card

## 🎚️ Starting the Mixer

1. Open Host Dashboard → **Mixer** tab
2. Click **Start Mixer** → Allow microphone
3. Click **Connect Mic**
4. You're ready!

## 🎛️ Controls

### Each Channel Has:
- **Volume Slider** (0-100%) - Adjust loudness
- **Mute Button** (🔇/🔊) - Instant silence
- **VU Meter** - Shows audio level
  - Green = Good ✅
  - Yellow = Loud ⚠️
  - Red = Too loud! Turn down! 🔴

### Master Section:
- **Master Volume** - Controls overall output
- **Record Button** - Start/stop recording
- **Go Live Button** - Stream to Radio.co

## 📊 Recommended Levels

```
Host Mic:    70-80%
Callers:     70-80%
Soundboard:  60-70%
Master:      90-100%
```

## 🎯 Common Tasks

### Adjust One Person
- Move **only their slider**
- Don't touch master volume

### Mute Someone Quickly
- Click their **🔊 button** → turns to 🔇

### Record Your Show
1. Click **⏺️ Record**
2. Do your show
3. Click **⏹️ Stop Recording**
4. File auto-downloads!

### Stream to Radio.co
1. Click **⚙️ Settings**
2. Enter Radio.co info (one-time)
3. Click **📡 Go Live**
4. Red "LIVE" appears
5. Click **⏹️ Stop Stream** when done

## ⚡ Quick Fixes

| Problem | Fix |
|---------|-----|
| No audio from mic | Check if muted (🔇) or volume at 0% |
| Caller too quiet | Raise **their slider only** |
| Caller too loud | Lower **their slider only** |
| Everything distorted | All VU meters red? Lower volumes! |
| Can't hear myself | Check host mic volume & mute button |

## 🎨 Reading VU Meters

```
[====================================        ] Green  = Perfect!
[========================================    ] Yellow = Loud but OK
[============================================] Red    = TOO LOUD!
```

## 💾 Recording Details

- **Format**: WebM audio
- **Quality**: 256 kbps stereo
- **Filename**: `audioroad-[date-time].webm`
- **Location**: Downloads folder

## 📡 Radio.co Settings

Your current setup:
```
Server: pear.radio.co
Port: 5568
Password: (your password)
Bitrate: 256 kbps
```

## 🔑 Keyboard Shortcuts

(Coming in future update)
- Will add hotkeys for mute/volume

## ⚠️ Important Tips

1. **Use headphones** when mixing (prevents feedback)
2. **Start low, go higher** (easier to boost than fix distortion)
3. **Watch VU meters** (green is your friend)
4. **Test before going live** (record 30 seconds, play it back)
5. **Save settings** (your Radio.co config is remembered)

## 🆘 Emergency Reset

If everything sounds wrong:
1. Set all channels to **75%**
2. Set master to **100%**
3. Unmute everything
4. Start adjusting from there

## 📞 When Caller Joins

Automatically:
- ✅ New channel appears
- ✅ Volume set to 75%
- ✅ VU meter active
- ✅ Ready to adjust

## 🎵 Each Source is Independent!

This means:
- ✅ Lower caller without affecting your mic
- ✅ Boost quiet person without boosting loud person
- ✅ Mute soundboard without muting callers
- ✅ Full control of everyone separately!

## 🔧 If Something Breaks

1. Refresh the page
2. Click Mixer tab again
3. Start Mixer again
4. Reconnect mic

## 📝 Pro Tips

- **Before show**: Set your mic, test record
- **During show**: Watch VU meters, adjust as needed
- **After show**: Download recording immediately
- **Always**: Keep master at 100%, adjust individual channels

## 🎯 The Golden Rule

> **If one person is wrong, fix their slider.**  
> **If everyone is wrong, fix master.**  
> **Never change master for one person!**

---

**Need more help?** See `MIXER_USER_GUIDE.md` for full documentation.

**Technical issues?** See `MIXER_IMPLEMENTATION_SUMMARY.md` for details.

**Setting up callers?** See `MIXER_CALLER_INTEGRATION.md` for integration guide.

