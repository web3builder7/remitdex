import { NextRequest, NextResponse } from 'next/server';
import { getRemittanceEngine } from '@/lib/remittance-engine';

export async function POST(request: NextRequest) {
  try {
    const { quote, senderAddress, recipientDetails } = await request.json();
    const remittanceEngine = getRemittanceEngine();
    
    const order = await remittanceEngine.executeRemittance(
      quote,
      senderAddress,
      recipientDetails
    );
    
    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error('Remit API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to execute remittance' },
      { status: 400 }
    );
  }
}