'use client';

import { ICoachingSession } from '@/models/Coaching';
import { format } from 'date-fns';
import { PlusCircle, Trash } from 'lucide-react';

interface CoachingListProps {
  sessions: Array<Partial<ICoachingSession>>;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  currentSessionId: string | null;
  isLoading: boolean;
}

export default function CoachingList({
  sessions,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  currentSessionId,
  isLoading,
}: CoachingListProps) {
  // Format the date for display
  const formatDate = (dateString: string | Date) => {
    try {
      const date = new Date(dateString);
      return format(date, 'yyyy/MM/dd');
    } catch (error) {
      return 'Unknown date';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold text-gray-800">コーチングセッション</h2>
      </div>
      
      <div className="p-2">
        <button
          onClick={onCreateSession}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
        >
          <PlusCircle size={18} />
          <span>新しいセッション</span>
        </button>
      </div>
      
      <div className="overflow-y-auto max-h-[calc(100vh-16rem)]">
        {sessions.length > 0 ? (
          <ul className="divide-y">
            {sessions.map((session) => (
              <li key={session._id?.toString()} className="relative">
                <button
                  onClick={() => session._id && onSelectSession(session._id.toString())}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition block ${
                    currentSessionId === session._id?.toString() ? 'bg-blue-50' : ''
                  }`}
                >
                  <h3 className="font-medium text-gray-800 truncate pr-8">
                    {session.title || 'Untitled Session'}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {session.lastUpdated && formatDate(session.lastUpdated)}
                  </p>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    session._id && onDeleteSession(session._id.toString());
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-500"
                  aria-label="Delete session"
                >
                  <Trash size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-4 text-center text-gray-500">
            {isLoading ? 'ロード中...' : 'セッションがありません'}
          </div>
        )}
      </div>
    </div>
  );
} 