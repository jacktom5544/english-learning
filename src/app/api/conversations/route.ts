import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
// import mongoose from 'mongoose'; // Keep if Conversation.create is used
import Conversation from '@/models/Conversation'; // Keep for Conversation.create
// import User from '@/models/User'; // Can likely remove/comment out
import { generateTeacherGreeting, generateConversationTitle } from '@/lib/conversation-ai';
import { consumePoints } from '@/lib/serverUtils';
import { POINT_CONSUMPTION } from '@/lib/pointSystem';
import getClient from '@/lib/db'; // Use default export
import { ObjectId } from 'mongodb'; // Import ObjectId

// GET /api/conversations - Get all conversations for the current user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(); // Assuming using default authOptions implicitly
    
    // Check for user ID in session
    if (!session?.user?.id) { 
      console.error('GET /api/conversations: Authentication required - No user ID in session');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const userId = session.user.id;

    // Validate ObjectId
    if (!ObjectId.isValid(userId)) {
        console.error(`GET /api/conversations: Invalid user ID format in session: ${userId}`);
        return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
    }

    // Use getClient to get db connection
    const { db } = await getClient(); 

    // Find user by ID using native driver (like profile page)
    const usersCollection = db.collection('users');
    const userDoc = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!userDoc) {
      console.error(`GET /api/conversations: User not found for ID ${userId}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all conversations for this user using native driver
    const conversationsCollection = db.collection('conversations'); // Assumes collection name 'conversations'
    const conversations = await conversationsCollection
      .find({ userId: userDoc._id }) // Use the ObjectId directly from userDoc
      .sort({ lastUpdated: -1 })
      .toArray(); // Use toArray() instead of lean()

    // Convert ObjectId fields to strings if frontend expects them
    const formattedConversations = conversations.map(conv => ({
      ...conv,
      _id: conv._id.toString(),
      userId: conv.userId.toString(), // Assuming userId is stored as ObjectId
       // Format message IDs if they are ObjectIds and frontend expects strings
       messages: conv.messages.map((msg: any) => ({
           ...msg,
           // Ensure _id exists and convert if it does
           _id: msg._id ? msg._id.toString() : undefined 
       }))
    }));

    return NextResponse.json(formattedConversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    // Consider more specific error messages if possible
    if (error instanceof Error && error.name === 'MongoTimeoutError') {
         return NextResponse.json({ error: 'Database operation timed out' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Internal Server Error fetching conversations' }, { status: 500 });
  }
}

// POST /api/conversations - Create a new conversation
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(); // Assuming using default authOptions implicitly
    
    // Check for user ID in session
    if (!session?.user?.id) { 
      console.error('POST /api/conversations: Authentication required - No user ID in session');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = session.user.id;

    // Validate ObjectId
     if (!ObjectId.isValid(userId)) {
        console.error(`POST /api/conversations: Invalid user ID format in session: ${userId}`);
        return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
    }

    const { teacher } = await req.json();

    const validTeachers = ['michael', 'emily', 'hiroshi', 'reiko', 'iwao', 'taro']; 
    if (!teacher || !validTeachers.includes(teacher)) {
      console.error(`POST /api/conversations: Invalid teacher specified: ${teacher}`);
      return NextResponse.json({ error: 'Valid teacher selection required' }, { status: 400 });
    }

    // Use getClient to get db connection
    const { db } = await getClient(); 

    // Find user by ID using native driver (like profile page)
    const usersCollection = db.collection('users');
    const userDoc = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!userDoc) {
       console.error(`POST /api/conversations: User not found for ID ${userId}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check and consume points for starting a new conversation
    // consumePoints expects string ID, uses native read (via mongoose-utils) and returns Mongoose doc
    const updatedUserMongooseDoc = await consumePoints(userId, POINT_CONSUMPTION.CONVERSATION_CHAT); 
    
    if (!updatedUserMongooseDoc) {
       console.log(`POST /api/conversations: Not enough points for user ${userId}`);
      return NextResponse.json({ 
        error: 'Not enough points', 
        currentPoints: userDoc.points || 0, // Use points from initially fetched doc for message
        requiredPoints: POINT_CONSUMPTION.CONVERSATION_CHAT 
      }, { status: 403 });
    }

    // Use the updated Mongoose document for AI generation
    const userNameForGreeting = updatedUserMongooseDoc.name || 'there';

    // Create a timeout for the entire AI generation process
    const AI_TIMEOUT = 8000; // 8 seconds
    
    // Generate initial greeting with timeout handling
    let greeting: string;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI timeout')), AI_TIMEOUT);
      });
      
      const greetingPromise = generateTeacherGreeting(teacher, updatedUserMongooseDoc);
      const result = await Promise.race([greetingPromise, timeoutPromise]);
      greeting = result as string;
    } catch (error) {
      console.error('Error or timeout generating greeting:', error);
      greeting = `Hello ${userNameForGreeting}! I'm your teacher ${teacher}. How can I help you today?`; 
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
      title = `Chat with ${teacher} - ${new Date().toLocaleDateString()}`; 
    }

    // Create new conversation using Mongoose (write operation) - Changed from create to new/save
    const newConversationDoc = new Conversation({
      userId: updatedUserMongooseDoc._id, // Use the ObjectId from the Mongoose doc
      teacher,
      title,
      messages: [initialMessage],
      lastUpdated: new Date(),
    });
    await newConversationDoc.save();
    const newConversation = newConversationDoc; // Use the saved document instance

    // Convert to plain object and format IDs for response consistency
    const responseData = newConversation.toObject();
    responseData._id = responseData._id.toString();
    responseData.userId = responseData.userId.toString();
    responseData.messages = responseData.messages.map((msg: any) => ({
        ...msg,
        _id: msg._id ? msg._id.toString() : undefined
    }));

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error creating conversation:', error);
     // Consider more specific error messages if possible
    if (error instanceof Error && error.name === 'MongoTimeoutError') {
         return NextResponse.json({ error: 'Database operation timed out' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Internal Server Error creating conversation' }, { status: 500 });
  }
} 