import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { INITIAL_POINTS } from '@/lib/pointSystem';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * API endpoint that ensures all users have points set correctly
 * Only accessible to admin users
 */
export async function GET(req: NextRequest) {
  try {
    // Check if user is admin
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    // Connect to database
    await connectToDatabase();
    
    // Find users with no points or undefined points
    const usersToFix = await User.find({ 
      $or: [
        { points: { $exists: false } },
        { points: null },
        { points: 0 }
      ]
    });
    
    console.log(`Found ${usersToFix.length} users with missing points`);
    
    // Update users with missing points
    const updates = await Promise.all(
      usersToFix.map(async (user) => {
        user.points = INITIAL_POINTS;
        user.pointsLastUpdated = user.pointsLastUpdated || new Date();
        user.pointsUsedThisMonth = user.pointsUsedThisMonth || 0;
        await user.save();
        return { id: user._id.toString(), email: user.email };
      })
    );
    
    return NextResponse.json({
      message: `Fixed points for ${updates.length} users`,
      fixedUsers: updates
    });
  } catch (error) {
    console.error('Error fixing user points:', error);
    return NextResponse.json(
      { error: 'An error occurred while fixing user points' },
      { status: 500 }
    );
  }
} 