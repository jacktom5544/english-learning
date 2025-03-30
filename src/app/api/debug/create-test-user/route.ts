import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { INITIAL_POINTS } from '@/lib/pointSystem';
import bcrypt from 'bcrypt';

/**
 * API endpoint to create a test user with points
 * This is for debugging purposes only
 */
export async function POST(req: NextRequest) {
  try {
    // Parse request
    const { email, password, name } = await req.json();
    
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password and name are required' },
        { status: 400 }
      );
    }
    
    // Connect to database
    console.log("Connecting to database...");
    await connectToDatabase();
    console.log("Connected to database");
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user directly with mongoose (bypassing model methods)
    const userData = {
      email,
      password: hashedPassword,
      name,
      role: 'free',
      points: INITIAL_POINTS,
      pointsLastUpdated: new Date(),
      pointsUsedThisMonth: 0,
      englishLevel: 'beginner',
    };
    
    console.log("Creating test user with data:", { ...userData, password: '[HIDDEN]' });
    
    const testUser = new User(userData);
    const savedUser = await testUser.save();
    
    console.log("Test user created:", {
      id: savedUser._id.toString(),
      email: savedUser.email,
      name: savedUser.name,
      points: savedUser.points,
    });
    
    // Double check the user was created with points
    const verifyUser = await User.findById(savedUser._id);
    
    console.log("Verified user:", {
      id: verifyUser?._id.toString(),
      email: verifyUser?.email,
      points: verifyUser?.points,
      hasPoints: verifyUser?.points === INITIAL_POINTS
    });
    
    return NextResponse.json({
      message: 'Test user created successfully',
      user: {
        id: savedUser._id.toString(),
        email: savedUser.email,
        name: savedUser.name,
        points: savedUser.points
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating test user:', error);
    return NextResponse.json(
      { error: 'An error occurred while creating test user' },
      { status: 500 }
    );
  }
} 