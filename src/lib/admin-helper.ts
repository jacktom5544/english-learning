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
  try {
    // Get session from NextAuth
    const session = await getServerSession(authOptions);
    
    // No session or no user
    if (!session?.user?.email) {
      safeLog('Admin check: No session or email');
      return false;
    }
    
    // Connect to DB
    await connectToDatabase();
    
    // Find user by email directly in the database
    const user = await findOneDocument<IUser>(User, { email: session.user.email });
    
    // User not found
    if (!user) {
      safeLog('Admin check: User not found in DB');
      return false;
    }
    
    // Check if role is admin
    const isAdmin = user.role === 'admin';
    safeLog(`Admin check: User ${isAdmin ? 'is' : 'is not'} admin`, {
      email: session.user.email,
      dbRole: user.role,
      sessionRole: session.user.role
    });
    
    return isAdmin;
  } catch (error) {
    safeError('Error checking admin status', error);
    return false;
  }
}

/**
 * Middleware function to enforce admin access to API endpoints
 */
export async function adminRequired(req: NextRequest, handler: Function) {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE, PATCH');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Allow-Credentials', 'true');
  
  try {
    const isAdmin = await isUserAdmin(req);
    
    if (!isAdmin) {
      return NextResponse.json(
        { 
          error: '管理者権限がありません',
          message: 'Admin access required for this endpoint'
        },
        { status: 403, headers }
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
      { status: 500, headers }
    );
  }
} 