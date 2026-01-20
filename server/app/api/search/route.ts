import { NextRequest, NextResponse } from 'next/server';
import { searchByText } from '@/lib/serpapi';
import { searchProducts, searchByBarcode } from '@/lib/rakuten';

export interface ProductResult {
  name: string;
  brand: string | null;
  price: number | null;
  url: string;
  imageUrl: string | null;
  source: string;
  janCode?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, barcode } = body;

    if (!query && !barcode) {
      return NextResponse.json(
        { error: 'Query or barcode is required' },
        { status: 400 }
      );
    }

    const products: ProductResult[] = [];

    // If barcode provided, search by barcode first
    if (barcode) {
      const barcodeResult = await searchByBarcode(barcode);
      if (barcodeResult) {
        products.push(barcodeResult);
      }
    }

    // Parallel search across multiple sources
    if (query) {
      const [serpResults, rakutenResults] = await Promise.all([
        searchByText(query),
        searchProducts(query),
      ]);

      products.push(...serpResults);
      products.push(...rakutenResults);
    }

    // Deduplicate and sort by relevance (price available first)
    const uniqueProducts = deduplicateProducts(products);
    const sortedProducts = uniqueProducts.sort((a, b) => {
      if (a.price && !b.price) return -1;
      if (!a.price && b.price) return 1;
      return 0;
    });

    return NextResponse.json({
      products: sortedProducts.slice(0, 10),
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to search products' },
      { status: 500 }
    );
  }
}

function deduplicateProducts(products: ProductResult[]): ProductResult[] {
  const seen = new Set<string>();
  return products.filter((product) => {
    const key = `${product.name.toLowerCase().slice(0, 30)}-${product.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
