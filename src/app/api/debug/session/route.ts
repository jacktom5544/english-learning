import { NextRequest, NextResponse } from 'next/server';
import { safeLog, safeError } from '@/lib/utils';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

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

export async function GET() {
  try {
    // Get the session data
    const session = await getServerSession(authOptions);
    
    // Log session details for debugging
    safeLog('Session data:', JSON.stringify(session));
    
    // Return session info with sensitive data masked
    return NextResponse.json({
      authenticated: !!session,
      session: session ? {
        user: {
          id: session.user?.id,
          name: session.user?.name,
          email: session.user?.email ? `${session.user.email.substring(0, 3)}...` : null,
          role: session.user?.role,
          // Include other fields we're interested in checking
          hasPoints: typeof session.user?.points === 'number',
          points: session.user?.points,
          subscriptionStatus: session.user?.subscriptionStatus,
        },
        expires: session.expires,
      } : null,
      cookies: {
        count: Object.keys(
          Object.fromEntries(
            (headers().get('cookie') || '')
              .split(';')
              .map(c => c.trim())
              .filter(Boolean)
              .map(c => [c.split('=')[0], '***'])
          )
        ).length,
        names: Object.keys(
          Object.fromEntries(
            (headers().get('cookie') || '')
              .split(';')
              .map(c => c.trim())
              .filter(Boolean)
              .map(c => [c.split('=')[0], '***'])
          )
        ),
      }
    });
  } catch (error) {
    console.error('Session debug error:', error);
    return NextResponse.json({
      authenticated: false,
      error: 'Failed to get session',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Helper function to get request headers
function headers() {
  return new Headers(
    // @ts-ignore - This exists in the edge runtime
    typeof EdgeRuntime !== 'undefined'
      ? {}
      : Object.fromEntries(
          Object.entries(
            // @ts-ignore - globalThis is not typed
            globalThis.CURRENT_INVOCATION?.req?.headers || {}
          )
        )
  );
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