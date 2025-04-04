'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { POINT_CONSUMPTION } from '@/lib/pointSystem';
import { useUserPoints } from '@/components/providers/UserPointsProvider';
import { JAPANESE_TEACHER_PROFILES, JapaneseTeacherKey } from '@/lib/japanese-teachers';
import LoadingAnimation from '@/app/conversation/components/LoadingAnimation';

// Define status type
type WritingStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Update interface to include status field and nullable feedback
interface WritingEntry {
  _id: string;
  topic: string;
  content: string;
  feedback: string | null;
  status: WritingStatus;
  createdAt: string;
  preferredTeacher?: JapaneseTeacherKey;
}

// Rest of interface definitions
interface UserProfile {
  englishLevel: string;
  job: string;
  goal: string;
  preferredTeacher: JapaneseTeacherKey;
  points: number | null;
}

interface DisplayTeacherProfile {
  name: string;
  image: string;
  messageTemplate: string;
  prefix: string; 
}

// Japanese teacher info - using imported profiles
const teacherInfo: Record<JapaneseTeacherKey, DisplayTeacherProfile> = {
  ...JAPANESE_TEACHER_PROFILES
};

// Configuration for polling
const POLLING_INTERVAL = 3000; // Poll every 3 seconds (faster for better UX)
const MAX_POLLING_ATTEMPTS = 60; // Maximum 60 attempts (3 minutes)

interface TeacherMessageProps {
  teacher: JapaneseTeacherKey;
}

