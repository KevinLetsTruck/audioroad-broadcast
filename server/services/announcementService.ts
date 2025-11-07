/**
 * Announcement Service
 * Uses Claude AI to enhance screener announcements into professional radio copy
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export type AnnouncementCategory = 'product' | 'sale' | 'event' | 'guest' | 'other';

interface AnnouncementInput {
  text: string;
  category: AnnouncementCategory;
}

/**
 * Enhance raw announcement text into professional radio copy
 */
export async function enhanceAnnouncementScript(
  input: AnnouncementInput
): Promise<string> {
  try {
    console.log(`🎬 [ANNOUNCEMENT] Enhancing script for category: ${input.category}`);
    console.log(`📝 Raw text: "${input.text}"`);

    const categoryPrompts = {
      product: `Transform this into an exciting product announcement:
- Start with attention-grabber
- Highlight the main benefit
- Create desire
- Strong call-to-action
- Mention store.letstruck.com
- Keep it energetic and brief (20-30 seconds)`,

      sale: `Transform this into an urgent sale announcement:
- Create FOMO (limited time!)
- Emphasize the savings/discount
- Make it feel exclusive
- Clear deadline if mentioned
- Strong call-to-action
- Mention store.letstruck.com
- Keep it punchy and exciting (20-30 seconds)`,

      event: `Transform this into an anticipation-building event announcement:
- What's happening (be specific)
- When and where
- Why truckers should care
- How to participate/RSVP
- Build genuine excitement
- Keep it engaging (25-35 seconds)`,

      guest: `Transform this into an engaging guest introduction:
- Guest's name and credentials
- Why they're interesting to truckers
- Key topics to be discussed
- Build anticipation for the conversation
- Warm, welcoming tone
- Keep it conversational (25-35 seconds)`,

      other: `Transform this into a professional radio announcement:
- Clear, conversational delivery
- Main points organized logically
- Engaging tone appropriate for topic
- Call-to-action if relevant
- Keep it natural and brief (20-35 seconds)`
    };

    const categoryPrompt = categoryPrompts[input.category];

    const prompt = `You are a professional radio copywriter for "AudioRoad Network", a popular trucking podcast.

Your job: Transform raw announcement text into polished, professional radio copy.

${categoryPrompt}

Requirements:
- Speak directly to truck drivers (use "you", "your")
- Conversational, natural language (like talking to a friend)
- Approximately 50-80 words (reads in 20-35 seconds)
- NO emojis, special characters, or hashtags
- NO stage directions or sound effect notes
- Use "dot" for website URLs (e.g., "store dot letstruck dot com")
- Keep numbers simple (say "thirty percent" not "30%")
- End with clear next step

Raw announcement text:
"${input.text}"

Return ONLY the enhanced radio script - no explanations, no extra text, just the script ready to be read aloud.`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5', // Fast and cost-effective
      max_tokens: 250,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const script = message.content[0].type === 'text' ? message.content[0].text : '';

    console.log(`✅ [ANNOUNCEMENT] Script enhanced (${script.length} characters)`);
    console.log(`📝 Enhanced script: "${script}"`);

    return script.trim();
  } catch (error) {
    console.error(`❌ [ANNOUNCEMENT] Error enhancing script:`, error);
    throw error;
  }
}

/**
 * Generate a quick title for the announcement based on content
 */
export function generateAnnouncementTitle(text: string, category: string): string {
  // Take first few words or generate based on category
  const words = text.split(' ').slice(0, 5).join(' ');
  const truncated = words.length > 40 ? words.substring(0, 40) + '...' : words;
  
  const date = new Date().toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
  
  const categoryLabel = {
    product: '📦',
    sale: '💰',
    event: '📅',
    guest: '🎤',
    other: '📢'
  }[category];
  
  return `${categoryLabel} ${truncated} - ${date}`;
}

