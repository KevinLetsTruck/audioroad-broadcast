/**
 * Commercial Script Generator
 * Uses Claude AI to create compelling commercial scripts from Shopify products
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

interface Product {
  title: string;
  description: string;
  price: string;
  benefits?: string[];
  category?: string;
}

/**
 * Generate a 30-second radio commercial script for a product
 */
export async function generateCommercialScript(product: Product): Promise<string> {
  try {
    console.log(`🎬 [AI] Generating commercial script for: ${product.title}`);

    const prompt = `You are a professional radio commercial copywriter for a trucking and health podcast called "Let's Truck" and "AudioRoad Network".

Generate a compelling 30-second radio commercial script for this product:

Product: ${product.title}
Price: $${product.price}
Description: ${product.description}
Category: ${product.category || 'General'}

Requirements:
- Exactly 30 seconds when read aloud (approximately 75-85 words)
- Engaging and conversational tone
- Speak directly to truck drivers
- Highlight key benefits
- Include a clear call-to-action
- Mention the website: store.letstruck.com
- Sound natural for radio, not like a written ad
- Use trucker-friendly language
- Create urgency or excitement

Format: Just the script text, no extra formatting or stage directions.

Example style:
"Hey drivers, tired of expensive fuel additives that don't work? Check out Max Mileage Fuel Catalyst - the only fuel additive proven to boost your MPG by up to 10%. That's real money back in your pocket! Just $135 gets you 6 months of better fuel economy. Head to store dot lets truck dot com and grab yours today. Your wallet will thank you!"

Now generate the commercial script:`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5', // Claude Haiku 4.5 (fast & cost-effective)
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const script = message.content[0].type === 'text' ? message.content[0].text : '';

    console.log(`✅ [AI] Commercial script generated (${script.length} characters)`);
    console.log(`📝 Script preview: "${script.substring(0, 100)}..."`);

    return script.trim();
  } catch (error) {
    console.error(`❌ [AI] Error generating commercial script:`, error);
    throw error;
  }
}

/**
 * Generate scripts for multiple products
 */
export async function generateBatchScripts(products: Product[]): Promise<Array<{
  product: Product;
  script: string;
}>> {
  const results = [];

  for (const product of products) {
    try {
      const script = await generateCommercialScript(product);
      results.push({ product, script });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ [AI] Failed to generate script for ${product.title}:`, error);
      // Continue with next product
    }
  }

  console.log(`✅ [AI] Generated ${results.length}/${products.length} commercial scripts`);
  return results;
}

/**
 * Score products for commercial worthiness
 * Returns products sorted by priority for commercial creation
 */
export function scoreProductsForCommercials(products: Product[]): Product[] {
  return products
    .map(product => {
      let score = 0;

      // Higher price = more profit = higher priority
      const price = parseFloat(product.price);
      if (price > 100) score += 3;
      else if (price > 50) score += 2;
      else if (price > 20) score += 1;

      // Has good description
      if (product.description && product.description.length > 100) score += 2;

      // Popular categories
      const category = product.category?.toLowerCase() || '';
      if (category.includes('supplement') || category.includes('health')) score += 2;
      if (category.includes('truck') || category.includes('equipment')) score += 2;
      if (category.includes('fuel') || category.includes('performance')) score += 3;

      // Has benefits listed
      if (product.benefits && product.benefits.length > 0) score += 1;

      return { product, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(item => item.product);
}

