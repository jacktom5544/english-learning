import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { INITIAL_POINTS } from '@/lib/pointSystem';

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    // Validate input
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: '必須項目を入力してください' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に登録されています' },
        { status: 409 }
      );
    }

    // Create new user
    const user = new User({
      email,
      password,
      name,
      role: 'free', // Default role is free
      points: INITIAL_POINTS, // Set initial points explicitly
      pointsLastUpdated: new Date(),
      pointsUsedThisMonth: 0,
    });

    // Explicitly set points before saving to ensure it's set
    user.set('points', INITIAL_POINTS);
    
    // Save the user to the database
    try {
      await user.save();
      
      // Verify the user was saved with points
      const savedUser = await User.findOne({ email });
      console.log('User created with points (verification):', {
        userId: savedUser?._id.toString(),
        points: savedUser?.points,
        initial: INITIAL_POINTS,
        userHasPoints: savedUser?.points === INITIAL_POINTS
      });
      
      if (!savedUser || savedUser.points !== INITIAL_POINTS) {
        console.error('Points verification failed. User was not saved with correct points!');
      }
    } catch (saveError) {
      console.error('Error saving user:', saveError);
      return NextResponse.json(
        { error: 'ユーザー登録中にエラーが発生しました' },
        { status: 500 }
      );
    }

    // Return success but not the entire user object (for security)
    return NextResponse.json(
      { 
        message: 'ユーザーが正常に登録されました',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        } 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: '登録中にエラーが発生しました' },
      { status: 500 }
    );
  }
} 