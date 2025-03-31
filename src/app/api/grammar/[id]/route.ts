import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDB } from '@/lib/mongodb';
import Grammar from '@/models/Grammar';

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

    await connectToDB();
    
    const grammarEntry = await Grammar.findOne({
      _id: id,
      userId: session.user.id,
    });

    if (!grammarEntry) {
      return NextResponse.json({ error: 'Grammar entry not found' }, { status: 404 });
    }

    return NextResponse.json(grammarEntry);
  } catch (error) {
    console.error('Error fetching grammar entry:', error);
    return NextResponse.json({ error: 'Failed to fetch grammar entry' }, { status: 500 });
  }
} 