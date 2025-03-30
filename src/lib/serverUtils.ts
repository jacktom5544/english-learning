'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import User from '@/models/User';
import { connectToDatabase } from '@/lib/db';
import { IUser } from '@/models/User';
import { MONTHLY_POINTS, MAX_POINTS } from './pointSystem';

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
  // Ensure database connection
  await connectToDatabase();
  
  const user = await User.findById(userId);
  
  if (!user) return null;
  
  // If the action is free (costs 0 points), just return the user without any point deduction
  if (pointsToConsume === 0) {
    return user;
  }
  
  // Check if user has enough points
  if (user.points < pointsToConsume) {
    return null;
  }
  
  // Update user points
  user.points -= pointsToConsume;
  user.pointsUsedThisMonth += pointsToConsume;
  
  // Save the updated user
  await user.save();
  return user;
}

/**
 * Gets the current user from the session and updates monthly points if needed
 * @returns Current user with updated points or null if not logged in
 */
export async function getCurrentUserWithPoints(): Promise<IUser | null> {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) return null;
  
  const user = await User.findOne({ email: session.user.email });
  
  if (!user) return null;
  
  // Check if points need to be updated
  await updateMonthlyPoints(user);
  
  return user;
} 