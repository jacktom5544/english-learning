import { NextRequest, NextResponse } from 'next/server';
import { safeLog, safeError } from '@/lib/utils';

export async function GET(req: NextRequest) {
  try {
    safeLog('[Debug Session] Processing simplified debug request');
    
    // Only get basic environment info to identify the issue
    const responseData = {
      requestInfo: {
        url: req.url,
        headers: Object.fromEntries(req.headers),
        hasCookies: !!req.headers.get('cookie')
      },
      env: {
        nextAuthUrl: process.env.NEXTAUTH_URL,
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
    safeError('[Debug Session] Error in simplified debug endpoint:', error);
    
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