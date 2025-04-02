import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { consumePoints } from '@/lib/serverUtils';
import { PointSystem } from '@/lib/pointSystem';
import { ENV } from '@/lib/env';
import { safeLog, safeError } from '@/lib/utils';

/**
 * API endpoint to consume points
 * This will be called from client-side components to update points in real-time
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse request body
    const { pointsToConsume } = await req.json();
    
    if (typeof pointsToConsume !== 'number' || pointsToConsume < 0) {
      return NextResponse.json({ error: 'Valid points value required' }, { status: 400 });
    }

    await connectToDatabase();

    // Find user by email
    const userEmail = session.user.email as string;
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      safeError('User not found when consuming points', { email: userEmail });
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Log the attempt
    safeLog('Point consumption API call', {
      userId: user._id.toString(),
      pointsToConsume,
      currentPoints: user.points,
      inProduction: ENV.isProduction,
      inAmplify: ENV.isAWSAmplify
    });

    // Run diagnostic check
    const diagnosticPassed = PointSystem.diagnosticCheck();
    
    // If in development or if diagnostics fail, and we're not in production, let the user proceed anyway
    if (!diagnosticPassed && !ENV.isProduction) {
      safeLog('Point system diagnostic failed, but allowing action in development');
      return NextResponse.json({
        points: user.points,
        pointsUsedThisMonth: user.pointsUsedThisMonth,
        pointsLastUpdated: user.pointsLastUpdated,
        debug_info: 'Development mode: proceeding despite diagnostic failure'
      });
    }

    // Consume points
    const updatedUser = await consumePoints(user._id, pointsToConsume);
    
    if (!updatedUser) {
      return NextResponse.json({ 
        error: 'Not enough points', 
        currentPoints: user.points || 0,
        requiredPoints: pointsToConsume,
        diagnostic: ENV.isProduction ? undefined : PointSystem.getDebugInfo()
      }, { status: 403 });
    }

    // Return updated points info
    return NextResponse.json({
      points: updatedUser.points,
      pointsUsedThisMonth: updatedUser.pointsUsedThisMonth,
      pointsLastUpdated: updatedUser.pointsLastUpdated,
      diagnostic: ENV.isProduction ? undefined : {
        system_ok: diagnosticPassed,
        ...PointSystem.getDebugInfo()
      }
    });
  } catch (error) {
    safeError('Error consuming points:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while consuming points',
        inProduction: ENV.isProduction,
        inAmplify: ENV.isAWSAmplify
      },
      { status: 500 }
    );
  }
} 