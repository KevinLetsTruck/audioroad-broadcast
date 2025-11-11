/**
 * Conference Naming for Two-Conference System
 */

export function getScreeningConferenceName(episodeId: string): string {
  return `screening-${episodeId}`;
}

export function getLiveConferenceName(episodeId: string): string {
  return `live-${episodeId}`;
}
