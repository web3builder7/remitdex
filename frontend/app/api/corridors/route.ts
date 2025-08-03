import { NextRequest, NextResponse } from 'next/server';
import { getRemittanceEngine } from '@/lib/remittance-engine';

export async function GET(request: NextRequest) {
  try {
    const remittanceEngine = getRemittanceEngine();
    const corridors = await remittanceEngine.getSupportedCorridors();
    
    return NextResponse.json({ success: true, corridors });
  } catch (error: any) {
    console.error('Corridors API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get corridors' },
      { status: 400 }
    );
  }
}