function TeacherMessage({ teacher }: TeacherMessageProps) {
  const { data: session } = useSession();
  const info = teacherInfo[teacher as JapaneseTeacherKey] || teacherInfo.taro;
  
  const userName = session?.user?.name || '';
  const message = info.messageTemplate.replace('{name}', userName);
  
  return (
    <div className="flex items-center space-x-4 mb-6 bg-white p-4 rounded-lg shadow">
      <div className="flex-shrink-0 w-16 h-16 relative">
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <Image
            src={info.image}
            alt={info.name}
            fill
            style={{ objectFit: 'cover' }}
          />
        </div>
      </div>
      <div className="flex-1">
        <h3 className="font-medium text-gray-900">{info.name}</h3>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}

export default function WritingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { points, pointsUsedThisMonth, isLoading: pointsLoading, consumePoints, refreshPoints } = useUserPoints();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  const [topic, setTopic] = useState('');
  const [writingId, setWritingId] = useState<string | null>(null);
  const [userContent, setUserContent] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isTopicGenerated, setIsTopicGenerated] = useState(false);
  const [isFeedbackReceived, setIsFeedbackReceived] = useState(false);
  const [isGeneratingTopic, setIsGeneratingTopic] = useState(false);
  const [message, setMessage] = useState('');
  const [previousEntries, setPreviousEntries] = useState<WritingEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 2;

  // Polling state
  const [isPolling, setIsPolling] = useState(false);
  const [currentEntryStatus, setCurrentEntryStatus] = useState<WritingStatus | null>(null);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const notificationShown = useRef<boolean>(false);

  // Session check and initial data fetch
  useEffect(() => {
    if (session?.user?.id) {
      fetchUserProfile();
    } else {
      router.push('/login');
    }
  }, [session, router]);

  // Fetch user profile and writing history
  const fetchUserProfile = async () => {
    try {
      // Fetch basic user profile
      const response = await fetch(`/api/users/${session?.user?.id}`);
      if (response.ok) {
        const userData = await response.json();
        setUserProfile({
          englishLevel: userData.englishLevel || 'beginner',
          job: userData.job || '',
          goal: userData.goal || '',
          preferredTeacher: userData.preferredTeacher || 'taro',
          points: points,
        });
        
        // Message for incomplete profile
        if (!userData.job || !userData.goal) {
          setMessage('より適切なトピックを生成するために、プロフィールで職業と目標を設定してください。');
        }

        // Fetch previous writing entries
        fetchWritingHistory();
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update profile when points change
  useEffect(() => {
    if (userProfile && points !== userProfile.points) {
      setUserProfile({
        ...userProfile,
        points: points
      });
    }
  }, [points, userProfile]);

  // Fetch writing history
  const fetchWritingHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/writing');
      if (!response.ok) {
        throw new Error('Failed to fetch writing history');
      }
      
      const entries = await response.json();
      console.log('Writing entries fetched:', entries.length);
      
      setPreviousEntries(entries);

      // Check if we have the entry we're polling for in the history
      if (writingId && isPolling) {
        const currentEntry = entries.find(entry => entry._id === writingId);
        if (currentEntry) {
          // Update our local status if it's changed
          if (currentEntry.status !== currentEntryStatus) {
            setCurrentEntryStatus(currentEntry.status);
            
            // If completed or failed, stop polling and update UI
            if (currentEntry.status === 'completed') {
              setFeedback(currentEntry.feedback);
              setIsFeedbackReceived(true);
              setIsPolling(false);
              
              // Show feedback ready notification if not already shown
              if (!notificationShown.current) {
                setMessage('フィードバックの準備ができました！');
                notificationShown.current = true;
                // Optionally, play a sound or show a more prominent notification
              }
            } else if (currentEntry.status === 'failed') {
              setIsPolling(false);
              setMessage('フィードバックの生成に失敗しました。もう一度お試しください。');
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch writing history:', error);
      setMessage('ライティング履歴の取得に失敗しました。');
    }
  }, [writingId, isPolling, currentEntryStatus]);

  // Function to render remaining points display
  const renderPointsDisplay = () => {
    if (pointsLoading || points === null) {
      return <span className="font-semibold">...</span>;
    }
    return <span className="font-semibold">{points}</span>;
  };

  // Function to check if user has enough points
  const hasEnoughPoints = () => {
    if (pointsLoading || points === null) return false;
    return (points >= POINT_CONSUMPTION.WRITING_ESSAY);
  };

  // Generate topic function
  const generateTopic = async () => {
    if (!hasEnoughPoints()) {
      setMessage(`ポイントが不足しています。必要なポイント: ${POINT_CONSUMPTION.WRITING_ESSAY}`);
      return;
    }

    setIsGeneratingTopic(true);
    setMessage('');

    try {
      const response = await fetch(`/api/writing?action=topic`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'トピックの生成に失敗しました');
      }

      const data = await response.json();
      setTopic(data.topic);
      setIsTopicGenerated(true);
      
      // Refresh points after topic generation
      refreshPoints();
    } catch (error: any) {
      console.error('Error generating topic:', error);
      setMessage(error.message || 'トピックの生成中にエラーが発生しました');
    } finally {
      setIsGeneratingTopic(false);
    }
  };

  // Polling logic
  const startPolling = useCallback((id: string) => {
    console.log(`Starting polling for writing ID: ${id}`);
    setIsPolling(true);
    setPollingAttempts(0);
    notificationShown.current = false;
    
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Define the polling function
    const pollForFeedback = async () => {
      if (!id || pollingAttempts >= MAX_POLLING_ATTEMPTS) {
        stopPolling();
        
        if (pollingAttempts >= MAX_POLLING_ATTEMPTS) {
          setMessage('フィードバックの取得がタイムアウトしました。ページを更新して再試行してください。');
        }
        return;
      }
      
      setPollingAttempts(prev => prev + 1);
      
      try {
        const response = await fetch(`/api/writing/${id}`);
        
        if (!response.ok) {
          console.error(`Polling failed with status: ${response.status}`);
          return; // Continue polling on error
        }
        
        const entry = await response.json();
        console.log(`Polling (${pollingAttempts}): Entry status=${entry.status}`);
        
        // Update status
        setCurrentEntryStatus(entry.status);
        
        // If process is complete, stop polling and update UI
        if (entry.status === 'completed') {
          setFeedback(entry.feedback);
          setIsFeedbackReceived(true);
          stopPolling();
          refreshPoints();
          
          // Show completion notification if not already shown
          if (!notificationShown.current) {
            setMessage('フィードバックの準備ができました！');
            notificationShown.current = true;
          }
        } 
        else if (entry.status === 'failed') {
          stopPolling();
          setMessage('フィードバックの生成に失敗しました。もう一度お試しください。');
        }
        // Otherwise continue polling for pending/processing status
      } catch (error) {
        console.error('Error during polling:', error);
        // Continue polling even on error - don't stop
      }
    };
    
    // Start the polling immediately, then at intervals
    pollForFeedback();
    pollingIntervalRef.current = setInterval(pollForFeedback, POLLING_INTERVAL);
    
    // Update history periodically as well
    const historyInterval = setInterval(fetchWritingHistory, POLLING_INTERVAL * 2);
    
    // Cleanup function
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      clearInterval(historyInterval);
    };
  }, [fetchWritingHistory, pollingAttempts, refreshPoints]);
  
  // Stop polling function
  const stopPolling = useCallback(() => {
    console.log('Stopping polling');
    setIsPolling(false);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);
  
  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Submit writing function
  const submitWriting = async () => {
    if (!topic || !userContent.trim()) {
      setMessage('トピックと英作文の両方を入力してください。');
      return;
    }
    
    if (wordCount > 400) {
      setMessage('単語数が制限（400語）を超えています。');
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    setFeedback(null);
    setIsFeedbackReceived(false);
    setCurrentEntryStatus(null);

    try {
      const response = await fetch('/api/writing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic,
          content: userContent,
          preferredTeacher: userProfile?.preferredTeacher,
        }),
      });

      const data = await response.json();

      if (response.status === 202) {
        // Request accepted, start polling
        setMessage('フィードバック リクエストを受け付けました。処理中です...');
        setWritingId(data.writingId);
        setCurrentEntryStatus('pending');
        
        // Start polling for updates
        startPolling(data.writingId);
        
        // Refresh points immediately
        refreshPoints();
        
        // Also fetch writing history to show the pending entry
        fetchWritingHistory();
      } else {
        // Handle error
        console.error('Failed to submit writing:', data);
        if (response.status === 403 && data.error === 'ポイントが不足しています') {
          setMessage(`ポイントが不足しています。現在のポイント: ${data.currentPoints || 'N/A'}`);
          refreshPoints();
        } else {
          throw new Error(data.error || 'フィードバックのリクエストに失敗しました。');
        }
      }
    } catch (error: any) {
      console.error('Error submitting writing:', error);
      setMessage(error.message || 'フィードバックのリクエスト中にエラーが発生しました。');
      refreshPoints();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle text change and word count
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setUserContent(text);

    // Calculate word count
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
  };

  // Reset writing function
  const resetWriting = () => {
    setIsTopicGenerated(false);
    setIsFeedbackReceived(false);
    setTopic('');
    setUserContent('');
    setFeedback(null);
    setWritingId(null);
    setMessage('');
    setWordCount(0);
    setCurrentEntryStatus(null);
    stopPolling();
    notificationShown.current = false;
  };

  // Render feedback status component
  const renderFeedbackStatus = () => {
    if (!isPolling && !currentEntryStatus) return null;
    
    if (isPolling || currentEntryStatus === 'pending' || currentEntryStatus === 'processing') {
      return (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-center mb-6">
          <div className="flex justify-center items-center">
            <LoadingAnimation message="" />
            <p className="ml-3 text-yellow-700 font-medium">
              フィードバックを生成中です...
              {currentEntryStatus && ` (${currentEntryStatus === 'pending' ? '準備中' : '処理中'})`}
            </p>
          </div>
          <p className="text-sm text-yellow-600 mt-2">
            処理には数分かかる場合があります。ページを離れても処理は続行され、履歴で確認できます。
          </p>
        </div>
      );
    }
    
    if (currentEntryStatus === 'failed') {
      return (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-center mb-6">
          <p className="text-red-700 font-medium">
            フィードバックの生成に失敗しました。
          </p>
          <p className="text-sm text-red-600 mt-2">
            もう一度お試しいただくか、サポートにお問い合わせください。
          </p>
        </div>
      );
    }
    
    return null;
  };

  // Render feedback content
  const renderFeedback = () => {
    if (!isFeedbackReceived || !feedback) return null;
    
    return (
      <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold text-green-800">フィードバック</h2>
          <button 
            onClick={resetWriting}
            className="text-sm px-3 py-1 bg-green-100 hover:bg-green-200 text-green-800 rounded"
          >
            新しいトピックで練習する
          </button>
        </div>
        <div className="prose max-w-none whitespace-pre-line text-gray-700">
          {feedback}
        </div>
      </div>
    );
  };

  // Render main content
  const renderContent = () => {
    if (!userProfile) {
      return <div className="text-center py-10">ユーザー情報を読み込み中...</div>;
    }

    const currentTeacherKey = (userProfile.preferredTeacher || 'taro') as JapaneseTeacherKey;

    return (
      <>
        <TeacherMessage teacher={currentTeacherKey} />

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4">トピック</h2>
          {isGeneratingTopic ? (
            <div className="flex items-center justify-center h-16">
              <LoadingAnimation message="" />
              <span className="ml-3 text-gray-600">トピックを生成中...</span>
            </div>
          ) : isTopicGenerated ? (
            <p className="text-gray-800 bg-gray-50 p-3 rounded">{topic}</p>
          ) : (
            <button
              onClick={generateTopic}
              disabled={isLoading || pointsLoading || !hasEnoughPoints() || isGeneratingTopic}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              新しいトピックを生成 (消費ポイント: {POINT_CONSUMPTION.WRITING_ESSAY})
            </button>
          )}
        </div>
        
        {isTopicGenerated && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-lg font-semibold mb-2">英作文</h2>
            <textarea
              value={userContent}
              onChange={handleTextChange}
              rows={10}
              className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="ここに英文を入力してください..."
              maxLength={2000}
              disabled={isSubmitting || isPolling || isFeedbackReceived}
            />
            <p className={`text-sm mt-1 ${wordCount > 400 ? 'text-red-500' : 'text-gray-500'}`}>
              単語数: {wordCount} / 400 words
            </p>
            <button
              onClick={submitWriting}
              disabled={isSubmitting || isPolling || isFeedbackReceived || !userContent.trim() || wordCount > 400}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 w-full sm:w-auto inline-flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <LoadingAnimation message="" />
                  <span className="ml-2">送信中...</span>
                </>
              ) : isPolling ? (
                <>
                  <LoadingAnimation message="" />
                  <span className="ml-2">処理中...</span>
                </>
              ) : (
                'フィードバックを受け取る'
              )}
            </button>
          </div>
        )}

        {/* Show feedback status */}
        {renderFeedbackStatus()}
        
        {/* Show feedback when ready */}
        {renderFeedback()}
      </>
    );
  };

  // Handle pagination
  useEffect(() => {
    if (previousEntries.length > 0 && previousEntries.length <= (currentPage - 1) * entriesPerPage) {
      setCurrentPage(Math.max(1, Math.ceil(previousEntries.length / entriesPerPage)));
    }
  }, [previousEntries, currentPage, entriesPerPage]);

  if (isLoading) {
    return <div className="text-center py-10">読み込み中...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Writing Practice</h1>
        <p className="text-gray-600">英作文を書いて、AIからフィードバックを受け取りましょう。</p>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-md ${
          message.includes('失敗') || message.includes('エラー') || message.includes('不足')
            ? 'bg-red-100 text-red-700'
            : message.includes('処理中') || message.includes('準備')
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-blue-100 text-blue-700'
        }`}>
          {message}
        </div>
      )}

      <div className="mb-8">
        {!isTopicGenerated ? (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            {userProfile && (
              <TeacherMessage teacher={userProfile.preferredTeacher} />
            )}
            <div className="text-sm text-gray-600 mb-4">
              現在のポイント: {renderPointsDisplay()}
              <button 
                onClick={refreshPoints} 
                className="ml-2 text-blue-500 hover:text-blue-700"
                title="ポイントを更新"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            <div className="mb-4">
              <p className="text-gray-600 mb-2">
                1回の利用で{POINT_CONSUMPTION.WRITING_ESSAY}ポイント消費します。
              </p>
            </div>
            <div className="flex justify-center">
              <button
                onClick={generateTopic}
                disabled={isGeneratingTopic || !hasEnoughPoints()}
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-lg font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isGeneratingTopic ? (
                  <>
                    <LoadingAnimation message="" />
                    <span className="ml-2">トピック生成中...</span>
                  </>
                ) : (
                  'トピックを生成する'
                )}
              </button>
            </div>
          </div>
        ) : (
          renderContent()
        )}
      </div>

      {/* History section - always available */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">過去のライティング</h2>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            {showHistory ? '履歴を隠す' : '履歴を表示する'}
          </button>
        </div>
        
        {showHistory && previousEntries.length > 0 && (
          <div className="space-y-4">
            {previousEntries
              .slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage)
              .map((entry) => {
                const teacherKey = (entry.preferredTeacher || 'taro') as JapaneseTeacherKey;
                const teacher = teacherInfo[teacherKey] ? teacherKey : 'taro';
                
                return (
                  <div key={entry._id} className="bg-white shadow rounded-lg p-6">
                    <div className="flex items-start space-x-4 mb-4">
                      <div className="flex-shrink-0 w-12 h-12 relative">
                        <div className="absolute inset-0 rounded-full overflow-hidden">
                          <Image
                            src={teacherInfo[teacher].image}
                            alt={teacherInfo[teacher].name}
                            fill
                            style={{ objectFit: 'cover' }}
                          />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 mb-1">
                          {teacherInfo[teacher].name}からのフィードバック
                        </h3>
                        <p className="text-sm text-gray-500">
                          {new Date(entry.createdAt).toLocaleString('ja-JP')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-200 pt-4">
                      <h3 className="font-medium text-gray-900 mb-2">トピック</h3>
                      <p className="text-gray-600 mb-4">{entry.topic}</p>
                      
                      <h3 className="font-medium text-gray-900 mb-2">あなたの回答</h3>
                      <p className="text-gray-600 mb-4 whitespace-pre-line">{entry.content}</p>
                      
                      <h3 className="font-medium text-gray-900 mb-2">フィードバック</h3>
                      
                      {/* Conditional rendering based on status */}
                      {entry.status === 'completed' && entry.feedback ? (
                        <div className="prose max-w-none whitespace-pre-line text-gray-600 mb-4">
                          {entry.feedback}
                        </div>
                      ) : entry.status === 'pending' ? (
                        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md text-sm">
                          <div className="flex items-center">
                            <LoadingAnimation message="" />
                            <span className="ml-2 text-yellow-700 font-medium">
                              フィードバックを生成するために準備中です...
                            </span>
                          </div>
                        </div>
                      ) : entry.status === 'processing' ? (
                        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md text-sm">
                          <div className="flex items-center">
                            <LoadingAnimation message="" />
                            <span className="ml-2 text-yellow-700 font-medium">
                              フィードバックを生成中です...
                            </span>
                          </div>
                        </div>
                      ) : entry.status === 'failed' ? (
                        <div className="bg-red-50 border border-red-200 p-3 rounded-md text-sm">
                          <p className="text-red-700 font-medium">
                            フィードバックの生成に失敗しました。
                          </p>
                        </div>
                      ) : !entry.status ? (
                        // Legacy entries without status (should display feedback directly)
                        <div className="prose max-w-none whitespace-pre-line text-gray-600 mb-4">
                          {entry.feedback || "フィードバックなし"}
                        </div>
                      ) : (
                        <div className="bg-gray-50 border border-gray-200 p-3 rounded-md text-sm">
                          <p className="text-gray-500">フィードバックはまだありません。</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
        
        {/* Pagination controls */}
        {showHistory && previousEntries.length > entriesPerPage && (
          <div className="flex justify-center mt-6 space-x-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded-md hover:bg-gray-100 disabled:opacity-50"
            >
              前へ
            </button>
            <span className="px-3 py-1">
              {currentPage} / {Math.ceil(previousEntries.length / entriesPerPage)}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(Math.ceil(previousEntries.length / entriesPerPage), p + 1))}
              disabled={currentPage >= Math.ceil(previousEntries.length / entriesPerPage)}
              className="px-3 py-1 border rounded-md hover:bg-gray-100 disabled:opacity-50"
            >
              次へ
            </button>
          </div>
        )}
        
        {showHistory && previousEntries.length === 0 && (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">まだライティングの履歴はありません。</p>
          </div>
        )}
      </div>
    </div>
  );
} 