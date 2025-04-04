import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import bcrypt from 'bcrypt';
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

    // Connect to database using native MongoDB driver
    const { client, db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に登録されています' },
        { status: 409 }
      );
    }

    // Hash password manually (since we don't have Mongoose middleware)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user document
    const now = new Date();
    const newUser = {
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      image: '',
      englishLevel: 'beginner',
      job: '',
      goal: '',
      startReason: '',
      struggles: '',
      preferredTeacher: 'taro',
      role: 'user',
      points: INITIAL_POINTS,
      pointsLastUpdated: now,
      pointsUsedThisMonth: 0,
      subscriptionStatus: 'inactive',
      createdAt: now,
      updatedAt: now
    };
    
    // Save the user to the database
    try {
      const result = await usersCollection.insertOne(newUser);
      
      if (!result.acknowledged || !result.insertedId) {
        throw new Error('Failed to insert user');
      }
      
      console.log('User created:', {
        userId: result.insertedId.toString(),
        email,
        name
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
          email,
          name
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