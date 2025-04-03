import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { safeLog, safeError } from '@/lib/utils';
import { isAmplifyEnvironment } from '@/lib/env';
import { jwtVerify } from 'jose';

// Function to determine if a request is going to a static asset
function isStaticAsset(pathname: string): boolean {
  return /\.(.*)$/.test(pathname) || // Files with extensions
    pathname.startsWith('/_next/') || // Next.js resources
    pathname.startsWith('/api/health'); // Health check endpoint
}

// Get the correct NextAuth URL based on environment
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

// Override the internal request URL in production environments with the proper domain
function getCorrectUrl(request: NextRequest): string {
  // In production, ensure we're using the correct host
  if (process.env.NODE_ENV === 'production') {
    try {
      const url = new URL(request.url);
      
      // Extract the forwarded host from headers (AWS Amplify/CloudFront sets this)
      const forwardedHost = request.headers.get('x-forwarded-host') || 'main.d2gwwh0jouqtnx.amplifyapp.com';
      
      if (forwardedHost) {
        // Replace the hostname with the forwarded host
        url.hostname = forwardedHost;
        url.protocol = 'https:';
        url.port = '';
        
        safeLog('[middleware] Corrected URL:', { 
          original: request.url,
          corrected: url.toString()
        });
        
        return url.toString();
      }
    } catch (error) {
      safeError('[middleware] Error correcting URL:', error);
    }
  }
  
  // If we couldn't correct it or not in production, return original
  return request.url;
}

// Define protected routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/profile',
  '/quiz',
  '/vocabulary',
  '/writing',
  '/subscribe',
  '/admin'
];

// Middleware handler function
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  try {
    // Add CORS headers for all requests in production
    if (process.env.NODE_ENV === 'production') {
      // Set Cache-Control header for edge compatibility
      response.headers.set('Cache-Control', 'no-store, max-age=0');
      
      // Add security headers
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // Set CORS headers for all requests to allow cross-origin access
      const origin = request.headers.get('origin') || '*';
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE, PATCH');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version');
      
      // Handle OPTIONS request for CORS preflight
      if (request.method === 'OPTIONS') {
        return new NextResponse(null, { 
          status: 200,
          headers: response.headers
        });
      }
    }

    // Skip processing for static assets and API routes entirely
    // This is critical - don't apply auth middleware to API routes at all
    if (isStaticAsset(pathname) || pathname.startsWith('/api/')) {
      return response;
    }

    // Get the corrected URL to use for authentication
    const correctedUrl = getCorrectUrl(request);

    // Check if route requires authentication
    const requiresAuth = protectedRoutes.some(route => 
      pathname === route || pathname.startsWith(`${route}/`));
      
    if (!requiresAuth) {
      // Pass through for public routes
      return response;
    }

    // Use consistent values for authentication
    const nextAuthURL = getNextAuthURL();
    const secret = process.env.NEXTAUTH_SECRET; 
    
    // Enhanced logging for debugging
    safeLog('Auth middleware check:', { 
      path: pathname, 
      nextAuthURL,
      hasSecret: !!secret, // Check the actual secret being used
      cookieHeader: request.headers.get('cookie') || 'no cookies',
      originalUrl: request.url,
      correctedUrl
    });

    if (!secret) {
       console.error('Middleware: NEXTAUTH_SECRET not found!');
       // Redirect to login if secret is missing during auth check
       // Use nextAuthURL for constructing the redirect URL
       const loginUrl = new URL('/login', nextAuthURL);
       loginUrl.searchParams.set('error', 'ConfigurationError');
       return NextResponse.redirect(loginUrl);
    }

    // Get the DECODED token object (default behavior)
    const token = await getToken({ 
      req: request,
      secret: secret, // Use the validated secret
      secureCookie: process.env.NODE_ENV === 'production',
    });

    // If no decoded token is returned (meaning cookie was invalid, expired, or missing), redirect to login
    if (!token) {
      safeLog('Middleware: No valid token found after getToken, redirecting to login.');
      const loginUrl = new URL('/login', nextAuthURL);
      loginUrl.searchParams.set('callbackUrl', encodeURI(correctedUrl));
      // Redirect with SessionInvalid error if attempting protected route without valid session
      loginUrl.searchParams.set('error', 'SessionInvalid'); 
      return NextResponse.redirect(loginUrl);
    }

    // If we get here, getToken successfully decrypted the token using the secret,
    // implying the session is valid. Allow the request.
    safeLog('Middleware: Token decoded successfully, allowing request.');
    return response;

  } catch (error) { // Outer catch block handles errors during getToken etc.
    safeError('Middleware error (outer catch):', error);
    const loginUrl = new URL('/login', getNextAuthURL()); // Use getter function here
    loginUrl.searchParams.set('error', 'MiddlewareError');
    return NextResponse.redirect(loginUrl);
  }
}

// Configure which routes should use the middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt (robots file)
     * - static (public static files)
     * - files with extensions (e.g. .png)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|static|.*\\..*$).*)',
  ],
}; 