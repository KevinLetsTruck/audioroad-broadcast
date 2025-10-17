import Anthropic from '@anthropic-ai/sdk';

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const anthropic = anthropicApiKey ? new Anthropic({ apiKey: anthropicApiKey }) : null;

// Generate AI response using Claude
const generateAIResponse = async (prompt: string): Promise<string> => {
  if (!anthropic || !anthropicApiKey) {
    console.log('⚠️  Claude API not configured, using mock response');
    return JSON.stringify({
      summary: "AI analysis placeholder - configure Claude API key to enable",
      keyFindings: ["Feature ready", "Add ANTHROPIC_API_KEY to Railway"],
      recommendations: ["Test with real documents"],
      confidence: 75
    });
  }

  try {
    console.log('🤖 Calling Claude API with model: claude-haiku-4-5 (latest!)');
    
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });
    
    // Extract text from Claude response
    const textContent = message.content.find(block => block.type === 'text');
    let text = textContent && 'text' in textContent ? textContent.text : '';
    
    console.log('✅ Claude AI response received, length:', text.length);
    
    // Clean up markdown code blocks if present
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    console.log('📝 Cleaned response:', text.substring(0, 200));
    
    return text;
  } catch (error) {
    console.error('❌ Claude API error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    // Return mock response on error
    return JSON.stringify({
      summary: "AI analysis temporarily unavailable - check Railway logs for error details",
      keyFindings: ["Claude API error occurred", "Check server logs"],
      recommendations: ["Contact support if issue persists"],
      confidence: 50
    });
  }
};

interface Caller {
  id: string;
  name?: string;
  phoneNumber: string;
  location?: string;
  truckerType?: string;
  totalCalls: number;
  firstCallDate: Date;
  lastCallDate: Date;
}

interface Call {
  id: string;
  topic?: string;
  screenerNotes?: string;
  transcriptText?: string;
  onAirAt?: Date;
  duration?: number;
}

/**
 * Generate AI summary of caller history
 */
export async function generateCallerSummary(caller: Caller, recentCalls: Call[]): Promise<{
  summary: string;
  commonTopics: string[];
  sentiment: string;
}> {
  try {
    const callHistory = recentCalls.map((call, index) => 
      `Call ${index + 1} (${call.onAirAt ? new Date(call.onAirAt).toLocaleDateString() : 'Unknown date'}):
       Topic: ${call.topic || 'Not specified'}
       Notes: ${call.screenerNotes || 'None'}
       Duration: ${call.duration ? `${Math.floor(call.duration / 60)} minutes` : 'Unknown'}`
    ).join('\n\n');

    const prompt = `
You are analyzing a caller's history for a live radio show host. The show is for the trucking industry (OTR, regional, local drivers).

Caller Information:
- Name: ${caller.name || 'Unknown'}
- Phone: ${caller.phoneNumber}
- Location: ${caller.location || 'Unknown'}
- Trucker Type: ${caller.truckerType || 'Unknown'}
- Total Calls: ${caller.totalCalls}
- First Call: ${new Date(caller.firstCallDate).toLocaleDateString()}
- Last Call: ${new Date(caller.lastCallDate).toLocaleDateString()}

Recent Call History:
${callHistory || 'No previous calls'}

Please provide:
1. A brief 2-3 sentence summary of this caller for the host to see during screening
2. List of common topics they discuss (comma-separated)
3. Overall sentiment (positive, neutral, negative, or mixed)

Format your response as JSON:
{
  "summary": "Brief summary here",
  "commonTopics": ["topic1", "topic2", "topic3"],
  "sentiment": "positive/neutral/negative/mixed"
}
`;

    const text = await generateAIResponse(prompt);
    
    // Extract JSON from response
    let jsonText = text;
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      jsonText = text.substring(jsonStart, jsonEnd + 1);
    }
    
    return JSON.parse(jsonText);

  } catch (error) {
    console.error('Error generating caller summary:', error);
    
    // Return fallback summary
    return {
      summary: `${caller.name || 'Caller'} has called ${caller.totalCalls} time(s). ${caller.truckerType ? `Works as ${caller.truckerType}.` : ''} ${caller.location ? `Located in ${caller.location}.` : ''}`,
      commonTopics: [],
      sentiment: 'neutral'
    };
  }
}

/**
 * Analyze document (medical labs, oil analysis, etc.)
 */
