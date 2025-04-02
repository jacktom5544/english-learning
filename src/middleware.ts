import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

// Simplified middleware that just lets all requests through
export function middleware(request: NextRequest) {
  // Allow all requests
  return NextResponse.next();
}

// Configure middleware to only run on specific paths, and completely bypass the root path
export const config = {
  matcher: [
    // Skip the root path and static assets completely
    '/((?!_next|favicon.ico|api/health).*)',
  ]
}; 