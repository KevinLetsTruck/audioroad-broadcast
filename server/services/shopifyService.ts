/**
 * Shopify Integration Service
 * Fetches products from Let's Truck store for commercial generation
 */

interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  price: string;
  vendor: string;
  product_type: string;
  tags: string[];
  images: { src: string }[];
  handle: string;
}

/**
 * Fetch all products from Shopify store
 */
export async function fetchAllProducts(): Promise<ShopifyProduct[]> {
  const shopifyUrl = process.env.SHOPIFY_STORE_URL;
  const adminToken = process.env.SHOPIFY_ADMIN_TOKEN;

  if (!shopifyUrl || !adminToken) {
    throw new Error('Shopify credentials not configured');
  }

  try {
    console.log('🛒 [SHOPIFY] Fetching products from store...');

    const response = await fetch(`https://${shopifyUrl}/admin/api/2024-10/products.json?limit=250`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': adminToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();
    const products = data.products || [];

    console.log(`✅ [SHOPIFY] Fetched ${products.length} products`);

    return products.map((p: any) => ({
      id: p.id.toString(),
      title: p.title,
      description: p.body_html?.replace(/<[^>]*>/g, '') || '', // Strip HTML
      price: p.variants?.[0]?.price || '0.00',
      vendor: p.vendor || '',
      product_type: p.product_type || '',
      tags: p.tags?.split(',').map((t: string) => t.trim()) || [],
      images: p.images || [],
      handle: p.handle
    }));
  } catch (error) {
    console.error('❌ [SHOPIFY] Error fetching products:', error);
    throw error;
  }
}

/**
 * Get featured/bestseller products for commercials
 */
export async function getFeaturedProducts(limit: number = 10): Promise<ShopifyProduct[]> {
  const allProducts = await fetchAllProducts();
  
  // Prioritize products with "bestseller" or specific tags
  const featured = allProducts
    .filter(p => 
      p.tags.some(tag => 
        tag.toLowerCase().includes('bestseller') ||
        tag.toLowerCase().includes('featured') ||
        tag.toLowerCase().includes('recommended')
      )
    )
    .slice(0, limit);

  // If not enough featured, add best-sellers by type
  if (featured.length < limit) {
    const remaining = allProducts
      .filter(p => !featured.includes(p))
      .slice(0, limit - featured.length);
    featured.push(...remaining);
  }

  console.log(`🎯 [SHOPIFY] Selected ${featured.length} featured products for commercials`);
  return featured;
}

/**
 * Get product by ID
 */
export async function getProductById(productId: string): Promise<ShopifyProduct | null> {
  const shopifyUrl = process.env.SHOPIFY_STORE_URL;
  const adminToken = process.env.SHOPIFY_ADMIN_TOKEN;

  if (!shopifyUrl || !adminToken) {
    throw new Error('Shopify credentials not configured');
  }

  try {
    const response = await fetch(`https://${shopifyUrl}/admin/api/2024-10/products/${productId}.json`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': adminToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return null;
    }

    const data: any = await response.json();
    const p = data.product;

    return {
      id: p.id.toString(),
      title: p.title,
      description: p.body_html?.replace(/<[^>]*>/g, '') || '',
      price: p.variants?.[0]?.price || '0.00',
      vendor: p.vendor || '',
      product_type: p.product_type || '',
      tags: p.tags?.split(',').map((t: string) => t.trim()) || [],
      images: p.images || [],
      handle: p.handle
    };
  } catch (error) {
    console.error(`❌ [SHOPIFY] Error fetching product ${productId}:`, error);
    return null;
  }
}

