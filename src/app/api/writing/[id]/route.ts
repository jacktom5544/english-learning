import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import getClient from '@/lib/db';
import { ObjectId, WithId, Db } from 'mongodb';

// Writing status type
type WritingStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Document type
type WritingDoc = WithId<{ 
    userId: ObjectId;
    topic: string;
    content: string;
    feedback: string | null;
    status: WritingStatus;
    preferredTeacher: string;
    createdAt: Date;
    updatedAt: Date; 
}>;

/**
 * GET handler for retrieving a specific writing entry
 * Used for polling the status of a writing entry
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // Authenticate user
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
        }
        
        const userId = new ObjectId(session.user.id);
        const writingId = params.id;
        
        if (!writingId) {
            return NextResponse.json({ error: 'Writing ID is required' }, { status: 400 });
        }
        
        // Convert string ID to ObjectId
        let objectId: ObjectId;
        try {
            objectId = new ObjectId(writingId);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid Writing ID format' }, { status: 400 });
        }
        
        // Connect to database
        const { db: _db } = await getClient();
        const db = _db as Db;
        const writingsCollection = db.collection<WritingDoc>('writings');
        
        // Find the writing entry
        const writingEntry = await writingsCollection.findOne({ _id: objectId });
        
        if (!writingEntry) {
            return NextResponse.json({ error: 'Writing entry not found' }, { status: 404 });
        }
        
        // Security check: Ensure the entry belongs to the logged-in user
        if (!writingEntry.userId.equals(userId)) {
            console.warn(`User ${userId} attempted to access writing entry ${writingId} belonging to ${writingEntry.userId}`);
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        
        // Return the entry with stringified IDs
        return NextResponse.json({
            ...writingEntry,
            _id: writingEntry._id.toString(),
            userId: writingEntry.userId.toString()
        });
        
    } catch (error) {
        console.error(`Error retrieving writing entry ${params.id}:`, error);
        
        let errorMessage = 'エントリの取得中にエラーが発生しました';
        if (error instanceof Error) errorMessage = error.message;
        
        if (error instanceof Error && error.name === 'MongoTimeoutError') {
            errorMessage = 'Database operation timed out retrieving writing entry';
            return NextResponse.json({ error: errorMessage }, { status: 504 });
        }
        
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
} 