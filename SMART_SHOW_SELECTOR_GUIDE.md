# 🎯 Smart Show Selector - Complete Guide

## What Was Built

A **smart show auto-detection system** that automatically knows which show you're broadcasting based on the day and time, with organized recordings by show name.

## Your 5 Weekly Shows

1. **Industry Insights** - Monday 3 PM (Blue 🔵)
2. **The PowerHour** - Tuesday 3 PM (Amber 🟠)
3. **DestinationHealth** - Wednesday 3 PM (Green 🟢)
4. **Trucking Technology and Efficiency** - Thursday 3 PM (Purple 🟣)
5. **Rolling Toe** - Thursday 7 PM (Red 🔴)

## How It Works

### Auto-Detection

When you open Broadcast Control, the system:
1. Checks what day it is
2. Checks what time it is
3. Automatically selects the correct show
4. Shows you which show it selected

**Examples:**
- **Monday at 2 PM** → Selects "Industry Insights"
- **Thursday at 2 PM** → Selects "Trucking Technology and Efficiency" (3 PM show)
- **Thursday at 6 PM** → Selects "Rolling Toe" (7 PM show)

### Smart Thursday Logic

Since you have TWO shows on Thursday:
- **Before 5:30 PM** → Selects "Trucking Technology and Efficiency" (3 PM)
- **After 5:30 PM** → Selects "Rolling Toe" (7 PM)

The system picks the show closest to the current time!

## Your New Workflow

### Before the Show

Open app → You see:

```
┌──────────────────────────────────────────────┐
│  Ready to Broadcast                          │
│                                              │
│  Today's Show:                               │
│  ┌──────────────────────────────────────┐  │
│  │ Industry Insights                    │ ↻ │
│  │ (Monday 3:00 PM)                     │   │
│  └──────────────────────────────────────┘  │
│                                              │
│  ☑ Auto-record show                         │
│  ☑ Stream to Radio.co                       │
│                                              │
│  [START INDUSTRY INSIGHTS - GO LIVE!]        │
└──────────────────────────────────────────────┘
```

**Notice:**
- ✅ Show is auto-selected (Industry Insights for Monday)
- ✅ Color-coded (blue for Industry Insights)
- ✅ Shows day and time
- ✅ Button says "START INDUSTRY INSIGHTS"
- ✅ Small ↻ button to change if needed

### If Wrong Show Selected

Click the **↻ button** → Modal appears:

```
┌───────────────────────────────────────────┐
│  Select Show                              │
├───────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐ │
│  │ Industry Insights (Mon 3:00 PM)   ✓│ │
│  │ Blue - Industry trends...          │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │ The PowerHour (Tue 3:00 PM)        │ │
│  │ Amber - Business strategies...     │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │ DestinationHealth (Wed 3:00 PM)    │ │
│  │ Green - Health & wellness...       │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  [Cancel]                                 │
└───────────────────────────────────────────┘
```

Click any show → It switches → Modal closes → Done!

## Episode & Recording Names

### Episodes (In Database)
- **Format**: `"[Show Name] - [Date]"`
- **Examples**:
  - "Industry Insights - Oct 21, 2025"
  - "DestinationHealth - Oct 23, 2025"
  - "Rolling Toe - Oct 24, 2025"

### Recordings (Downloaded Files)
- **Format**: `"[show-slug]-[date]-[time].webm"`
- **Examples**:
  - `industry-insights-2025-10-21-15-30-00.webm`
  - `destinationhealth-2025-10-23-15-00-00.webm`
  - `rolling-toe-2025-10-24-19-00-00.webm`

**Why this is great:**
- ✅ Easy to find recordings by show
- ✅ Sorted chronologically automatically
- ✅ No confusion about which show it was
- ✅ Professional organization

## How to Set Up (One Time)

### Step 1: Seed Your 5 Shows

Once Railway finishes deploying, you need to create the shows. You can do this two ways:

**Option A: Via API** (Easiest)
```bash
# Make a POST request to seed shows
curl -X POST https://your-app.up.railway.app/api/shows/seed
```

**Option B: Via Script**  
```bash
npm run seed:shows
```

This creates all 5 shows in your database with the correct schedules!

