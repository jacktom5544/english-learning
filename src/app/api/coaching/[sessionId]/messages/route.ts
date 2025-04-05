import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { generateCoachingResponse } from '@/lib/coaching-ai';
import { JapaneseTeacherKey } from '@/lib/japanese-teachers';
import { POINT_CONSUMPTION } from '@/lib/pointSystem';

// POST: Add a new message to a coaching session
export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract and validate sessionId
    const sessionId = params.sessionId;
    if (!sessionId || !ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    // Parse request body
    const { content } = await req.json();
    if (!content || typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    const mongodb = await connectToDB();
    const db = mongodb.connection.db;

    // Get user from database
    const user = await db.collection('users').findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has enough points
    if (user.points < POINT_CONSUMPTION.COACHING_MESSAGE) {
      return NextResponse.json({ error: 'Not enough points' }, { status: 403 });
    }

    // Get the coaching session
    const coachingSession = await db.collection('coachingSessions').findOne({
      _id: new ObjectId(sessionId),
      userId: new ObjectId(user._id)
    });

    if (!coachingSession) {
      return NextResponse.json({ error: 'Coaching session not found' }, { status: 404 });
    }

    // Create timestamp for new messages
    const now = new Date();

    // Format the message (sanitize content)
    const sanitizedContent = content.trim();
    
    // Create user message
    const userMessage = {
      _id: new ObjectId(),
      sender: 'user',
      content: sanitizedContent,
      timestamp: now
    };

    // Add user message to the session
    await db.collection('coachingSessions').updateOne(
      { _id: new ObjectId(sessionId) },
      { 
        $push: { messages: userMessage },
        $set: { lastUpdated: now }
      }
    );

    // Generate teacher response
    const messageHistory = coachingSession.messages.map((msg: any) => ({
      sender: msg.sender,
      content: msg.content,
      timestamp: msg.timestamp
    }));

    // Add the new user message to history for context
    messageHistory.push({
      sender: 'user',
      content: sanitizedContent,
      timestamp: now
    });

    // Generate AI response asynchronously
    const teacherResponse = await generateCoachingResponse(
      coachingSession.teacher as JapaneseTeacherKey,
      sanitizedContent,
      user,
      messageHistory
    );

    // Create teacher message
    const teacherMessage = {
      _id: new ObjectId(),
      sender: 'teacher',
      content: teacherResponse,
      timestamp: new Date() // Use a new timestamp for the teacher's response
    };

    // Add teacher message to the session
    await db.collection('coachingSessions').updateOne(
      { _id: new ObjectId(sessionId) },
      { 
        $push: { messages: teacherMessage },
        $set: { lastUpdated: new Date() }
      }
    );

    // Consume points
    await db.collection('users').updateOne(
      { _id: new ObjectId(user._id) },
      { 
        $inc: { 
          points: -POINT_CONSUMPTION.COACHING_MESSAGE,
          pointsUsedThisMonth: POINT_CONSUMPTION.COACHING_MESSAGE
        }
      }
    );

    // Return both messages
    return NextResponse.json({
      userMessage,
      teacherMessage
    });
  } catch (error) {
    console.error('Error in POST /api/coaching/[sessionId]/messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 