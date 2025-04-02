import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User, { IUser } from '@/models/User';
import { safeLog, safeError } from '@/lib/utils';
import { findDocumentsWithOptions } from '@/models/mongoose-utils';
import { adminRequired, isUserAdmin } from '@/lib/admin-helper';

// Helper function to add CORS headers
function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  return response;
}

export async function GET(req: NextRequest) {
  return adminRequired(req, async () => {
    // Create a base response to add headers to
    const baseHeaders = new Headers();
    baseHeaders.set('Access-Control-Allow-Origin', '*');
    baseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    baseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    baseHeaders.set('Access-Control-Allow-Credentials', 'true');
    
    try {
      // Admin check already done by adminRequired helper
      safeLog('Admin users API: Access authorized');
      
      // Connect to the database
      await connectToDatabase();
      
      // Get all users (exclude sensitive fields)
      const users = await findDocumentsWithOptions<IUser>(
        User,
        {},
        '-password',
        { createdAt: -1 }
      );
      
      // Log successful retrieval
      safeLog('Admin users API success', { userCount: users.length });
      
      return NextResponse.json(
        { users },
        { headers: baseHeaders }
      );
    } catch (error) {
      safeError('Error getting users:', error);
      return NextResponse.json(
        { 
          error: 'ユーザー情報の取得中にエラーが発生しました',
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 500, headers: baseHeaders }
      );
    }
  });
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
} 