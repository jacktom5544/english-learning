import { NextResponse } from 'next/server';
import { safeLog } from '@/lib/utils';
import { isAmplifyEnvironment, isAWSAmplify, isProduction } from '@/lib/env';

/**
 * Debug endpoint to verify Amplify environment detection
 */
export async function GET() {
  // Add CORS headers
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  try {
    // Check all environment variables that might indicate Amplify
    const amplifyChecks = {
      isAmplifyEnvironment: isAmplifyEnvironment(),
      isAWSAmplify: isAWSAmplify(),
      isProduction: isProduction(),
      aws_region: process.env.AWS_REGION || 'not set',
      aws_lambda_function: process.env.AWS_LAMBDA_FUNCTION_NAME ? 'set' : 'not set',
      nextauth_url: process.env.NEXTAUTH_URL || 'not set',
      node_env: process.env.NODE_ENV || 'not set',
      has_amplify_in_url: (process.env.NEXTAUTH_URL || '').includes('amplifyapp.com'),
      amplify_environment_var: process.env.AMPLIFY_ENVIRONMENT || 'not set'
    };
    
    safeLog('Amplify environment check:', amplifyChecks);
    
    return NextResponse.json({
      status: 'ok',
      time: new Date().toISOString(),
      amplifyChecks,
      conclusion: isAmplifyEnvironment() ? 'Running in Amplify' : 'Not running in Amplify'
    }, { headers });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500, headers });
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return new NextResponse(null, { 
    status: 200,
    headers
  });
} 