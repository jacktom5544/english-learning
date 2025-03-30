import { NextResponse } from 'next/server';
import { getCurrentUserWithPoints } from '@/lib/serverUtils';
import { connectToDatabase } from '@/lib/db';

export async function GET() {
  try {
    await connectToDatabase();
    
    const user = await getCurrentUserWithPoints();
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      points: user.points,
      pointsUsedThisMonth: user.pointsUsedThisMonth,
      pointsLastUpdated: user.pointsLastUpdated
    });
  } catch (error) {
    console.error('Error fetching user points:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user points' },
      { status: 500 }
    );
  }
} 