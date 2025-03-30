import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import Conversation from '@/models/Conversation';
import User from '@/models/User';
import { generateTeacherGreeting, generateConversationTitle } from '@/lib/conversation-ai';
import { consumePoints } from '@/lib/serverUtils';
import { POINT_CONSUMPTION } from '@/lib/pointSystem';
import { connectToDatabase } from '@/lib/db';

// GET /api/conversations - Get all conversations for the current user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    await connectToDatabase();

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

    await connectToDatabase();

    // Find user by email
    const userEmail = session.user.email as string;
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check and consume points for starting a new conversation
    const updatedUser = await consumePoints(user._id, POINT_CONSUMPTION.CONVERSATION_CHAT);
    
    if (!updatedUser) {
      return NextResponse.json({ 
        error: 'Not enough points', 
        currentPoints: user.points || 0,
        requiredPoints: POINT_CONSUMPTION.CONVERSATION_CHAT 
      }, { status: 403 });
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