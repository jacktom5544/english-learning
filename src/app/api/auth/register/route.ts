import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';

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
      role: 'user', // Default role is user
      points: 0, // No initial points - points will be added after subscription
      pointsLastUpdated: new Date(),
      pointsUsedThisMonth: 0,
      subscriptionStatus: 'inactive', // Default subscription status
    });
    
    // Save the user to the database
    try {
      await user.save();
      
      // Verify the user was saved correctly
      const savedUser = await User.findOne({ email });
      console.log('User created:', {
        userId: savedUser?._id.toString(),
        points: savedUser?.points,
        subscriptionStatus: savedUser?.subscriptionStatus
      });
      
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