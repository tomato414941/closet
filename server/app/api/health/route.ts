import { NextResponse } from 'next/server';

export async function GET() {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      openai: !!process.env.OPENAI_API_KEY,
      serpapi: !!process.env.SERPAPI_KEY,
      rakuten: !!process.env.RAKUTEN_APP_ID,
    },
  };

  return NextResponse.json(status);
}
