import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { INITIAL_POINTS } from '@/lib/pointSystem';

/**
 * API endpoint to update points for a specific user
 * This is for debugging purposes only
 */
export async function POST(req: NextRequest) {
  try {
    // Parse request
    const { email, points } = await req.json();
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }
    
    // Use specified points or default to INITIAL_POINTS
    const pointsToSet = points !== undefined ? Number(points) : INITIAL_POINTS;
    
    // Connect to database
    console.log("Connecting to database...");
    await connectToDatabase();
    console.log("Connected to database");
    
    // Find user
    console.log(`Finding user with email: ${email}`);
    const user = await User.findOne({ email });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    console.log(`Found user: ${user.name}, current points: ${user.points}`);
    
    // Update user points
    user.points = pointsToSet;
    user.pointsLastUpdated = new Date();
    
    await user.save();
    
    console.log(`Updated user points: ${user.points}`);
    
    // Return updated user
    return NextResponse.json({
      message: 'User points updated successfully',
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        points: user.points,
        pointsLastUpdated: user.pointsLastUpdated,
        pointsUsedThisMonth: user.pointsUsedThisMonth,
      }
    });
  } catch (error) {
    console.error('Error updating user points:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating user points' },
      { status: 500 }
    );
  }
} 