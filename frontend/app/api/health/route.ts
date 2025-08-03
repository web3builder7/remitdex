import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      status: 'ok',
      service: 'RemitDEX API',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Health API error:', error);
    return NextResponse.json(
      { 
        status: 'error',
        service: 'RemitDEX API',
        version: '1.0.0',
        error: error.message
      },
      { status: 503 }
    );
  }
}