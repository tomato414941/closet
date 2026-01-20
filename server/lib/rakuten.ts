export interface RakutenProduct {
  name: string;
  brand: string | null;
  price: number;
  url: string;
  imageUrl: string | null;
  source: 'rakuten';
  janCode: string | null;
}

export async function searchProducts(query: string): Promise<RakutenProduct[]> {
  const appId = process.env.RAKUTEN_APP_ID;

  if (!appId) {
    console.warn('RAKUTEN_APP_ID not configured');
    return [];
  }

  try {
    const params = new URLSearchParams({
      applicationId: appId,
      keyword: query,
      hits: '10',
      genreId: '100371', // Fashion genre
      sort: '-reviewCount',
    });

    const response = await fetch(
      `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?${params}`
    );

    if (!response.ok) {
      console.error('Rakuten API error:', response.status);
      return [];
    }

    const data = await response.json();
    const items = data.Items || [];

    return items.map((wrapper: any) => {
      const item = wrapper.Item;
      return {
        name: item.itemName || 'Unknown product',
        brand: extractBrandFromName(item.itemName) || item.shopName || null,
        price: item.itemPrice || 0,
        url: item.itemUrl || '',
        imageUrl: item.mediumImageUrls?.[0]?.imageUrl || null,
        source: 'rakuten' as const,
        janCode: item.itemCode || null,
      };
    });
  } catch (error) {
    console.error('Rakuten search failed:', error);
    return [];
  }
}

export async function searchByBarcode(barcode: string): Promise<RakutenProduct | null> {
  const appId = process.env.RAKUTEN_APP_ID;

  if (!appId) {
    console.warn('RAKUTEN_APP_ID not configured');
    return null;
  }

  try {
    // Search by JAN code
    const params = new URLSearchParams({
      applicationId: appId,
      keyword: barcode,
      hits: '1',
    });

    const response = await fetch(
      `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?${params}`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const items = data.Items || [];

    if (items.length === 0) {
      return null;
    }

    const item = items[0].Item;
    return {
      name: item.itemName || 'Unknown product',
      brand: extractBrandFromName(item.itemName) || item.shopName || null,
      price: item.itemPrice || 0,
      url: item.itemUrl || '',
      imageUrl: item.mediumImageUrls?.[0]?.imageUrl || null,
      source: 'rakuten' as const,
      janCode: barcode,
    };
  } catch (error) {
    console.error('Rakuten barcode search failed:', error);
    return null;
  }
}

function extractBrandFromName(name: string): string | null {
  const brands = [
    'UNIQLO', 'GU', 'ZARA', 'H&M', 'GAP', 'MUJI', '無印良品',
    'Nike', 'Adidas', 'Converse', 'New Balance', 'VANS',
    'BEAMS', 'UNITED ARROWS', 'SHIPS', 'JOURNAL STANDARD',
    'nano・universe', 'URBAN RESEARCH', 'GLOBAL WORK',
  ];

  const upperName = name.toUpperCase();

  for (const brand of brands) {
    if (upperName.includes(brand.toUpperCase())) {
      return brand;
    }
  }

  // Try to extract brand from brackets
  const bracketMatch = name.match(/【(.+?)】/);
  if (bracketMatch) {
    return bracketMatch[1];
  }

  return null;
}
