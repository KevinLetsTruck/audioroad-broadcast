/**
 * Conference Naming Utilities
 * 
 * Two-conference architecture:
 * - SCREENING conference: Private screener + one caller
 * - LIVE conference: Host + on-air callers + callers on hold
 */

/**
 * Get the SCREENING conference name for an episode
 * This is where callers are screened privately
 */
export function getScreeningConferenceName(episodeId: string): string {
  return `screening-${episodeId}`;
}

/**
 * Get the LIVE conference name for an episode
 * This is where the actual show happens (host + on-air callers)
 */
export function getLiveConferenceName(episodeId: string): string {
  return `live-${episodeId}`;
}

/**
 * Determine which conference a role should join
 */
export function getConferenceForRole(episodeId: string, role: 'host' | 'screener' | 'caller'): string {
  if (role === 'screener' || role === 'caller') {
    return getScreeningConferenceName(episodeId);
  } else {
    return getLiveConferenceName(episodeId);
  }
}

