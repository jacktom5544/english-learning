import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { connectToDB } from '@/lib/mongodb';
// @ts-ignore - Component exists but TypeScript can't find it
import CoachingContainer from './components/CoachingContainer';

export const metadata: Metadata = {
  title: 'コーチング | English Learning',
  description: '英語講師があなたの英語学習をサポートします。',
};

export default async function CoachingPage() {
  const session = await getServerSession(authOptions);
  
  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect('/login?callbackUrl=/coaching');
  }
  
  try {
    const mongodb = await connectToDB();
    const db = mongodb.connection.db;
    
    // Get user from database
    const user = await db.collection('users').findOne({ email: session.user.email });
    if (!user) {
      throw new Error('User not found');
    }
    
    // Get the most recent coaching sessions (limit to 10)
    const recentSessions = await db.collection('coachingSessions')
      .find({ userId: user._id })
      .sort({ lastUpdated: -1 })
      .limit(10)
      .project({ _id: 1, title: 1, teacher: 1, lastUpdated: 1, createdAt: 1 })
      .toArray();
    
    return (
      <main className="flex flex-col min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8 flex-grow">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">コーチング</h1>
          <CoachingContainer 
            user={JSON.parse(JSON.stringify(user))} 
            initialSessions={JSON.parse(JSON.stringify(recentSessions))} 
          />
        </div>
      </main>
    );
  } catch (error) {
    console.error('Error in Coaching page:', error);
    return (
      <main className="flex flex-col min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8 flex-grow">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">コーチング</h1>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-red-500">エラーが発生しました。再度お試しください。</p>
          </div>
        </div>
      </main>
    );
  }
} 