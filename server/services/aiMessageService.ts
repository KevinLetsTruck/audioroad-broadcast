/**
 * AI Message Generation Service
 * Uses Claude to generate natural-sounding phone call messages
 */

import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;
const MODEL = 'claude-haiku-4-5';

/**
 * Generate a natural-sounding welcome message for callers
 */
export async function generateWelcomeMessage(showName: string): Promise<string> {
  if (!anthropic) {
    // Fallback to simple message if Claude not available
    return `Welcome to the AudioRoad Network. ${showName} is currently on the air. The call screener will be right with you.`;
  }

  try {
    const prompt = `Generate a warm, natural-sounding welcome message for a live radio show caller. The message should:
- Be conversational and friendly, not robotic
- Welcome them to the AudioRoad Network
- Mention the show name: "${showName}"
- Let them know the call screener will be with them shortly
- Sound like a real person, not a machine
- Be concise (under 20 words)

Return ONLY the message text, no quotes or formatting.`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return text.trim() || `Welcome to the AudioRoad Network. ${showName} is currently on the air. The call screener will be right with you.`;
  } catch (error) {
    console.error('❌ [AI-MSG] Error generating welcome message:', error);
    // Fallback
    return `Welcome to the AudioRoad Network. ${showName} is currently on the air. The call screener will be right with you.`;
  }
}

/**
 * Generate a natural-sounding queue position message
 */
export async function generateQueueMessage(position: number): Promise<string> {
  if (!anthropic) {
    // Fallback to simple message if Claude not available
    const positionText = position === 1 ? 'first' : position === 2 ? 'second' : position === 3 ? 'third' : `number ${position}`;
    return `The host will be with you shortly. You are ${positionText} in the queue.`;
  }

  try {
    const positionText = position === 1 ? 'first' : position === 2 ? 'second' : position === 3 ? 'third' : `number ${position}`;
    
    const prompt = `Generate a natural, friendly queue position message for a radio show caller. The message should:
- Be brief and reassuring
- Let them know they're ${positionText} in the queue
- Sound conversational, not robotic
- Be under 15 words
- Sound like a real person speaking

Return ONLY the message text, no quotes or formatting.`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 80,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return text.trim() || `The host will be with you shortly. You are ${positionText} in the queue.`;
  } catch (error) {
    console.error('❌ [AI-MSG] Error generating queue message:', error);
    // Fallback
    const positionText = position === 1 ? 'first' : position === 2 ? 'second' : position === 3 ? 'third' : `number ${position}`;
    return `The host will be with you shortly. You are ${positionText} in the queue.`;
  }
}


