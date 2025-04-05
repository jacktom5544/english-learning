import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import getClient from '@/lib/db';
import { ObjectId, Db } from 'mongodb';
import { GrammarDoc } from '@/models/Grammar';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db: _db } = await getClient();
    const db = _db as Db;
    const grammarCollection = db.collection<GrammarDoc>('grammars');
    
    let objectId;
    try {
      objectId = new ObjectId(id);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }
    
    const grammarEntry = await grammarCollection.findOne({
      _id: objectId,
      userId: new ObjectId(session.user.id),
    });

    if (!grammarEntry) {
      return NextResponse.json({ error: 'Grammar entry not found' }, { status: 404 });
    }

    const serializedEntry = {
      ...grammarEntry,
      _id: grammarEntry._id?.toString(),
      userId: grammarEntry.userId.toString()
    };

    return NextResponse.json(serializedEntry);
  } catch (error) {
    console.error('Error fetching grammar entry:', error);
    return NextResponse.json({ error: 'Failed to fetch grammar entry' }, { status: 500 });
  }
} 