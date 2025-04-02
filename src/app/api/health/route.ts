import { NextResponse } from 'next/server';

// Public health check endpoint for verifying application is responding
export async function GET() {
  try {
    // Basic health check with environment information
    return NextResponse.json({
      status: 'ok',
      time: new Date().toISOString(),
      env: {
        nodejs: process.version,
        nextAuthUrl: process.env.NEXTAUTH_URL || 'not set',
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        nodeEnv: process.env.NODE_ENV,
        isAWS: !!process.env.AWS_REGION,
        aws: {
          region: process.env.AWS_REGION || 'not set',
          amplify: !!process.env.AWS_AMPLIFY_APP_ID,
        }
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error',
        time: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Export cache configuration to ensure the response is not cached
export const dynamic = 'force-dynamic'; 