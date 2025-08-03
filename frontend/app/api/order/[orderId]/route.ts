import { NextRequest, NextResponse } from 'next/server';
import { getRemittanceEngine } from '@/lib/remittance-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = params.orderId;
    const remittanceEngine = getRemittanceEngine();
    
    const order = await remittanceEngine.getOrderStatus(orderId);
    
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error('Order API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get order status' },
      { status: 400 }
    );
  }
}