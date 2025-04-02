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
    
    // Try method 1: Via getCurrentUserWithPoints helper
    try {
      user = await getCurrentUserWithPoints();
      if (user) {
        safeLog('Points API: Retrieved user via getCurrentUserWithPoints', {
          userId: user._id.toString(),
          points: user.points
        });
      }
    } catch (error) {
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
          }
        }
      } catch (error) {
        safeError('Points API: Error with direct DB query', error);
      }
    }
    
    // If we still couldn't get the user, return error
    if (!user) {
      safeLog('Points API: User not found by any method');
      return NextResponse.json(
        { error: 'User not found' },
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