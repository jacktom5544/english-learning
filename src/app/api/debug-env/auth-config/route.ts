import { NextResponse } from 'next/server';
import { safeLog } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    safeLog('Checking authentication configuration...');
    
    // Check auth-related environment variables
    const envVars = {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'Not defined',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 
        'Defined (length: ' + process.env.NEXTAUTH_SECRET.length + ')' : 
        'Not defined',
      NEXTAUTH_URL_INTERNAL: process.env.NEXTAUTH_URL_INTERNAL || 'Not defined',
      NODE_ENV: process.env.NODE_ENV || 'Not defined',
    };
    
    return NextResponse.json({ 
      success: true,
      message: 'Auth configuration check completed',
      environment: envVars,
      // Additional info
      hostname: process.env.HOSTNAME || 'Not defined',
      vercel: process.env.VERCEL ? 'true' : 'false',
      amplify: process.env.AWS_REGION ? 'true' : 'false',
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 