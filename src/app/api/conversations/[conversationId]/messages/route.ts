import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import Conversation from '@/models/Conversation';
import User from '@/models/User';
import { 
  generateTeacherResponse, 
  hasGrammarErrors, 
  correctGrammar 
} from '@/lib/conversation-ai';

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

// POST /api/conversations/[conversationId]/messages
export async function POST(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const session = await getServerSession();
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { content, grammarCorrection } = await req.json();
    
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Valid message content required' }, { status: 400 });
    }

    await connectToDB();

    // Find user by email
    const userEmail = session.user.email as string;
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Extract the conversation ID as a string
    const { conversationId } = params;

    // Find conversation and verify ownership
    const conversation = await Conversation.findById(conversationId);
    
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conversation.userId.toString() !== user._id.toString()) {
      return NextResponse.json({ error: 'Unauthorized access to conversation' }, { status: 403 });
    }

    // Add user message
    const userMessage: {
      sender: 'user';
      content: string;
      correctedContent?: string;
      timestamp: Date;
    } = {
      sender: 'user',
      content: content,
      timestamp: new Date(),
    };

    // If grammar correction is enabled, check and correct
    if (grammarCorrection) {
      const hasErrors = await hasGrammarErrors(content);
      if (hasErrors) {
        userMessage.correctedContent = await correctGrammar(content);
      }
    }

    conversation.messages.push(userMessage);
    
    // Generate teacher response using AI
    const aiResponse = await generateTeacherResponse(
      conversation.teacher, 
      content, 
      user, 
      conversation.messages
    );
    
    const teacherMessage = {
      sender: 'teacher',
      content: aiResponse,
      timestamp: new Date(),
    };

    conversation.messages.push(teacherMessage);
    await conversation.save();

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Error adding message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 