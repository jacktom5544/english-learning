import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import getClient from '@/lib/db';
import { ObjectId } from 'mongodb';
import { consumePoints } from '@/lib/serverUtils';
import { PointSystem } from '@/lib/pointSystem';
import { isProduction, isAWSAmplify } from '@/lib/env';
import { safeLog, safeError } from '@/lib/utils';

/**
 * API endpoint to consume points
 * This will be called from client-side components to update points in real-time
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      console.error('POST /points/consume: Authentication required - No user ID');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id;
    if (!ObjectId.isValid(userId)) {
        console.error(`POST /points/consume: Invalid user ID format: ${userId}`);
        return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
    }

    // Parse request body
    const { pointsToConsume } = await req.json();
    
    if (typeof pointsToConsume !== 'number' || pointsToConsume < 0) {
      return NextResponse.json({ error: 'Valid points value required' }, { status: 400 });
    }

    const { db } = await getClient();

    // Find user by ID using native driver
    const usersCollection = db.collection('users');
    const userDoc = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!userDoc) {
      safeError('User not found when consuming points', { userId: userId });
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Log the attempt
    safeLog('Point consumption API call', {
      userId: userId,
      pointsToConsume,
      currentPoints: userDoc.points,
      inProduction: isProduction(),
      inAmplify: isAWSAmplify()
    });

    // Run diagnostic check
    const diagnosticPassed = PointSystem.diagnosticCheck();
    
    // If in development or if diagnostics fail, and we're not in production, let the user proceed anyway
    if (!diagnosticPassed && !isProduction()) {
      safeLog('Point system diagnostic failed, but allowing action in development');
      return NextResponse.json({
        points: userDoc.points,
        pointsUsedThisMonth: userDoc.pointsUsedThisMonth,
        pointsLastUpdated: userDoc.pointsLastUpdated,
        debug_info: 'Development mode: proceeding despite diagnostic failure'
      });
    }

    // Consume points - Pass string ID
    const updatedUserMongooseDoc = await consumePoints(userId, pointsToConsume);
    
    if (!updatedUserMongooseDoc) {
      return NextResponse.json({ 
        error: 'Not enough points', 
        currentPoints: userDoc.points || 0,
        requiredPoints: pointsToConsume,
        diagnostic: isProduction() ? undefined : PointSystem.getDebugInfo()
      }, { status: 403 });
    }

    // Return updated points info from the Mongoose doc returned by consumePoints
    return NextResponse.json({
      points: updatedUserMongooseDoc.points,
      pointsUsedThisMonth: updatedUserMongooseDoc.pointsUsedThisMonth,
      pointsLastUpdated: updatedUserMongooseDoc.pointsLastUpdated,
      diagnostic: isProduction() ? undefined : {
        system_ok: diagnosticPassed,
        ...PointSystem.getDebugInfo()
      }
    });
  } catch (error) {
    safeError('Error consuming points:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while consuming points',
        inProduction: isProduction(),
        inAmplify: isAWSAmplify()
      },
      { status: 500 }
    );
  }
} 