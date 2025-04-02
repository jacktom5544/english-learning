import { NextResponse } from 'next/server';
import { getCurrentUserWithPoints } from '@/lib/serverUtils';
import { connectToDatabase } from '@/lib/db';
import { PointSystem } from '@/lib/pointSystem';
import { isProduction, isAWSAmplify } from '@/lib/env';
import { safeLog, safeError } from '@/lib/utils';

export async function GET() {
  // Create response with CORS headers
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Allow-Credentials', 'true');
  
  try {
    await connectToDatabase();
    
    const user = await getCurrentUserWithPoints();
    
    // Log point retrieval attempt for debugging
    safeLog('Points retrieval attempt', {
      userExists: !!user,
      inProduction: isProduction(),
      inAmplify: isAWSAmplify()
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers }
      );
    }
    
    // Run diagnostic check to verify system is working
    const diagnosticPassed = PointSystem.diagnosticCheck();
    
    return NextResponse.json({
      points: user.points,
      pointsUsedThisMonth: user.pointsUsedThisMonth,
      pointsLastUpdated: user.pointsLastUpdated,
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