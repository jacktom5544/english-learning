import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';

/**
 * API endpoint to check user points in the database
 * This is for debugging purposes only
 */
export async function GET(req: NextRequest) {
  try {
    // Connect to database
    console.log("Connecting to database...");
    await connectToDatabase();
    console.log("Connected to database");
    
    // Get all users
    console.log("Fetching users...");
    const users = await User.find({}).select('email name points pointsLastUpdated pointsUsedThisMonth role');
    console.log(`Found ${users.length} users`);
    
    // Check user points
    const usersWithoutPoints = users.filter(user => !user.points && user.points !== 0);
    const usersWithZeroPoints = users.filter(user => user.points === 0);
    const usersWithPoints = users.filter(user => user.points > 0);
    
    console.log(`Users without points: ${usersWithoutPoints.length}`);
    console.log(`Users with zero points: ${usersWithZeroPoints.length}`);
    console.log(`Users with points: ${usersWithPoints.length}`);
    
    // Return user points information
    return NextResponse.json({
      totalUsers: users.length,
      usersWithoutPoints: usersWithoutPoints.length,
      usersWithZeroPoints: usersWithZeroPoints.length,
      usersWithPoints: usersWithPoints.length,
      users: users.map(user => ({
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        points: user.points,
        pointsLastUpdated: user.pointsLastUpdated,
        pointsUsedThisMonth: user.pointsUsedThisMonth,
      }))
    });
  } catch (error) {
    console.error('Error checking user points:', error);
    return NextResponse.json(
      { error: 'An error occurred while checking user points' },
      { status: 500 }
    );
  }
} 