import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { safeLog, safeError } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { findOneDocument } from '@/models/mongoose-utils';
import User, { IUser } from '@/models/User';

/**
 * Utilities for handling admin authorization and access control
 */

/**
 * Check if the current user is an admin
 * This works around any session/token issues by directly checking the database
 */
export async function isUserAdmin(req?: NextRequest): Promise<boolean> {
  const startTime = Date.now();
  safeLog('[isUserAdmin] Starting check...');
  try {
    // Get session from NextAuth
    safeLog('[isUserAdmin] Attempting to get session...');
    const session = await getServerSession(authOptions);
    // Log detailed session info retrieved *within* this function
    safeLog('[isUserAdmin] Session object retrieved:', session ? { 
      userExists: !!session.user, 
      email: session.user?.email ? 'present' : 'missing', 
      role: session.user?.role 
    } : 'null session');
    safeLog(`[isUserAdmin] Session retrieved. Elapsed: ${Date.now() - startTime}ms`);
    
    // No session or no user
    if (!session?.user?.email) {
      safeLog('[isUserAdmin] Check failed: No session or email found inside isUserAdmin', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasEmail: !!session?.user?.email
      });
      safeLog(`[isUserAdmin] Check failed (no session/email). Total time: ${Date.now() - startTime}ms`);
      return false;
    }
    
    // Connect to DB
    safeLog('[isUserAdmin] Connecting to DB...');
    await connectToDatabase(); // Ensure DB connection is attempted
    safeLog(`[isUserAdmin] DB connected or connection attempt made. Elapsed: ${Date.now() - startTime}ms`);
    
    // Find user by email directly in the database
    const userEmail = session.user.email;
    safeLog(`[isUserAdmin] Finding user in DB by email: ${userEmail}...`);
    let user: IUser | null = null;
    let dbError: any = null;
    try {
      user = await findOneDocument<IUser>(User, { email: userEmail });
    } catch (error) {
      dbError = error;
      safeError('[isUserAdmin] Error during findOneDocument:', error);
    }
    safeLog(`[isUserAdmin] User lookup done. Found: ${!!user}. DB Error: ${dbError ? 'Yes' : 'No'}. Elapsed: ${Date.now() - startTime}ms`);

    // User not found or DB error
    if (!user) {
      safeLog('[isUserAdmin] Check failed: User not found in DB or DB error occurred', { email: userEmail, dbError: dbError ? (dbError.message || String(dbError)) : null });
      safeLog(`[isUserAdmin] Check failed (user not in DB or error). Total time: ${Date.now() - startTime}ms`);
      return false;
    }
    
    // Check if role is admin
    const dbRole = user.role;
    const isAdmin = dbRole === 'admin';
    safeLog(`[isUserAdmin] Role check complete. DB Role: ${dbRole}, IsAdmin: ${isAdmin}`, {
      email: userEmail,
      dbUserId: user._id.toString(),
      sessionRole: session.user.role // Compare with session role
    });
    
    safeLog(`[isUserAdmin] Check ${isAdmin ? 'passed' : 'failed'}. Total time: ${Date.now() - startTime}ms`);
    return isAdmin;
  } catch (error) {
    safeError('[isUserAdmin] Unexpected error during admin status check', error);
    safeLog(`[isUserAdmin] Check failed (unexpected error). Total time: ${Date.now() - startTime}ms`);
    return false;
  }
}

/**
 * Middleware function to enforce admin access to API endpoints
 */
export async function adminRequired(req: NextRequest, handler: Function) {
  try {
    const isAdmin = await isUserAdmin(req);
    
    if (!isAdmin) {
      // Add CORS headers for the 403 response
      const headers = new Headers();
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE, PATCH');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      headers.set('Access-Control-Allow-Credentials', 'true');

      return NextResponse.json(
        { 
          error: '管理者権限がありません',
          message: 'Admin access required for this endpoint'
        },
        { status: 403, headers } // Pass headers here
      );
    }
    
    // User is admin, proceed to handler (handler will set its own headers)
    return handler();
  } catch (error) {
    safeError('Error in admin authorization', error);
    
    // Add CORS headers for the 500 response
    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE, PATCH');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Allow-Credentials', 'true');

    return NextResponse.json(
      { 
        error: '認証中にエラーが発生しました',
        message: 'Error checking admin authorization'
      },
      { status: 500, headers } // Pass headers here
    );
  }
} 