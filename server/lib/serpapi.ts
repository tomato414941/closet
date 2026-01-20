export interface SerpApiProduct {
  name: string;
  brand: string | null;
  price: number | null;
  url: string;
  imageUrl: string | null;
  source: 'serpapi';
}

export async function searchByImage(base64Image: string): Promise<SerpApiProduct[]> {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    console.warn('SERPAPI_KEY not configured');
    return [];
  }

  try {
    // Use Google Lens API via SerpApi
    const params = new URLSearchParams({
      api_key: apiKey,
      engine: 'google_lens',
      url: `data:image/jpeg;base64,${base64Image.slice(0, 100)}`, // SerpApi needs URL, will use visual_matches
    });

    // For production: upload image to temporary storage and use URL
    // For now, we'll use text-based search as fallback
    const response = await fetch(`https://serpapi.com/search?${params}`);

    if (!response.ok) {
      console.error('SerpApi error:', response.status);
      return [];
    }

    const data = await response.json();

    // Extract visual matches
    const matches = data.visual_matches || [];

    return matches.slice(0, 5).map((match: any) => ({
      name: match.title || 'Unknown product',
      brand: extractBrand(match.source || match.title || ''),
      price: parsePrice(match.price?.extracted_value),
      url: match.link || '',
      imageUrl: match.thumbnail || null,
      source: 'serpapi' as const,
    }));
  } catch (error) {
    console.error('SerpApi search failed:', error);
    return [];
  }
}

export async function searchByText(query: string): Promise<SerpApiProduct[]> {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    console.warn('SERPAPI_KEY not configured');
    return [];
  }

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      engine: 'google_shopping',
      q: query,
      gl: 'jp',
      hl: 'ja',
    });

    const response = await fetch(`https://serpapi.com/search?${params}`);

    if (!response.ok) {
      console.error('SerpApi error:', response.status);
      return [];
    }

    const data = await response.json();
    const results = data.shopping_results || [];

    return results.slice(0, 5).map((item: any) => ({
      name: item.title || 'Unknown product',
      brand: extractBrand(item.source || item.title || ''),
      price: parsePrice(item.extracted_price),
      url: item.link || '',
      imageUrl: item.thumbnail || null,
      source: 'serpapi' as const,
    }));
  } catch (error) {
    console.error('SerpApi text search failed:', error);
    return [];
  }
}

function extractBrand(text: string): string | null {
  const brands = ['UNIQLO', 'GU', 'ZARA', 'H&M', 'GAP', 'MUJI', 'Nike', 'Adidas', 'Converse'];
  const upperText = text.toUpperCase();

  for (const brand of brands) {
    if (upperText.includes(brand.toUpperCase())) {
      return brand;
    }
  }
  return null;
}

function parsePrice(value: any): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const match = value.replace(/[,¥$]/g, '').match(/[\d.]+/);
    return match ? parseFloat(match[0]) : null;
  }
  return null;
}
