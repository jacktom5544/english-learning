import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { getToken } from 'next-auth/jwt';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }
    
    // Get the current token
    const token = await getToken({ req });
    
    // Connect to database
    await connectToDatabase();
    
    // Find the user
    const user = await User.findOne({ email });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Get current role
    const role = user.role;
    
    // Check if role is already admin
    if (role === 'admin') {
      return NextResponse.json({
        message: 'User already has admin role',
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          tokenRole: token?.role || 'No token role',
        }
      });
    }
    
    // Set role to admin
    user.role = 'admin';
    await user.save();
    
    return NextResponse.json({
      message: 'User role updated to admin',
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        previousRole: role,
        tokenRole: token?.role || 'No token role',
      },
      note: 'You need to log out and log back in for the changes to take effect'
    });
  } catch (error) {
    console.error('Error fixing admin role:', error);
    return NextResponse.json(
      { error: 'Failed to fix admin role' },
      { status: 500 }
    );
  }
} 