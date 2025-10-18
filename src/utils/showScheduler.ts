/**
 * Show Scheduler Utility
 * 
 * Auto-detects which show should be broadcast based on day/time
 */

interface Show {
  id: string;
  name: string;
  slug: string;
  schedule: {
    days: string[];
    time: string;
    duration: number;
    timezone?: string;
  };
  color?: string;
}

/**
 * Get the day of week as lowercase string
 */
function getDayOfWeek(date: Date = new Date()): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}

/**
 * Get current time in HH:MM format
 */
function getCurrentTime(date: Date = new Date()): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Convert time string to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Auto-detect which show should be broadcast right now
 */
export function detectCurrentShow(shows: Show[]): Show | null {
  if (!shows || shows.length === 0) return null;

  const now = new Date();
  const currentDay = getDayOfWeek(now);
  const currentTime = getCurrentTime(now);
  const currentMinutes = timeToMinutes(currentTime);

  console.log('🔍 Auto-detecting show:', { day: currentDay, time: currentTime });

  // Filter shows that air today
  const todaysShows = shows.filter(show => {
    const schedule = show.schedule;
    return schedule.days.includes(currentDay);
  });

  if (todaysShows.length === 0) {
    console.log('⚠️ No shows scheduled for', currentDay);
    return shows[0]; // Fallback to first show
  }

  if (todaysShows.length === 1) {
    console.log('✅ Found show for today:', todaysShows[0].name);
    return todaysShows[0];
  }

  // Multiple shows today (like Thursday) - pick based on time
  // Find the show whose time is closest to now (but not in the far future)
  let bestMatch = todaysShows[0];
  let smallestDiff = Infinity;

  for (const show of todaysShows) {
    const showTime = timeToMinutes(show.schedule.time);
    const diff = Math.abs(currentMinutes - showTime);
    
    // Prefer shows that are starting soon or recently started
    // Within 4 hours before or 1 hour after show time
    const minutesBeforeShow = showTime - currentMinutes;
    
    if (minutesBeforeShow <= 240 && minutesBeforeShow >= -60) {
      // Show is starting in next 4 hours or started within last hour
      if (diff < smallestDiff) {
        smallestDiff = diff;
        bestMatch = show;
      }
    }
  }

  console.log('✅ Detected show:', bestMatch.name, `(${bestMatch.schedule.time})`);
  return bestMatch;
}

/**
 * Get a friendly display name for the show selection
 */
export function getShowDisplayName(show: Show): string {
  const day = show.schedule.days[0];
  const time = show.schedule.time;
  
  // Convert to 12-hour format
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const timeStr = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  
  return `${show.name} (${day.charAt(0).toUpperCase() + day.slice(1)} ${timeStr})`;
}

/**
 * Get show color for UI
 */
export function getShowColor(show: Show): string {
  return show.color || '#3b82f6';
}

