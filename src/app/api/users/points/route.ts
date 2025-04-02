import { NextResponse } from 'next/server';
import { getCurrentUserWithPoints } from '@/lib/serverUtils';
import { connectToDatabase } from '@/lib/db';
import { PointSystem } from '@/lib/pointSystem';
import { ENV } from '@/lib/env';
import { safeLog } from '@/lib/utils';

export async function GET() {
  try {
    await connectToDatabase();
    
    const user = await getCurrentUserWithPoints();
    
    // Log point retrieval attempt for debugging
    safeLog('Points retrieval attempt', {
      userExists: !!user,
      inProduction: ENV.isProduction,
      inAmplify: ENV.isAWSAmplify
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Run diagnostic check to verify system is working
    const diagnosticPassed = PointSystem.diagnosticCheck();
    
    return NextResponse.json({
      points: user.points,
      pointsUsedThisMonth: user.pointsUsedThisMonth,
      pointsLastUpdated: user.pointsLastUpdated,
      // Include diagnostic info in development or for debugging
      diagnostics: ENV.isProduction ? undefined : {
        system_ok: diagnosticPassed,
        ...PointSystem.getDebugInfo()
      }
    });
  } catch (error) {
    console.error('Error fetching user points:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch user points',
        inProduction: ENV.isProduction,
        inAmplify: ENV.isAWSAmplify
      },
      { status: 500 }
    );
  }
} 