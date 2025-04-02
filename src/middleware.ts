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

// Function to safely get NextAuth secret
function getNextAuthSecret(): string {
  return process.env.NEXTAUTH_SECRET || 'dev-only-secret';
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

    // Get authentication token
    const token = await getToken({ 
      req: request,
      secret: getNextAuthSecret(),
      cookieName: 'next-auth.session-token',
      secureCookie: process.env.NODE_ENV === 'production'
    });

    // Debug login issue in production
    if (process.env.NODE_ENV === 'production') {
      safeLog('Auth middleware check:', { 
        path: pathname, 
        hasToken: !!token, 
        cookieHeader: request.headers.get('cookie')?.includes('next-auth.session-token') || false
      });
    }

    // If no token found, redirect to login
    if (!token) {
      const url = new URL('/login', request.url);
      url.searchParams.set('callbackUrl', encodeURI(request.url));
      return NextResponse.redirect(url);
    }

    // User is authenticated, allow access
    return response;
  } catch (error) {
    safeError('Middleware error:', error);
    
    // On error, redirect to login with error parameter
    const url = new URL('/login', request.url);
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