export async function analyzeDocument(
  documentUrl: string,
  documentType: 'medical_lab' | 'blood_work' | 'cgm_data' | 'oil_analysis' | 'other',
  documentContent: string
): Promise<{
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  confidence: number;
}> {
  try {
    const systemPrompts: Record<string, string> = {
      medical_lab: 'You are a medical lab analyst helping a radio host understand lab results for on-air discussion. Focus on explaining findings in layman\'s terms and highlighting anything notable.',
      blood_work: 'You are analyzing blood work results for a radio discussion. Identify key markers, explain what they mean, and suggest talking points for the host.',
      cgm_data: 'You are analyzing continuous glucose monitor (CGM) data. Identify patterns, spikes, and trends that would be interesting to discuss on-air.',
      oil_analysis: 'You are analyzing heavy truck oil analysis results. Identify wear patterns, contamination, and maintenance recommendations in terms a trucker would understand.',
      other: 'You are analyzing a document for a radio host. Provide a clear summary and key talking points.'
    };

    const prompt = `
Analyze this ${documentType.replace('_', ' ')} document for a live radio show discussion.

Document content:
${documentContent.substring(0, 8000)} ${documentContent.length > 8000 ? '... (truncated)' : ''}

Please provide:
1. A concise summary (2-3 sentences) the host can quickly read on-air
2. 3-5 key findings or notable points
3. 2-3 talking points or recommendations for discussion
4. Your confidence level in this analysis (0-100%)

Format as JSON:
{
  "summary": "Brief summary here",
  "keyFindings": ["finding1", "finding2", "finding3"],
  "recommendations": ["recommendation1", "recommendation2"],
  "confidence": 85
}
`;

    const fullPrompt = `${systemPrompts[documentType]}\n\n${prompt}`;
    const text = await generateAIResponse(fullPrompt);
    
    // Extract JSON from response (handle cases where Claude adds extra text)
    let jsonText = text;
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      jsonText = text.substring(jsonStart, jsonEnd + 1);
      console.log('📋 Extracted JSON from response');
    }
    
    const parsed = JSON.parse(jsonText);
    return {
      summary: parsed.summary || 'Document analysis completed.',
      keyFindings: parsed.keyFindings || [],
      recommendations: parsed.recommendations || [],
      confidence: parsed.confidence || 75
    };

  } catch (error) {
    console.error('Error analyzing document:', error);
    throw error;
  }
}

/**
 * Generate call transcript summary
 */
export async function summarizeCallTranscript(transcript: string): Promise<{
  summary: string;
  keyPoints: string[];
  topics: string[];
  sentiment: string;
}> {
  try {
    const prompt = `
Analyze this radio call transcript and provide:
1. A brief summary (2-3 sentences)
2. Key points discussed (3-5 bullet points)
3. Main topics covered
4. Overall sentiment

Transcript:
${transcript.substring(0, 10000)} ${transcript.length > 10000 ? '... (truncated)' : ''}

Format as JSON:
{
  "summary": "Brief summary",
  "keyPoints": ["point1", "point2", "point3"],
  "topics": ["topic1", "topic2"],
  "sentiment": "positive/neutral/negative/mixed"
}
`;

    const text = await generateAIResponse(prompt);
    
    // Extract JSON from response
    let jsonText = text;
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      jsonText = text.substring(jsonStart, jsonEnd + 1);
    }
    
    return JSON.parse(jsonText);

  } catch (error) {
    console.error('Error summarizing transcript:', error);
    throw error;
  }
}

/**
 * Generate social media content from call/clip
 */
export async function generateSocialContent(
  callTranscript: string,
  clipDuration: number
): Promise<{
  caption: string;
  hashtags: string[];
  suggestions: string[];
}> {
  try {
    const prompt = `
Create engaging social media content for this radio call clip.

Clip Duration: ${clipDuration} seconds
Transcript:
${callTranscript.substring(0, 5000)}

Generate:
1. An engaging caption (2-3 sentences, include call-to-action)
2. Relevant hashtags (5-8)
3. Content suggestions (titles, thumbnail ideas)

Format as JSON:
{
  "caption": "Engaging caption here",
  "hashtags": ["#trucking", "#podcast", "#health"],
  "suggestions": ["Title idea", "Thumbnail idea"]
}
`;

    const text = await generateAIResponse(prompt);
    
    // Extract JSON from response
    let jsonText = text;
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      jsonText = text.substring(jsonStart, jsonEnd + 1);
    }
    
    return JSON.parse(jsonText);

  } catch (error) {
    console.error('Error generating social content:', error);
    throw error;
  }
}

/**
 * Extract text from various document formats (helper for document analysis)
 */
export async function extractDocumentText(fileBuffer: Buffer, mimeType: string): Promise<string> {
  // Handle text files
  if (mimeType.includes('text/plain') || mimeType.includes('text/csv')) {
    return fileBuffer.toString('utf-8');
  }
  
  // Handle JSON files
  if (mimeType.includes('application/json')) {
    return fileBuffer.toString('utf-8');
  }
  
  // Handle PDFs
  if (mimeType.includes('application/pdf')) {
    try {
      // Use dynamic require for CommonJS module
      const pdfParse = require('pdf-parse');
      const pdfData = await pdfParse(fileBuffer);
      console.log('✅ Extracted text from PDF, length:', pdfData.text.length);
      return pdfData.text;
    } catch (error) {
      console.error('❌ PDF parsing error:', error);
      return `[PDF text extraction failed - error: ${error instanceof Error ? error.message : 'Unknown error'}]`;
    }
  }
  
  // For images and other formats, return a placeholder
  // In the future, you could add OCR for images
  return `[Document of type ${mimeType} - text extraction not yet implemented]`;
}

