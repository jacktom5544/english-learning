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
    safeLog(`[isUserAdmin] Session received. Elapsed: ${Date.now() - startTime}ms`);
    
    // No session or no user
    if (!session?.user?.email) {
      safeLog('Admin check: No session or email', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasEmail: !!session?.user?.email
      });
      safeLog(`[isUserAdmin] Check failed (no session/email). Total time: ${Date.now() - startTime}ms`);
      return false;
    }
    
    // Connect to DB
    safeLog('[isUserAdmin] Connecting to DB...');
    await connectToDatabase();
    safeLog(`[isUserAdmin] DB connected. Elapsed: ${Date.now() - startTime}ms`);
    
    // Find user by email directly in the database
    safeLog(`[isUserAdmin] Finding user by email: ${session.user.email}...`);
    const user = await findOneDocument<IUser>(User, { email: session.user.email });
    safeLog(`[isUserAdmin] User lookup done. Found: ${!!user}. Elapsed: ${Date.now() - startTime}ms`);
    
    // User not found
    if (!user) {
      safeLog('Admin check: User not found in DB', { email: session.user.email });
      safeLog(`[isUserAdmin] Check failed (user not in DB). Total time: ${Date.now() - startTime}ms`);
      return false;
    }
    
    // Check if role is admin
    const isAdmin = user.role === 'admin';
    safeLog(`Admin check: User ${isAdmin ? 'is' : 'is not'} admin`, {
      email: session.user.email,
      dbUserId: user._id.toString(),
      dbRole: user.role,
      sessionRole: session.user.role
    });
    
    safeLog(`[isUserAdmin] Check ${isAdmin ? 'passed' : 'failed'}. Total time: ${Date.now() - startTime}ms`);
    return isAdmin;
  } catch (error) {
    safeError('Error checking admin status', error);
    safeLog(`[isUserAdmin] Check failed (error). Total time: ${Date.now() - startTime}ms`);
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
      return NextResponse.json(
        { 
          error: '管理者権限がありません',
          message: 'Admin access required for this endpoint'
        },
        { status: 403 }
      );
    }
    
    // User is admin, proceed to handler
    return handler();
  } catch (error) {
    safeError('Error in admin authorization', error);
    
    return NextResponse.json(
      { 
        error: '認証中にエラーが発生しました',
        message: 'Error checking admin authorization'
      },
      { status: 500 }
    );
  }
} 