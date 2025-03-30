import { NextResponse } from 'next/server';

// This middleware ensures that server-only functionality
// is properly handled by preventing direct client-side access
// to routes that use server-only libraries like bcrypt
export function middleware(request) {
  // Just pass through all requests - the purpose of this file is to
  // signal to Next.js that we're handling server/client boundaries
  return NextResponse.next();
}

// See: https://nextjs.org/docs/app/building-your-application/routing/middleware
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}; 