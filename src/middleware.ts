import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { safeLog, safeError } from '@/lib/utils';
import { isAmplifyEnvironment } from '@/lib/env';

// Function to determine if a request is going to a static asset
function isStaticAsset(pathname: string): boolean {
  return /\.(.*)$/.test(pathname) || // Files with extensions
    pathname.startsWith('/_next/') || // Next.js resources
    pathname.startsWith('/api/health'); // Health check endpoint
}

// Function to safely get NextAuth secret - this should match auth.ts
function getNextAuthSecret(): string {
  // Use hardcoded secret for reliability
  return 'WJP6m49zmV7Yo1ZNhQmSDctrZHC2WoayEFe9gGzcAAg=';
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
    // Skip processing for static assets and most API routes
    if (isStaticAsset(pathname) || 
        (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/'))) {
      return response;
    }
    
    // For AWS CloudFront compatibility, add specific headers
    if (process.env.NODE_ENV === 'production') {
      // Set Cache-Control header for edge compatibility
      response.headers.set('Cache-Control', 'no-store, max-age=0');
      
      // Add security headers
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // Set CORS headers in Amplify environment
      if (isAmplifyEnvironment()) {
        const origin = request.headers.get('origin');
        if (origin) {
          response.headers.set('Access-Control-Allow-Origin', origin);
          response.headers.set('Access-Control-Allow-Credentials', 'true');
          response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        }
      }
    }

    // Check if route requires authentication
    const requiresAuth = protectedRoutes.some(route => 
      pathname === route || pathname.startsWith(`${route}/`));
      
    if (!requiresAuth) {
      // Pass through for public routes
      return response;
    }

    // Use consistent values for authentication
    const nextAuthURL = getNextAuthURL();
    const nextAuthSecret = getNextAuthSecret();
    
    // Enhanced logging for debugging
    safeLog('Auth middleware check:', { 
      path: pathname, 
      nextAuthURL,
      hasSecret: !!nextAuthSecret,
      cookieHeader: request.headers.get('cookie') || 'no cookies'
    });

    // Get authentication token
    const token = await getToken({ 
      req: request,
      secret: nextAuthSecret,
      secureCookie: true
    });

    // If no token found, redirect to login
    if (!token) {
      const url = new URL('/login', nextAuthURL);
      url.searchParams.set('callbackUrl', encodeURI(request.url));
      return NextResponse.redirect(url);
    }

    // User is authenticated, allow access
    return response;
  } catch (error) {
    safeError('Middleware error:', error);
    
    // On error, redirect to login with error parameter
    const url = new URL('/login', getNextAuthURL());
    url.searchParams.set('error', 'AuthenticationError');
    return NextResponse.redirect(url);
  }
}

// Configure which routes should use the middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. /_next/ (Next.js internals)
     * 2. /static (static files)
     * 3. /favicon.ico, /robots.txt (common static files)
     * 4. /api/health (health check endpoint)
     * 5. .*\..*$ (files with extensions, e.g. images)
     */
    '/((?!_next|static|favicon.ico|robots.txt|api/health|.*\\..*$).*)',
  ],
}; 