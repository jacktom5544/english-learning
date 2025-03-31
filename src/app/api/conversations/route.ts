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

    // Create a timeout for the entire AI generation process
    const AI_TIMEOUT = 8000; // 8 seconds
    
    // Generate initial greeting with timeout handling
    let greeting: string;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI timeout')), AI_TIMEOUT);
      });
      
      const greetingPromise = generateTeacherGreeting(teacher, user);
      const result = await Promise.race([greetingPromise, timeoutPromise]);
      greeting = result as string;
    } catch (error) {
      console.error('Error or timeout generating greeting:', error);
      // Fallback greeting
      greeting = teacher === 'michael'
        ? `Hello ${user.name}! I'm Michael, your English teacher from New York. How are you doing today? Is there anything specific you'd like to practice?`
        : `Hi ${user.name}! I'm Emily from Los Angeles! I'm super excited to be your English teacher! How's your day going? Is there something specific you want to talk about today?`;
    }
    
    // Create initial message with greeting (fallback or generated)
    const initialMessage = {
      sender: 'teacher' as const,
      content: greeting,
      timestamp: new Date(),
    };

    // Generate title with timeout handling
    let title: string;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI timeout')), AI_TIMEOUT);
      });
      
      const titlePromise = generateConversationTitle(teacher, initialMessage.content);
      const result = await Promise.race([titlePromise, timeoutPromise]);
      title = result as string;
    } catch (error) {
      console.error('Error or timeout generating title:', error);
      // Fallback title
      title = `Conversation with ${teacher === 'michael' ? 'Michael' : 'Emily'} - ${new Date().toLocaleDateString()}`;
    }

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