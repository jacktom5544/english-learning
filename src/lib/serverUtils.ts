'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import User from '@/models/User';
import { connectToDatabase } from '@/lib/db';
import { IUser } from '@/models/User';
import { MONTHLY_POINTS, MAX_POINTS, PointSystem } from './pointSystem';
import { isProduction, isAWSAmplify } from './env';
import { safeLog, safeError } from './utils';
import { findDocumentById, findOneDocument } from '@/models/mongoose-utils';

/**
 * Updates user points if 30 days have passed since the last update
 * @param user User document
 * @returns Updated user document or null if no update needed
 */
export async function updateMonthlyPoints(user: IUser): Promise<IUser | null> {
  const now = new Date();
  const lastUpdate = new Date(user.pointsLastUpdated);
  
  // Check if 30 days have passed since the last points update
  const daysDifference = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDifference >= 30) {
    // Reset used points counter
    user.pointsUsedThisMonth = 0;
    
    // Add monthly points, but don't exceed maximum
    const newPoints = Math.min(user.points + MONTHLY_POINTS, MAX_POINTS);
    user.points = newPoints;
    
    // Update the last updated timestamp
    user.pointsLastUpdated = now;
    
    // Save the updated user
    await user.save();
    return user;
  }
  
  return null;
}

/**
 * Consumes points for a user action
 * @param userId User ID
 * @param pointsToConsume Number of points to consume
 * @returns Updated user document or null if not enough points
 */
export async function consumePoints(userId: string, pointsToConsume: number): Promise<IUser | null> {
  try {
    // Ensure database connection
    await connectToDatabase();
    
    const user = await findDocumentById<IUser>(User, userId);
    
    if (!user) {
      safeError('User not found when consuming points', { userId });
      return null;
    }
    
    // Log point consumption attempt
    safeLog('Point consumption attempt', { 
      userId, 
      pointsToConsume, 
      currentPoints: user.points,
      isProduction: isProduction(),
      inAmplify: isAWSAmplify()
    });
    
    // If the action is free (costs 0 points), just return the user without any point deduction
    if (pointsToConsume === 0) {
      return user;
    }
    
    // *** REPLACE Existing safeLog for Checking hasEnoughPoints ***
    const userPoints = user.points;
    const isProd = isProduction();
    const check = userPoints >= pointsToConsume;
    console.log(`[INFO] Checking hasEnoughPoints: userId=${userId}, userPointsValue=${userPoints}, userPointsType=${typeof userPoints}, actionCostValue=${pointsToConsume}, actionCostType=${typeof pointsToConsume}, isProduction=${isProd}, checkResult=${check}`);

    // Use our enhanced PointSystem to check if user has enough points
    // In production, require actual points. In development/test, allow usage even without enough points
    if (!PointSystem.hasEnoughPoints(user.points, pointsToConsume)) {
      safeLog('Not enough points for action', { 
        userId, 
        pointsToConsume, 
        currentPoints: user.points 
      });
      return null;
    }
    
    // Update user points
    user.points -= pointsToConsume;
    user.pointsUsedThisMonth += pointsToConsume;
    
    // Save the updated user
    await user.save();
    
    safeLog('Points consumed successfully', { 
      userId, 
      pointsConsumed: pointsToConsume, 
      remainingPoints: user.points 
    });
    
    return user;
  } catch (error) {
    safeError('Error during point consumption', error);
    
    // If in development, allow the user to proceed anyway
    if (!isProduction()) {
      safeLog('Development mode: allowing action despite error');
      const user = await findDocumentById<IUser>(User, userId);
      return user;
    }
    
    return null;
  }
}

/**
 * Gets the current user from the session and updates monthly points if needed
 * @returns Current user with updated points or null if not logged in
 */
export async function getCurrentUserWithPoints(): Promise<IUser | null> {
  const startTime = Date.now();
  safeLog('[getCurrentUserWithPoints] Starting execution...');
  
  try {
    // First ensure database connection
    safeLog('[getCurrentUserWithPoints] Attempting DB connection...');
    await connectToDatabase();
    safeLog(`[getCurrentUserWithPoints] DB connected. Elapsed: ${Date.now() - startTime}ms`);
    
    // Get session
    safeLog('[getCurrentUserWithPoints] Attempting to get session...');
    const session = await getServerSession(authOptions);
    safeLog(`[getCurrentUserWithPoints] Session received. Elapsed: ${Date.now() - startTime}ms`);
    
    // Log session info for debugging
    safeLog('getCurrentUserWithPoints session check', {
      hasSession: !!session,
      userExists: !!session?.user,
      userEmail: session?.user?.email ? 'present' : 'missing',
      userRole: session?.user?.role || 'none',
      isAmplify: isAWSAmplify()
    });
    
    if (!session?.user?.email) {
      safeLog('getCurrentUserWithPoints: No valid session or email');
      return null;
    }
    
    // Find user in database by email
    safeLog(`[getCurrentUserWithPoints] Finding user by email: ${session.user.email}...`);
    let user = await findOneDocument<IUser>(User, { email: session.user.email });
    safeLog(`[getCurrentUserWithPoints] User lookup by email done. Found: ${!!user}. Elapsed: ${Date.now() - startTime}ms`);
    
    // If user not found by email, try by ID as fallback
    if (!user && session.user.id) {
      safeLog(`[getCurrentUserWithPoints] User not found by email, trying by ID: ${session.user.id}...`);
      try {
        user = await findDocumentById<IUser>(User, session.user.id);
        safeLog(`[getCurrentUserWithPoints] User lookup by ID done. Found: ${!!user}. Elapsed: ${Date.now() - startTime}ms`);
        
        // If found by ID but email doesn't match, update the email
        if (user && user.email !== session.user.email) {
          safeLog('User email mismatch, updating record', {
            oldEmail: user.email,
            newEmail: session.user.email
          });
          user.email = session.user.email;
          await user.save();
          safeLog(`[getCurrentUserWithPoints] User email updated. Elapsed: ${Date.now() - startTime}ms`);
        }
      } catch (error) {
        safeError('Error finding user by ID:', error);
      }
    }
    
    if (!user) {
      safeError('getCurrentUserWithPoints: User not found in database by email or ID', {
        email: session.user.email,
        sessionId: session.user.id
      });
      return null;
    }
    
    safeLog('getCurrentUserWithPoints: User found', {
      userId: user._id.toString(),
      points: user.points,
      role: user.role
    });
    
    // Check if points need to be updated - REMOVED for performance
    // safeLog(`[getCurrentUserWithPoints] Checking monthly points update for user ${user._id}...`);
    // await updateMonthlyPoints(user);
    // safeLog(`[getCurrentUserWithPoints] Monthly points check done. Elapsed: ${Date.now() - startTime}ms`);
    
    safeLog(`[getCurrentUserWithPoints] Completed successfully. Total time: ${Date.now() - startTime}ms`);
    return user;
  } catch (error) {
    safeError('Error in getCurrentUserWithPoints:', error);
    safeLog(`[getCurrentUserWithPoints] Failed with error. Total time: ${Date.now() - startTime}ms`);
    return null;
  }
} 