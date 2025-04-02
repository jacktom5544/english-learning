import { NextResponse } from 'next/server';
import { getCurrentUserWithPoints } from '@/lib/serverUtils';
import { connectToDatabase } from '@/lib/db';
import { PointSystem } from '@/lib/pointSystem';
import { isProduction, isAWSAmplify } from '@/lib/env';
import { safeLog, safeError } from '@/lib/utils';
import User, { IUser } from '@/models/User';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { findOneDocument } from '@/models/mongoose-utils';

/**
 * API endpoint to get user points
 * This is a critical endpoint that needs to be highly reliable
 */
export async function GET() {
  // Create response with CORS headers
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Allow-Credentials', 'true');
  
  try {
    await connectToDatabase();
    
    // Attempt to get the current user using multiple methods for reliability
    let user: IUser | null = null;
    let errorDetails = [];
    
    // Try method 1: Via getCurrentUserWithPoints helper
    try {
      user = await getCurrentUserWithPoints();
      if (user) {
        safeLog('Points API: Retrieved user via getCurrentUserWithPoints', {
          userId: user._id.toString(),
          points: user.points
        });
      } else {
        errorDetails.push('getCurrentUserWithPoints returned null');
      }
    } catch (error) {
      errorDetails.push(`Error with getCurrentUserWithPoints: ${error instanceof Error ? error.message : String(error)}`);
      safeError('Points API: Error with getCurrentUserWithPoints', error);
    }
    
    // Try method 2: Via session and direct DB query if first method failed
    if (!user) {
      try {
        const session = await getServerSession(authOptions);
        
        if (session?.user?.email) {
          user = await findOneDocument<IUser>(User, { email: session.user.email });
          
          if (user) {
            safeLog('Points API: Retrieved user via direct DB query', {
              userId: user._id.toString(),
              points: user.points
            });
          } else {
            errorDetails.push(`User not found for email: ${session.user.email}`);
          }
        } else {
          errorDetails.push('No session or email in session');
        }
      } catch (error) {
        errorDetails.push(`Error with direct DB query: ${error instanceof Error ? error.message : String(error)}`);
        safeError('Points API: Error with direct DB query', error);
      }
    }
    
    // Try method 3: JWT token extraction if available
    if (!user) {
      try {
        // Look for authorization header
        const authHeader = headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          // Very basic validation - in production you'd verify the JWT
          const base64Payload = token.split('.')[1];
          const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
          
          if (payload.email) {
            user = await findOneDocument<IUser>(User, { email: payload.email });
            if (user) {
              safeLog('Points API: Retrieved user via token extraction', {
                userId: user._id.toString()
              });
            } else {
              errorDetails.push(`User not found for token email: ${payload.email}`);
            }
          }
        }
      } catch (error) {
        errorDetails.push(`Error with token extraction: ${error instanceof Error ? error.message : String(error)}`);
        safeError('Points API: Error with token extraction', error);
      }
    }
    
    // If we still couldn't get the user, return error with debugging info
    if (!user) {
      safeLog('Points API: User not found by any method', { errors: errorDetails });
      return NextResponse.json(
        { 
          error: 'User not found',
          details: errorDetails,
          inProduction: isProduction(),
          inAmplify: isAWSAmplify(),
          debug: true
        },
        { status: 404, headers }
      );
    }
    
    // Run diagnostic check to verify system is working
    const diagnosticPassed = PointSystem.diagnosticCheck();
    
    // Ensure points are a valid number
    const points = typeof user.points === 'number' ? user.points : 0;
    const pointsUsedThisMonth = typeof user.pointsUsedThisMonth === 'number' ? user.pointsUsedThisMonth : 0;
    
    return NextResponse.json({
      points,
      pointsUsedThisMonth,
      pointsLastUpdated: user.pointsLastUpdated || new Date(),
      // Include diagnostic info in development or for debugging
      diagnostics: isProduction() ? undefined : {
        system_ok: diagnosticPassed,
        ...PointSystem.getDebugInfo()
      }
    }, { headers });
  } catch (error) {
    safeError('Error fetching user points:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch user points',
        details: error instanceof Error ? error.message : String(error),
        inProduction: isProduction(),
        inAmplify: isAWSAmplify()
      },
      { status: 500, headers }
    );
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Allow-Credentials', 'true');
  
  return new NextResponse(null, { 
    status: 200,
    headers
  });
} 