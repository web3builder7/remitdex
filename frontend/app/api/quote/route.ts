import { NextRequest, NextResponse } from 'next/server';
import { getRemittanceEngine } from '@/lib/remittance-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const remittanceEngine = getRemittanceEngine();
    
    const quote = await remittanceEngine.getQuote(body);
    
    return NextResponse.json({ success: true, quote });
  } catch (error: any) {
    console.error('Quote API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get quote' },
      { status: 400 }
    );
  }
}