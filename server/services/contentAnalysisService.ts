/**
 * Content Analysis Service
 * Analyzes show calls and identifies best moments for social media
 */

import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

interface CallAnalysis {
  callId: string;
  score: number; // 0-100
  highlights: string[];
  suggestedClipStart?: number;
  suggestedClipDuration?: number;
  contentType: 'educational' | 'entertaining' | 'promotional' | 'inspirational';
  socialMediaPotential: 'high' | 'medium' | 'low';
  suggestedPlatforms: string[];
  keyTopics: string[];
  emotionalTone: string;
}

/**
 * Analyze all calls from an episode for social media potential
 */
export async function analyzeEpisodeForContent(episodeId: string): Promise<CallAnalysis[]> {
  try {
    console.log(`🔍 [CONTENT] Analyzing episode: ${episodeId}`);

    // Get all completed calls from episode
    const calls = await prisma.call.findMany({
      where: {
        episodeId,
        status: 'completed',
        airDuration: { gt: 30 } // At least 30 seconds on air
      },
      include: {
        caller: true
      },
      orderBy: {
        airDuration: 'desc' // Longer calls first
      }
    });

    console.log(`📞 [CONTENT] Found ${calls.length} calls to analyze`);

    if (calls.length === 0) {
      return [];
    }

    const analyses: CallAnalysis[] = [];

    for (const call of calls) {
      const analysis = await analyzeCallForSocial(call);
      analyses.push(analysis);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Sort by score (best first)
    analyses.sort((a, b) => b.score - a.score);

    console.log(`✅ [CONTENT] Analysis complete. Top ${Math.min(10, analyses.length)} calls recommended for content`);

    return analyses;
  } catch (error) {
    console.error('❌ [CONTENT] Error analyzing episode:', error);
    throw error;
  }
}

/**
 * Analyze individual call for social media potential
 */
async function analyzeCallForSocial(call: any): Promise<CallAnalysis> {
  try {
    console.log(`  🎯 Analyzing call from ${call.caller?.name || 'Unknown'}`);

    const prompt = `Analyze this radio call for social media content potential:

Topic: ${call.topic || 'General discussion'}
Caller: ${call.caller?.name || 'Unknown'} from ${call.caller?.location || 'Unknown'}
Duration: ${call.airDuration} seconds
Screener Notes: ${call.screenerNotes || 'None'}
${call.aiSummary ? `AI Summary: ${call.aiSummary}` : ''}

Rate this call's social media potential (0-100) and provide:
1. Content score (0-100) - How engaging/shareable is this?
2. Content type (educational, entertaining, promotional, inspirational)
3. Social media potential (high, medium, low)
4. Best platforms (Instagram, Facebook, YouTube, TikTok)
5. Key topics discussed
6. Emotional tone
7. Suggested clip duration (30-90 seconds ideal)
8. Why this would or wouldn't perform well on social media

Respond in JSON format:
{
  "score": number,
  "contentType": "educational|entertaining|promotional|inspirational",
  "socialPotential": "high|medium|low",
  "platforms": ["Instagram", "TikTok", etc],
  "keyTopics": ["topic1", "topic2"],
  "emotionalTone": "string",
  "clipDuration": number,
  "reasoning": "why this is/isn't good for social"
}`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '{}';
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText;
    if (responseText.includes('```json')) {
      jsonText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      jsonText = responseText.split('```')[1].split('```')[0].trim();
    }

    const analysis = JSON.parse(jsonText);

    return {
      callId: call.id,
      score: analysis.score || 50,
      highlights: [analysis.reasoning || ''],
      suggestedClipDuration: analysis.clipDuration || 60,
      contentType: analysis.contentType || 'educational',
      socialMediaPotential: analysis.socialPotential || 'medium',
      suggestedPlatforms: analysis.platforms || ['Instagram', 'Facebook'],
      keyTopics: analysis.keyTopics || [],
      emotionalTone: analysis.emotionalTone || 'neutral'
    };

  } catch (error) {
    console.error(`❌ [CONTENT] Error analyzing call ${call.id}:`, error);
    
    // Return default analysis if AI fails
    return {
      callId: call.id,
      score: 50,
      highlights: [],
      contentType: 'educational',
      socialMediaPotential: 'medium',
      suggestedPlatforms: ['Instagram'],
      keyTopics: [call.topic || 'General'],
      emotionalTone: 'neutral'
    };
  }
}

/**
 * Generate social media captions for a call/clip
 */
export async function generateSocialCaptions(call: any, clipInfo: {
  duration: number;
  topic: string;
  highlights: string[];
}): Promise<{
  instagram: string;
  facebook: string;
  youtube: string;
  tiktok: string;
  hashtags: string[];
}> {
  try {
    console.log(`📝 [CONTENT] Generating social captions for: ${clipInfo.topic}`);

    const prompt = `Generate social media captions for this radio show clip:

Topic: ${clipInfo.topic}
Duration: ${clipInfo.duration} seconds
Caller: ${call.caller?.name || 'A trucker'} from ${call.caller?.location || 'the road'}
Highlights: ${clipInfo.highlights.join(', ')}

Create engaging captions for each platform:

1. **Instagram** (100-150 characters, 3-4 emojis, engaging hook)
2. **Facebook** (150-200 characters, professional tone, question at end)
3. **YouTube** (50-80 characters, SEO-friendly title)
4. **TikTok** (80-100 characters, trending language, hook)
5. **Hashtags** (10-15 relevant hashtags for trucking/health audience)

Tone: Conversational, trucker-friendly, authentic
Brand: Let's Truck / AudioRoad Network
CTA: Mention listening to full show

Respond in JSON:
{
  "instagram": "caption text",
  "facebook": "caption text",
  "youtube": "title text",
  "tiktok": "caption text",
  "hashtags": ["Trucking", "OwnerOperator", etc]
}`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '{}';
    
    let jsonText = responseText;
    if (responseText.includes('```json')) {
      jsonText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      jsonText = responseText.split('```')[1].split('```')[0].trim();
    }

    const captions = JSON.parse(jsonText);

    console.log(`✅ [CONTENT] Social captions generated`);

    return {
      instagram: captions.instagram || '',
      facebook: captions.facebook || '',
      youtube: captions.youtube || '',
      tiktok: captions.tiktok || '',
      hashtags: captions.hashtags || []
    };

  } catch (error) {
    console.error('❌ [CONTENT] Error generating captions:', error);
    
    // Return default captions if AI fails
    return {
      instagram: `🎙️ ${clipInfo.topic} - Listen to this incredible moment from today's show!`,
      facebook: `${clipInfo.topic} - You won't believe what this trucker shared on today's show!`,
      youtube: `${clipInfo.topic} | AudioRoad Network`,
      tiktok: `🚛 ${clipInfo.topic} #Trucking`,
      hashtags: ['Trucking', 'AudioRoad', 'OwnerOperator', 'TruckingLife']
    };
  }
}

