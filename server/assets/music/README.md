# Music Stings for Announcements

## Required Files

Place 6 royalty-free audio sting files in this directory:

### Intro Stings (2 seconds each):
1. `intro-upbeat.mp3` - Energetic whoosh/riser for sales and exciting announcements
2. `intro-professional.mp3` - Clean corporate ding for general announcements
3. `intro-smooth.mp3` - Warm chime for guest introductions

### Outro Stings (2 seconds each):
1. `outro-upbeat.mp3` - Positive conclusion sound
2. `outro-professional.mp3` - Professional ending tone
3. `outro-smooth.mp3` - Soft fade-out sting

## Where to Source (Royalty-Free):

1. **Pixabay Audio Library** (https://pixabay.com/music/)
   - 100% free, no attribution required
   - Search for: "intro sting", "swoosh", "corporate logo", "chime"

2. **FreeSound.org** (https://freesound.org/)
   - Creative Commons licenses
   - Large library of sound effects

3. **Zapsplat** (https://www.zapsplat.com/)
   - Free with attribution
   - Professional quality

## Audio Specifications:

- **Format:** MP3
- **Duration:** 1-3 seconds
- **Bitrate:** 128kbps or higher
- **Sample Rate:** 44.1kHz or 48kHz
- **Channels:** Stereo or Mono (both work)

## Testing:

If these files are not present, the system will automatically fall back to voice-only announcements (no music stings).

Check server logs for: `⚠️ [MIXING] Music stings not found for {style}, using voice only`

## Setup Instructions:

1. Download 6 audio files from above sources
2. Rename them to match the filenames above
3. Place them in this directory
4. Restart the server
5. Test by generating an announcement with music enabled

The audio mixing service will automatically detect and use these files!

