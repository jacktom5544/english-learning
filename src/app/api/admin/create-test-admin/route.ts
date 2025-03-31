import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { INITIAL_POINTS } from '@/lib/pointSystem';

export async function POST(req: NextRequest) {
  try {
    const password = 'Admin123!'; // Simple password for testing
    
    // Connect to database
    await connectToDatabase();

    // Create admin user with fixed credentials
    const adminUser = new User({
      email: 'kei-admin@example.com',
      password: password,
      name: 'Kei Admin',
      role: 'admin',
      englishLevel: 'advanced',
      points: INITIAL_POINTS,
      pointsLastUpdated: new Date(),
      pointsUsedThisMonth: 0,
      subscriptionStatus: 'active',
    });
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: adminUser.email });
    if (existingUser) {
      return NextResponse.json(
        { 
          message: 'Admin user already exists',
          user: {
            email: existingUser.email,
            password: password // Return the plain password for login
          }
        },
        { status: 200 }
      );
    }
    
    // Save the user to the database
    await adminUser.save();
    
    // Return success with credentials
    return NextResponse.json(
      { 
        message: 'Admin user created successfully',
        user: {
          email: adminUser.email,
          password: password // Return the plain password for login
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating admin user:', error);
    return NextResponse.json(
      { error: 'Failed to create admin user' },
      { status: 500 }
    );
  }
} 