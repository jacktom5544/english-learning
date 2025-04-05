import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { generateInitialCoachingMessage, generateCoachingSessionTitle } from '@/lib/coaching-ai';
import { JapaneseTeacherKey } from '@/lib/japanese-teachers';
import { ICoachingSession } from '@/models/Coaching';
import { POINT_CONSUMPTION } from '@/lib/pointSystem';

// GET: Get all coaching sessions for authenticated user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mongodb = await connectToDB();
    const db = mongodb.connection.db;
    
    // Get user from database using native MongoDB driver
    const user = await db.collection('users').findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all coaching sessions for the user
    const coachingSessions = await db.collection('coachingSessions').find(
      { userId: new ObjectId(user._id) },
      { 
        projection: { 
          _id: 1, 
          teacher: 1, 
          title: 1, 
          lastUpdated: 1, 
          createdAt: 1 
        },
        sort: { lastUpdated: -1 }
      }
    ).toArray();

    return NextResponse.json(coachingSessions);
  } catch (error) {
    console.error('Error in GET /api/coaching:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create a new coaching session
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mongodb = await connectToDB();
    const db = mongodb.connection.db;

    // Get user from database using native MongoDB driver
    const user = await db.collection('users').findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has enough points
    if (user.points < POINT_CONSUMPTION.COACHING_SESSION) {
      return NextResponse.json(
        { error: 'Not enough points' },
        { status: 403 }
      );
    }

    // Use the preferred teacher or default to 'taro'
    const teacher = (user.preferredTeacher || 'taro') as JapaneseTeacherKey;

    // Generate initial message from teacher
    const initialMessage = await generateInitialCoachingMessage(teacher, user);
    
    // Generate session title
    const title = await generateCoachingSessionTitle(teacher, initialMessage);

    // Create timestamp for messages
    const now = new Date();

    // Create new coaching session document
    const newCoachingSession: ICoachingSession = {
      userId: new ObjectId(user._id),
      teacher: teacher,
      title: title,
      messages: [
        {
          sender: 'teacher',
          content: initialMessage,
          timestamp: now
        }
      ],
      lastUpdated: now,
      createdAt: now
    };

    // Insert the new coaching session
    const result = await db.collection('coachingSessions').insertOne(newCoachingSession);

    // Consume points - update user points directly using MongoDB
    await db.collection('users').updateOne(
      { _id: new ObjectId(user._id) },
      { 
        $inc: { 
          points: -POINT_CONSUMPTION.COACHING_SESSION,
          pointsUsedThisMonth: POINT_CONSUMPTION.COACHING_SESSION
        }
      }
    );

    // Get the complete coaching session with the new ID
    const insertedSession = await db.collection('coachingSessions').findOne(
      { _id: result.insertedId }
    );

    return NextResponse.json(insertedSession);
  } catch (error) {
    console.error('Error in POST /api/coaching:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 