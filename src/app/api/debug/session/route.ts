import { NextRequest, NextResponse } from 'next/server';
import { safeLog, safeError } from '@/lib/utils';

// Get the correct NextAuth URL based on environment (same as middleware.ts)
function getNextAuthURL(): string {
  // Always use the deployed Amplify URL in production
  if (process.env.NODE_ENV === 'production') {
    return 'https://main.d2gwwh0jouqtnx.amplifyapp.com';
  }
  // Check for explicitly set NEXTAUTH_URL
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }
  // Default to localhost
  return 'http://localhost:3000';
}

export async function GET(req: NextRequest) {
  try {
    safeLog('[Debug Session] Processing debug request');
    
    // Get the actual correct URL for this environment
    const baseUrl = getNextAuthURL();
    // Extract path from request
    const path = new URL(req.url).pathname;
    // Construct correct full URL
    const correctUrl = `${baseUrl}${path}`;
    
    safeLog('[Debug Session] URLs', {
      requestUrl: req.url,
      correctedUrl: correctUrl,
      baseUrl
    });
    
    // Only get basic environment info to identify the issue
    const responseData = {
      requestInfo: {
        url: correctUrl, // Use the corrected URL, not req.url
        actualReqUrl: req.url, // For debugging
        headers: Object.fromEntries(req.headers),
        hasCookies: !!req.headers.get('cookie')
      },
      env: {
        nextAuthUrl: process.env.NEXTAUTH_URL || baseUrl,
        nodeEnv: process.env.NODE_ENV,
        hasSecret: !!process.env.NEXTAUTH_SECRET,
        isAmplify: process.env.AWS_REGION ? true : false
      }
    };
    
    // Create response with CORS headers
    const response = NextResponse.json(responseData);
    
    // Add CORS headers
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    
    return response;
  } catch (error) {
    safeError('[Debug Session] Error in debug endpoint:', error);
    
    // Create error response with CORS headers
    const errorResponse = NextResponse.json(
      { 
        error: 'Debug error', 
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      },
      { status: 500 }
    );
    
    // Add CORS headers
    errorResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    
    return errorResponse;
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  
  // Add CORS headers
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  return response;
} 