### Step 2: Use Broadcast Control

That's it! Now just:
1. Open Broadcast Control
2. See the auto-selected show
3. Click START SHOW
4. Done!

## Features

### Auto-Detection
- ✅ Knows which show based on day
- ✅ Handles multiple Thursday shows by time
- ✅ Smart defaults (within 4 hours of show time)
- ✅ Fallback logic if unclear

### Manual Override
- ✅ Click ↻ button to change
- ✅ See all 5 shows with descriptions
- ✅ Color-coded for easy identification
- ✅ One-click to switch
- ✅ Persists during session

### Episode Creation
- ✅ Auto-names with show and date
- ✅ Links to correct show
- ✅ Increments episode numbers
- ✅ Sets proper metadata

### Recordings
- ✅ Show-based filenames
- ✅ Date and time stamped
- ✅ Easy to organize and find
- ✅ Professional naming scheme

## Examples by Day

### Monday Morning
```
Auto-selects: Industry Insights
Button says: START INDUSTRY INSIGHTS - GO LIVE!
Episode created: "Industry Insights - Oct 21, 2025"
Recording saved as: "industry-insights-2025-10-21-15-00-00.webm"
```

### Wednesday Afternoon
```
Auto-selects: DestinationHealth
Button says: START DESTINATIONHEALTH - GO LIVE!
Episode created: "DestinationHealth - Oct 23, 2025"
Recording saved as: "destinationhealth-2025-10-23-15-00-00.webm"
```

### Thursday 2 PM (Before first show)
```
Auto-selects: Trucking Technology and Efficiency
Button says: START TRUCKING TECHNOLOGY AND EFFICIENCY - GO LIVE!
Episode created: "Trucking Technology and Efficiency - Oct 24, 2025"
Recording saved as: "trucking-tech-2025-10-24-15-00-00.webm"
```

### Thursday 6 PM (Between shows)
```
Auto-selects: Rolling Toe (7 PM is closer)
Button says: START ROLLING TOE - GO LIVE!
Episode created: "Rolling Toe - Oct 24, 2025"
Recording saved as: "rolling-toe-2025-10-24-19-00-00.webm"
```

## Benefits

### Organized Recordings
Your downloads folder will look like:
```
industry-insights-2025-10-21-15-00-00.webm
the-powerhour-2025-10-22-15-00-00.webm
destinationhealth-2025-10-23-15-00-00.webm
trucking-tech-2025-10-24-15-00-00.webm
rolling-toe-2025-10-24-19-00-00.webm
industry-insights-2025-10-28-15-00-00.webm
```

**Easy to:**
- ✅ Find all recordings for one show
- ✅ Sort by date
- ✅ Archive by show
- ✅ Share specific shows

### No Manual Work
- ✅ No typing episode names
- ✅ No selecting shows manually (99% of the time)
- ✅ No organizing files later
- ✅ Everything automatic

### Prevents Mistakes
- ✅ Can't accidentally use wrong show
- ✅ Can't forget to name episode
- ✅ Can't lose recordings in unnamed files
- ✅ System does it right every time

## Troubleshooting

### "Loading shows..." never goes away
- The 5 shows haven't been created yet
- Run the seed command or API endpoint
- Refresh the page

### Wrong show auto-selected
- Click the ↻ button
- Select the correct show
- It'll remember for this session

### Want to change show schedule
- Edit the show in database
- Or contact developer to update schedule
- Times are in Eastern Time (America/New_York)

## Advanced: Adding More Shows

If you add more shows in the future:
1. Create show via API or Show Setup page
2. Set the schedule (days, time)
3. Auto-detection will include it automatically!

## Summary

**Before:**
- Manual episode names
- Generic recording filenames
- Hard to find old shows
- Confusing organization

**Now:**
- ✅ Auto-selected show based on day/time
- ✅ Professional episode names
- ✅ Organized recording filenames
- ✅ One-click override if needed
- ✅ Zero manual work!

Your recordings are now **professionally organized** by show! 📁

---

**Next Steps:**
1. Once deployed, seed the shows: `curl -X POST https://your-app/api/shows/seed`
2. Refresh Broadcast Control
3. See your shows auto-selected!
4. Start broadcasting with proper show names!

