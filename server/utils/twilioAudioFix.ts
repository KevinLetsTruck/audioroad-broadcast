import { Twilio } from 'twilio';

/**
 * Fixes Twilio conference audio routing for first-time muted participants.
 * 
 * This addresses a Twilio conference behavior where the first participant
 * who is muted programmatically (without having transmitted audio) doesn't
 * receive audio from the conference.
 * 
 * The fix works by briefly unmuting and re-muting the participant to
 * establish the audio receive channel.
 */
export async function applyFirstCallerAudioFix(
  twilioClient: Twilio,
  conferenceSid: string,
  callSid: string
): Promise<void> {
  console.log('[AUDIO-FIX] Checking if audio fix is needed...');
  
  try {
    // Get all participants in the conference
    const participants = await twilioClient
      .conferences(conferenceSid)
      .participants
      .list();
    
    // Count muted participants (excluding this one)
    const mutedCount = participants.filter(
      p => p.muted && p.callSid !== callSid
    ).length;
    
    console.log(`[AUDIO-FIX] Conference ${conferenceSid} has ${participants.length} participants, ${mutedCount} muted (excluding current)`);
    
    // Only apply fix if this is the first muted participant
    if (mutedCount === 0) {
      console.log('[AUDIO-FIX] First muted participant detected. Applying audio channel fix...');
      
      // Step 1: Unmute to establish audio channel
      await twilioClient
        .conferences(conferenceSid)
        .participants(callSid)
        .update({
          muted: false,
          hold: false
        });
      
      console.log('[AUDIO-FIX] Participant unmuted to establish audio channel');
      
      // Step 2: Wait briefly for audio channel establishment
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Step 3: Re-mute the participant
      await twilioClient
        .conferences(conferenceSid)
        .participants(callSid)
        .update({
          muted: true,
          hold: false // Ensure they can still hear
        });
      
      console.log('[AUDIO-FIX] ✅ Audio fix applied successfully - participant can now hear conference');
    } else {
      console.log('[AUDIO-FIX] Not the first muted participant. Audio channels should already be established.');
      
      // Just apply the standard mute
      await twilioClient
        .conferences(conferenceSid)
        .participants(callSid)
        .update({
          muted: true,
          hold: false
        });
    }
  } catch (error) {
    console.error('[AUDIO-FIX] ❌ Failed to apply audio fix:', error);
    
    // Fallback: Try to at least mute the participant
    try {
      await twilioClient
        .conferences(conferenceSid)
        .participants(callSid)
        .update({
          muted: true,
          hold: false
        });
      console.log('[AUDIO-FIX] Fallback: Applied standard mute');
    } catch (fallbackError) {
      console.error('[AUDIO-FIX] ❌ Fallback mute also failed:', fallbackError);
      throw fallbackError;
    }
  }
}
