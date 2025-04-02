import { NextResponse } from 'next/server';
import { isAWSAmplify } from '@/lib/env';

// Public health check endpoint for verifying application is responding
export async function GET() {
  try {
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      isAmplify: isAWSAmplify(),
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Health check failed',
    }, { status: 500 });
  }
}

// Export cache configuration to ensure the response is not cached
export const dynamic = 'force-dynamic'; 