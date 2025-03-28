import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import Conversation from '@/models/Conversation';
import User from '@/models/User';
import { generateTeacherGreeting, generateConversationTitle } from '@/lib/conversation-ai';

// MongoDB connection utility
async function connectToDB() {
  const MONGODB_URI = process.env.MONGODB_URI!;

  if (!MONGODB_URI) {
    throw new Error(
      'Please define the MONGODB_URI environment variable inside .env.local'
    );
  }

  // Global is used here to maintain a cached connection across hot reloads
  let cached = global as any;
  cached.mongoose = cached.mongoose || { conn: null, promise: null };

  if (cached.mongoose.conn) {
    return cached.mongoose.conn;
  }

  if (!cached.mongoose.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.mongoose.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }
  cached.mongoose.conn = await cached.mongoose.promise;
  return cached.mongoose.conn;
}

// GET /api/conversations - Get all conversations for the current user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    await connectToDB();

    // Find user by email
    const userEmail = session.user.email as string;
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all conversations for this user
    const conversations = await Conversation.find({ userId: user._id })
      .sort({ lastUpdated: -1 })
      .lean();

    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/conversations - Create a new conversation
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { teacher } = await req.json();

    if (!teacher || !['michael', 'emily'].includes(teacher)) {
      return NextResponse.json({ error: 'Valid teacher selection required' }, { status: 400 });
    }

    await connectToDB();

    // Find user by email
    const userEmail = session.user.email as string;
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate initial greeting using AI
    const greeting = await generateTeacherGreeting(teacher, user);
    
    // Create initial message with AI-generated greeting
    const initialMessage = {
      sender: 'teacher' as const,
      content: greeting,
      timestamp: new Date(),
    };

    // Generate title for the conversation using AI
    const title = await generateConversationTitle(teacher, initialMessage.content);

    // Create new conversation
    const newConversation = await Conversation.create({
      userId: user._id,
      teacher,
      title,
      messages: [initialMessage],
    });

    return NextResponse.json(newConversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 