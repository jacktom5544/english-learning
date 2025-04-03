import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
// import mongoose from 'mongoose'; // Keep if Conversation model methods needed by AI? Unlikely. Remove.
// import Conversation from '@/models/Conversation'; // Remove unless needed by AI funcs
// import User from '@/models/User'; // Remove unless needed by AI funcs
import {
  generateTeacherResponse,
  hasGrammarErrors,
  correctGrammar
} from '@/lib/conversation-ai';
import { consumePoints } from '@/lib/serverUtils';
import { POINT_CONSUMPTION } from '@/lib/pointSystem';
import getClient from '@/lib/db'; // Use default export
import { ObjectId } from 'mongodb'; // Import ObjectId
import { authOptions } from '@/lib/auth'; // Import authOptions

// Define interfaces for message structure (optional but good practice)
interface Message {
    _id: ObjectId | string; // Allow string for response
    sender: 'user' | 'teacher';
    content: string;
    correctedContent?: string;
    timestamp: Date;
}

// POST /api/conversations/[conversationId]/messages
export async function POST(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    // Explicitly pass authOptions
    const session = await getServerSession(authOptions); 

    // 1. Auth and User ID Validation
    if (!session?.user?.id) {
      console.error('POST messages: Authentication required - No user ID');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id;
    if (!ObjectId.isValid(userId)) {
      console.error(`POST messages: Invalid user ID format: ${userId}`);
      return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
    }
    const userObjectId = new ObjectId(userId);

    // 2. Conversation ID Validation
    const { conversationId } = params;
    if (!ObjectId.isValid(conversationId)) {
       console.error(`POST messages: Invalid conversation ID format: ${conversationId}`);
      return NextResponse.json({ error: 'Invalid conversation ID format' }, { status: 400 });
    }
    const conversationObjectId = new ObjectId(conversationId);

    // 2.5 Parse Request Body
    const { content, grammarCorrection, skipPointsConsumption } = await req.json();
    if (!content || typeof content !== 'string') {
       console.error(`POST messages: Invalid content received`);
      return NextResponse.json({ error: 'Valid message content required' }, { status: 400 });
    }

    // 3. Get DB connection
    const { db } = await getClient();
    const usersCollection = db.collection('users');
    const conversationsCollection = db.collection('conversations'); // Assumes collection name

    // 4. Fetch User (Native) - Needed for AI context potentially
    const userDoc = await usersCollection.findOne({ _id: userObjectId });
    if (!userDoc) {
        console.error(`POST messages: User not found for ID ${userId}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 5. Consume Points (uses mongoose-utils for read, Mongoose for write)
    let updatedUserMongooseDoc = null; // Represents the Mongoose doc returned by consumePoints if called
    let remainingPoints: number | undefined = undefined;

    if (!skipPointsConsumption) {
      updatedUserMongooseDoc = await consumePoints(userId, POINT_CONSUMPTION.CONVERSATION_CHAT);
      if (!updatedUserMongooseDoc) {
         console.log(`POST messages: Not enough points for user ${userId}`);
        return NextResponse.json({
          error: 'Not enough points',
          currentPoints: userDoc.points || 0, // Use points from initially fetched doc for message
          requiredPoints: POINT_CONSUMPTION.CONVERSATION_CHAT
        }, { status: 403 });
      }
      remainingPoints = updatedUserMongooseDoc.points; // Store remaining points from the Mongoose doc
    } else {
        // If points are skipped, use points from the initially fetched userDoc
        remainingPoints = userDoc.points;
    }

    // Determine which user object to pass to AI (prefer plain object)
    const userObjectForAI = updatedUserMongooseDoc ? updatedUserMongooseDoc.toObject() : userDoc;

    // 6. Fetch Conversation (Native) & Verify Ownership
    const conversationDoc = await conversationsCollection.findOne({ _id: conversationObjectId });
    if (!conversationDoc) {
       console.error(`POST messages: Conversation not found for ID ${conversationId}`);
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    // Important: Compare ObjectIds directly if possible, otherwise strings
    if (!conversationDoc.userId.equals(userObjectId)) { // Use .equals() for ObjectId comparison
        console.error(`POST messages: Unauthorized access attempt by user ${userId} on conversation ${conversationId}`);
      return NextResponse.json({ error: 'Unauthorized access to conversation' }, { status: 403 });
    }

    // 7. Generate User Message (with optional correction)
    const userMessage: Message = {
      _id: new ObjectId(), // Generate ID upfront
      sender: 'user',
      content: content,
      timestamp: new Date(),
    };
    if (grammarCorrection) {
      try {
          const hasErrors = await hasGrammarErrors(content);
          if (hasErrors) {
            userMessage.correctedContent = await correctGrammar(content);
          }
      } catch (aiError) {
          console.error("AI grammar check/correction failed:", aiError);
          // Proceed without correction if AI fails
      }
    }

    // 8. Generate Teacher Response (passing plain objects)
    let aiResponse: string;
     try {
         aiResponse = await generateTeacherResponse(
           conversationDoc.teacher,
           content, // User's new message content
           userObjectForAI, // Plain user object
           conversationDoc.messages // Existing message history
         );
     } catch (aiError) {
         console.error("AI teacher response generation failed:", aiError);
         aiResponse = "Sorry, I encountered an error trying to respond. Could you try rephrasing?"; // Fallback response
     }

    const teacherMessage: Message = {
      _id: new ObjectId(), // Generate ID upfront
      sender: 'teacher',
      content: aiResponse,
      timestamp: new Date(),
    };

    // 9. Update Conversation (Native $push)
    const updateResult = await conversationsCollection.updateOne(
      { _id: conversationObjectId },
      {
        $push: {
          messages: { $each: [userMessage, teacherMessage] }
        },
        $set: {
          lastUpdated: new Date() // Keep conversation fresh
        }
      }
    );

    if (updateResult.matchedCount === 0) {
       console.error(`POST messages: Failed to find conversation ${conversationId} during final update`);
       // This indicates a serious inconsistency, maybe the conversation was deleted between find and update
       return NextResponse.json({ error: 'Conversation update failed unexpectedly' }, { status: 500 });
    }
     if (updateResult.modifiedCount === 0) {
        // This might happen if e.g. the $push operator fails for some reason
        console.error(`POST messages: Failed to push messages to conversation ${conversationId}`);
        return NextResponse.json({ error: 'Failed to save messages' }, { status: 500 });
     }

    // 10. Return the newly added messages
    // Format IDs to strings for the response body
    const userMessageResponse = { ...userMessage, _id: userMessage._id.toString() };
    const teacherMessageResponse = { ...teacherMessage, _id: teacherMessage._id.toString() };

    return NextResponse.json({
        userMessage: userMessageResponse,
        teacherMessage: teacherMessageResponse,
        remainingPoints: remainingPoints // Include remaining points
     });

  } catch (error) {
    console.error('Error adding message:', error);
    // Handle specific errors like timeouts
    if (error instanceof Error && error.name === 'MongoTimeoutError') {
         return NextResponse.json({ error: 'Database operation timed out' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Internal Server Error adding message' }, { status: 500 });
  }
} 