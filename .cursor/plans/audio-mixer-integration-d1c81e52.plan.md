<!-- d1c81e52-7a81-4733-8898-6922914dece4 75453514-8ba4-4a35-b386-53de7fb7d756 -->
# Smart Show Selector Implementation

## Overview

Implement auto-detection of which show to broadcast based on the current day and time, with a simple override option. This organizes your 5 weekly shows and makes recordings easy to find.

## Your Show Schedule

**Shows to Create:**

1. **Monday**: Industry Insights
2. **Tuesday**: The PowerHour
3. **Wednesday**: DestinationHealth
4. **Thursday 3PM**: Trucking Technology and Efficiency
5. **Thursday 7PM**: Rolling Toe (different host)

## Implementation Plan

### 1. Create Shows in Database

Add an API endpoint or script to create the 5 shows:

- Each show gets: name, slug, schedule (day/time), host info
- Thursday gets TWO shows with different time slots

### 2. Update BroadcastControl Component

Add show selection logic:

- Fetch all shows on page load
- Auto-detect current show based on day/time
- Display selected show name prominently
- Show "Change Show" button for manual override
- Update episode creation to use selected show

### 3. Auto-Detection Logic

Smart detection based on:

- **Day of week** (Monday = Industry Insights)
- **Time of day** (Thursday 3PM vs 7PM)
- **Host identity** (if logged in, could auto-select their shows)
- Fallback to first show if unclear

### 4. UI Updates

**Pre-Show View:**

```
Ready to Broadcast
Industry Insights (Monday)      [Change Show ↻]

☑ Auto-record show
☑ Stream to Radio.co

[🎙️ START INDUSTRY INSIGHTS - GO LIVE!]
```

**Change Show Modal:**

- List all 5 shows
- Highlight today's recommended show
- One-click to switch

### 5. Episode & Recording Naming

Auto-generate names:

- Episode: `"Industry Insights - Oct 21, 2025"`
- Recording: `"Industry-Insights-2025-10-21-15-30.webm"`

### 6. Database Schema (Already Exists)

The Show model already supports schedules via JSON field. Update format:

```json
{
  "days": ["monday"],
  "time": "15:00",
  "duration": 180,
  "timezone": "America/New_York"
}
```

## Files to Modify

- `src/pages/BroadcastControl.tsx` - Add show selector
- `server/routes/shows.ts` - May need show seeding endpoint
- Update episode creation to use selected show

## User Workflow

1. Open app → Broadcast Control
2. See "Industry Insights (Monday)" auto-selected
3. (Optional) Click "Change Show" if wrong
4. Click "START INDUSTRY INSIGHTS - GO LIVE!"
5. Done!

**Result**: Organized recordings, proper show names, zero confusion.

### To-dos

- [ ] Create the 5 shows in database with proper schedules
- [ ] Add auto-detection logic to select show based on day/time
- [ ] Update BroadcastControl UI to show selected show and Change Show button
- [ ] Create modal/dropdown for manual show selection
- [ ] Update episode creation to use selected show and auto-name
- [ ] Update recording filename generation to include show name