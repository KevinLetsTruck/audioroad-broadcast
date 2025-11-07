/**
 * Call Analysis Service
 * Analyzes call transcripts with Claude AI for sentiment, topics, and insights
 */

import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Analyze a call transcript and generate insights
 */
export async function analyzeCallTranscript(
  callId: string,
  transcript: string
): Promise<{
  summary: string;
  keyPoints: string[];
  topics: string[];
  sentiment: string;
  contentRating: number;
}> {
  try {
    console.log(`🤖 [ANALYSIS] Analyzing call transcript for: ${callId}`);
    console.log(`   Transcript length: ${transcript.length} characters`);

    const prompt = `You are analyzing a phone call from a live trucking radio show.

Analyze this call transcript and provide:

1. SUMMARY (2-3 sentences): What did the caller discuss? Why did they call?
2. KEY POINTS (3-5 bullet points): Main discussion points or questions
3. TOPICS (keywords): Main subjects discussed
4. SENTIMENT: Overall tone
   - positive: Engaged, helpful, satisfied, productive conversation
   - neutral: Factual questions, informational exchange
   - negative: Complaints, frustrations, unresolved issues
   - mixed: Both positive and negative elements
5. CONTENT RATING (0-100): How valuable/interesting was this call?
   - 80-100: Exceptional - unique insights, highly engaging
   - 60-79: Good - solid content, worth highlighting
   - 40-59: Average - standard call, basic info
   - 20-39: Below average - repetitive or low value
   - 0-19: Poor - off-topic, problematic

Call Transcript:
${transcript.substring(0, 8000)}${transcript.length > 8000 ? '... (truncated)' : ''}

Respond in JSON format:
{
  "summary": "Brief summary here",
  "keyPoints": ["point1", "point2", "point3"],
  "topics": ["topic1", "topic2"],
  "sentiment": "positive|neutral|negative|mixed",
  "contentRating": number (0-100)
}`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5', // Fast and cost-effective
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '{}';
    
    // Extract JSON from response
    let jsonText = responseText;
    const jsonStart = responseText.indexOf('{');
    const jsonEnd = responseText.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      jsonText = responseText.substring(jsonStart, jsonEnd + 1);
    }

    const analysis = JSON.parse(jsonText);

    console.log(`✅ [ANALYSIS] Call analyzed - Rating: ${analysis.contentRating}/100, Sentiment: ${analysis.sentiment}`);

    // Save analysis to database
    await prisma.call.update({
      where: { id: callId },
      data: {
        aiSummary: analysis.summary,
        aiKeyPoints: analysis.keyPoints,
        aiTopics: analysis.topics,
        aiSentiment: analysis.sentiment,
        contentRating: analysis.contentRating
      }
    });

    console.log(`💾 [ANALYSIS] Analysis saved to database`);

    return {
      summary: analysis.summary,
      keyPoints: analysis.keyPoints || [],
      topics: analysis.topics || [],
      sentiment: analysis.sentiment || 'neutral',
      contentRating: analysis.contentRating || 50
    };

  } catch (error) {
    console.error('❌ [ANALYSIS] Error analyzing transcript:', error);
    throw error;
  }
}

/**
 * Update caller's overall sentiment based on their call history
 */
export async function updateCallerSentiment(callerId: string): Promise<void> {
  try {
    // Get all completed calls for this caller
    const calls = await prisma.call.findMany({
      where: {
        callerId,
        status: 'completed',
        aiSentiment: { not: null }
      },
      select: {
        aiSentiment: true
      }
    });

    if (calls.length === 0) return;

    // Calculate overall sentiment from all calls
    const sentiments = calls.map(c => c.aiSentiment);
    const positive = sentiments.filter(s => s === 'positive').length;
    const negative = sentiments.filter(s => s === 'negative').length;
    const neutral = sentiments.filter(s => s === 'neutral').length;

    let overallSentiment = 'neutral';
    if (positive > negative && positive > neutral) {
      overallSentiment = 'positive';
    } else if (negative > positive) {
      overallSentiment = 'negative';
    } else if (positive > 0 && negative > 0) {
      overallSentiment = 'mixed';
    }

    // Update caller
    await prisma.caller.update({
      where: { id: callerId },
      data: {
        sentiment: overallSentiment
      }
    });

    console.log(`✅ [ANALYSIS] Updated caller sentiment: ${overallSentiment}`);

  } catch (error) {
    console.error('❌ [ANALYSIS] Error updating caller sentiment:', error);
  }
}

