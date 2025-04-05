import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET: Get a specific coaching session
export async function GET(
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

    const mongodb = await connectToDB();
    const db = mongodb.connection.db;

    // Get user from database
    const user = await db.collection('users').findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the coaching session
    const coachingSession = await db.collection('coachingSessions').findOne({
      _id: new ObjectId(sessionId),
      userId: new ObjectId(user._id)
    });

    if (!coachingSession) {
      return NextResponse.json({ error: 'Coaching session not found' }, { status: 404 });
    }

    return NextResponse.json(coachingSession);
  } catch (error) {
    console.error('Error in GET /api/coaching/[sessionId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a coaching session
export async function DELETE(
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

    const mongodb = await connectToDB();
    const db = mongodb.connection.db;

    // Get user from database
    const user = await db.collection('users').findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete the coaching session
    const result = await db.collection('coachingSessions').deleteOne({
      _id: new ObjectId(sessionId),
      userId: new ObjectId(user._id)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Coaching session not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/coaching/[sessionId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 