import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { safeError, safeLog } from '@/lib/utils';

// Fix for NextAuth in AWS Amplify
// The issue is that NextAuth expects /api/auth/signin, /api/auth/session etc.
// but Amplify is not correctly passing the path segments to the handler
function extractNextAuthAction(req: NextRequest): string | null {
  try {
    // Parse the URL path to find the NextAuth action (signin, callback, session, etc.)
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    
    // Look for the part after /api/auth/
    // The pattern should be /api/auth/[action]
    const authIndex = pathParts.findIndex(part => part === 'auth');
    if (authIndex >= 0 && authIndex + 1 < pathParts.length) {
      return pathParts[authIndex + 1];
    }
    
    return null;
  } catch (error) {
    safeError('[NextAuth] Error extracting NextAuth action:', error);
    return null;
  }
}

// Function to fix request URL for AWS Amplify environment
const fixRequestUrl = (req: NextRequest) => {
  if (process.env.NODE_ENV === 'production') {
    try {
      const url = new URL(req.url);
      const forwardedHost = req.headers.get('x-forwarded-host');
      
      if (forwardedHost) {
        // Create the correct production URL
        const correctedUrl = `https://${forwardedHost}${url.pathname}${url.search}`;
        
        // Log the URL correction for debugging
        safeLog('[NextAuth] Correcting request URL', {
          original: req.url,
          corrected: correctedUrl
        });
        
        // Override the URL property
        Object.defineProperty(req, 'url', {
          get: () => correctedUrl,
          configurable: true
        });
      }
      
      // Extract the NextAuth action from the URL
      const nextAuthAction = extractNextAuthAction(req);
      if (nextAuthAction) {
        // Ensure req.query exists and add the nextauth param
        safeLog('[NextAuth] Adding nextauth action to request:', nextAuthAction);
        
        // Add the query parameter manually
        // We need to do this because Amplify isn't correctly parsing [...nextauth]
        const requestWithQuery = req as any;
        requestWithQuery.query = requestWithQuery.query || {};
        requestWithQuery.query.nextauth = [nextAuthAction];
      }
    } catch (error) {
      safeError('[NextAuth] Error fixing request URL:', error);
    }
  }
  return req;
};

// Wrapper to handle errors in NextAuth handler
const withErrorHandling = async (req: NextRequest, handler: (req: NextRequest) => Promise<Response>) => {
  try {
    // Log details about the request for debugging
    safeLog('[NextAuth] Processing request', {
      url: req.url,
      method: req.method,
      hasCookies: !!req.headers.get('cookie'),
      headers: {
        host: req.headers.get('host'),
        forwardedHost: req.headers.get('x-forwarded-host')
      }
    });
    
    // Fix the URL before passing to NextAuth
    const fixedReq = fixRequestUrl(req);
    
    // Create a direct response for session endpoint
    if (req.url.includes('/api/auth/session')) {
      safeLog('[NextAuth] Detected session request, using direct handling');
      
      try {
        // Use NextAuth handler but with extra error handling
        const response = await handler(fixedReq);
        
        // Log the NextAuth response
        safeLog('[NextAuth] Session Response', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries([...response.headers.entries()])
        });
        
        if (!response.ok) {
          // If there's an error, return an empty session
          const emptySession = {
            user: null,
            expires: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
          };
          
          const fallbackResponse = NextResponse.json(emptySession, { status: 200 });
          fallbackResponse.headers.set('Content-Type', 'application/json');
          
          // Add CORS headers
          fallbackResponse.headers.set('Access-Control-Allow-Credentials', 'true');
          fallbackResponse.headers.set('Access-Control-Allow-Origin', '*');
          
          return fallbackResponse;
        }
        
        return response;
      } catch (error) {
        safeError('[NextAuth] Error in session handler:', error);
        
        // Return empty session on error
        const emptySession = {
          user: null,
          expires: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
        };
        
        const fallbackResponse = NextResponse.json(emptySession, { status: 200 });
        fallbackResponse.headers.set('Content-Type', 'application/json');
        
        // Add CORS headers
        fallbackResponse.headers.set('Access-Control-Allow-Credentials', 'true');
        fallbackResponse.headers.set('Access-Control-Allow-Origin', '*');
        
        return fallbackResponse;
      }
    }
    
    // For other NextAuth endpoints, proceed with normal handling
    
    // Call the NextAuth handler and await the response
    const response = await handler(fixedReq);
    
    // Log details about the response for debugging
    safeLog('[NextAuth] Response', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries([...response.headers.entries()])
    });
    
    // If we don't have a valid response, create a fallback
    if (!response.ok && (response.status === 500 || response.status === 0)) {
      safeError('[NextAuth] Invalid response from NextAuth handler', {
        status: response.status,
        statusText: response.statusText
      });
      
      // Provide a valid JSON fallback response
      const fallbackResponse = NextResponse.json(
        { error: 'Internal authentication error', status: 'error' },
        { status: 500 }
      );
      
      // Add CORS headers
      fallbackResponse.headers.set('Access-Control-Allow-Credentials', 'true');
      fallbackResponse.headers.set('Access-Control-Allow-Origin', '*');
      fallbackResponse.headers.set('Content-Type', 'application/json');
      
      return fallbackResponse;
    }
    
    // Add CORS headers to the response
    const enhancedResponse = new Response(response.body, response);
    enhancedResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    enhancedResponse.headers.set('Access-Control-Allow-Origin', '*');
    
    // Ensure content type is set
    if (!enhancedResponse.headers.get('Content-Type')) {
      enhancedResponse.headers.set('Content-Type', 'application/json');
    }
    
    return enhancedResponse;
  } catch (error) {
    // Log the error
    safeError('[NextAuth] Error in NextAuth handler', error);
    
    // Return a proper error response
    const errorResponse = NextResponse.json(
      { 
        error: 'Authentication error', 
        message: error instanceof Error ? error.message : 'Unknown error',
        status: 'error'
      },
      { status: 500 }
    );
    
    // Add CORS headers
    errorResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Content-Type', 'application/json');
    
    return errorResponse;
  }
};

// Enhanced handlers for Next.js App Router with URL correction and error handling
export const GET = async (req: NextRequest) => {
  return withErrorHandling(req, async (fixedReq) => {
    return await NextAuth(authOptions)(fixedReq);
  });
};

export const POST = async (req: NextRequest) => {
  return withErrorHandling(req, async (fixedReq) => {
    return await NextAuth(authOptions)(fixedReq);
  });
};

// Handle OPTIONS for CORS preflight
export async function OPTIONS(req: NextRequest) {
  safeLog('[NextAuth] Handling OPTIONS request for CORS preflight');
  
  const res = new NextResponse(null, { status: 200 });
  
  // Add CORS headers
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  return res;
} 