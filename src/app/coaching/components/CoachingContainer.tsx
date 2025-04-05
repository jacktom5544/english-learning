'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { ICoachingSession } from '@/models/Coaching';
import { IUser } from '@/models/User';
import { useUserPoints } from '@/components/providers/UserPointsProvider';
import CoachingList from './CoachingList';
import CoachingInterface from './CoachingInterface';
import { POINT_CONSUMPTION } from '@/lib/pointSystem';

interface CoachingContainerProps {
  user: IUser;
  initialSessions: Array<Partial<ICoachingSession>>;
}

export default function CoachingContainer({ user, initialSessions }: CoachingContainerProps) {
  const { data: session } = useSession();
  const { points, consumePoints } = useUserPoints();
  const [sessions, setSessions] = useState<Array<Partial<ICoachingSession>>>(initialSessions || []);
  const [currentSession, setCurrentSession] = useState<ICoachingSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch full coaching session when selected
  const fetchSession = async (sessionId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/coaching/${sessionId}`);
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      setCurrentSession(data);
    } catch (err) {
      console.error('Error fetching coaching session:', err);
      setError('セッションを読み込めませんでした。');
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new coaching session
  const createNewSession = async () => {
    if (!session?.user) return;
    
    // Check if user has enough points
    if (points < POINT_CONSUMPTION.COACHING_SESSION) {
      setError('ポイントが不足しています。');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Consume points
      const pointsConsumed = await consumePoints(POINT_CONSUMPTION.COACHING_SESSION);
      if (!pointsConsumed) {
        throw new Error('ポイントが不足しています。');
      }
      
      // Create new session via API
      const response = await fetch('/api/coaching', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'エラーが発生しました。');
      }
      
      const newSession = await response.json();
      
      // Update sessions list and set current session
      setSessions(prevSessions => [newSession, ...prevSessions]);
      setCurrentSession(newSession);
    } catch (err: any) {
      console.error('Error creating new coaching session:', err);
      setError(err.message || 'セッションを作成できませんでした。');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete a coaching session
  const deleteSession = async (sessionId: string) => {
    if (!confirm('このコーチングセッションを削除してもよろしいですか？')) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/coaching/${sessionId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      // Update sessions list
      setSessions(prevSessions => prevSessions.filter(s => s._id !== sessionId));
      
      // Clear current session if it was deleted
      if (currentSession && currentSession._id === sessionId) {
        setCurrentSession(null);
      }
    } catch (err) {
      console.error('Error deleting coaching session:', err);
      setError('セッションを削除できませんでした。');
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh the sessions list
  const refreshSessions = async () => {
    try {
      const response = await fetch('/api/coaching');
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      setSessions(data);
    } catch (err) {
      console.error('Error refreshing coaching sessions:', err);
    }
  };

  // Update the current session after a message is sent
  const onSessionUpdate = () => {
    if (currentSession?._id) {
      fetchSession(currentSession._id.toString());
    }
    refreshSessions();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Sidebar with session list */}
      <div className="md:col-span-1">
        <CoachingList
          sessions={sessions}
          onSelectSession={fetchSession}
          onCreateSession={createNewSession}
          onDeleteSession={deleteSession}
          currentSessionId={currentSession?._id?.toString() || null}
          isLoading={isLoading}
        />
      </div>

      {/* Main coaching interface */}
      <div className="md:col-span-3 h-[calc(100vh-12rem)] bg-white rounded-lg shadow overflow-hidden">
        {currentSession ? (
          <CoachingInterface
            session={currentSession}
            onSessionUpdate={onSessionUpdate}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">コーチングを始めましょう</h2>
            <p className="text-gray-500 mb-6 text-center">
              左側のリストから既存のセッションを選択するか、<br />
              「新しいセッション」ボタンをクリックして新しいコーチングを始めましょう。
            </p>
            <button
              onClick={createNewSession}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isLoading ? 'ロード中...' : '新しいセッションを開始'}
            </button>
            {error && <p className="mt-4 text-red-500">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
} 