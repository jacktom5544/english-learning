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

// Function to get the correct URL from CloudFront/Amplify headers
function getCorrectUrlFromRequest(req: NextRequest): string {
  try {
    // In production always use the forwarded host
    if (process.env.NODE_ENV === 'production') {
      const forwardedHost = req.headers.get('x-forwarded-host');
      const path = new URL(req.url).pathname;
      const search = new URL(req.url).search;
      
      if (forwardedHost) {
        const correctUrl = `https://${forwardedHost}${path}${search}`;
        safeLog('[Debug Session] Corrected URL from headers:', {
          original: req.url,
          forwarded: forwardedHost,
          corrected: correctUrl
        });
        return correctUrl;
      }
    }
    
    // If not in production or no forwarded host, use the base URL + path
    const baseUrl = getNextAuthURL();
    const path = new URL(req.url).pathname;
    const search = new URL(req.url).search;
    return `${baseUrl}${path}${search}`;
  } catch (error) {
    safeError('[Debug Session] Error correcting URL:', error);
    return req.url;
  }
}

export async function GET(req: NextRequest) {
  try {
    safeLog('[Debug Session] Processing debug request');
    
    // Get the corrected URL
    const correctUrl = getCorrectUrlFromRequest(req);
    
    // Get the actual host from headers for debugging
    const host = req.headers.get('host') || 'unknown';
    const forwardedHost = req.headers.get('x-forwarded-host') || 'none';
    const referer = req.headers.get('referer') || 'none';
    const origin = req.headers.get('origin') || 'none';
    
    // Create detailed info about the request for debugging
    const requestAnalysis = {
      originalUrl: req.url,
      correctedUrl: correctUrl,
      headerHost: host,
      forwardedHost: forwardedHost,
      amplify: {
        detected: process.env.AWS_REGION ? true : false,
        region: process.env.AWS_REGION || 'none',
        cloudfrontInfo: req.headers.get('cloudfront-viewer-country') ? 'present' : 'absent'
      },
      environment: process.env.NODE_ENV,
      nodeVersion: process.version
    };
    
    safeLog('[Debug Session] Request Analysis:', requestAnalysis);
    
    // Only get basic environment info to identify the issue
    const responseData = {
      requestInfo: {
        url: correctUrl, 
        actualReqUrl: correctUrl, // Now uses the corrected URL
        headers: Object.fromEntries(req.headers),
        hasCookies: !!req.headers.get('cookie'),
        analysis: requestAnalysis // Include detailed analysis in response
      },
      env: {
        nextAuthUrl: process.env.NEXTAUTH_URL || getNextAuthURL(),
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