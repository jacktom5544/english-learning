'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { POINT_CONSUMPTION } from '@/lib/pointSystem';
import { useUserPoints } from '@/components/providers/UserPointsProvider';
import { JAPANESE_TEACHER_PROFILES, JapaneseTeacherKey } from '@/lib/japanese-teachers';
import LoadingAnimation from '@/app/conversation/components/LoadingAnimation';

interface WritingEntry {
  _id: string;
  topic: string;
  content: string;
  feedback: string;
  createdAt: string;
  preferredTeacher?: JapaneseTeacherKey; // Use Japanese key type
}

interface UserProfile {
  englishLevel: string;
  job: string;
  goal: string;
  preferredTeacher: JapaneseTeacherKey; // Use Japanese key type
  points: number | null;
}

// Define a structure that includes the 'prefix' property used in TeacherMessage
interface DisplayTeacherProfile {
    name: string;
    image: string;
    messageTemplate: string;
    prefix: string; 
}

// Create the teacher info object using only Japanese teachers
// The Record key is now JapaneseTeacherKey
const teacherInfo: Record<JapaneseTeacherKey, DisplayTeacherProfile> = {
  // Use only Japanese Teachers from the imported profiles
  ...JAPANESE_TEACHER_PROFILES 
};

interface TeacherMessageProps {
  teacher: JapaneseTeacherKey; // Use Japanese key type
}

function TeacherMessage({ teacher }: TeacherMessageProps) {
  const { data: session } = useSession();
  // Use JapaneseTeacherKey for type assertion and default to 'taro'
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
  const [writingId, setWritingId] = useState('');
  const [userContent, setUserContent] = useState('');
  const [feedback, setFeedback] = useState('');
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

  useEffect(() => {
    if (session?.user?.id) {
      fetchUserProfile();
    } else {
      router.push('/login');
    }
  }, [session, router]);

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
          preferredTeacher: userData.preferredTeacher || 'taro', // Default preferred teacher is 'taro'
          points: points, // Use points from UserPointsProvider
        });
        
        // If profile is incomplete, show a message
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

  const fetchWritingHistory = async () => {
    try {
      const response = await fetch('/api/writing');
      if (!response.ok) {
        throw new Error('Failed to fetch writing history');
      }
      
      const entries = await response.json();
      
      // Debug: Log entries to see what teacher info is coming from API
      console.log('Writing entries:', entries);
      
      setPreviousEntries(entries);
    } catch (error) {
      console.error('Failed to fetch writing history:', error);
      setMessage('ライティング履歴の取得に失敗しました。しばらくしてからもう一度お試しください。');
    }
  };

  // Function to render remaining points display safely
  const renderPointsDisplay = () => {
    if (pointsLoading || points === null) {
      return <span className="font-semibold">...</span>;
    }
    return (
      <span className="font-semibold">{points}</span>
    );
  };

  // Function to check if user has enough points
  const hasEnoughPoints = () => {
    if (pointsLoading || points === null) return false;
    return points >= POINT_CONSUMPTION.WRITING_ESSAY;
  };

  const generateTopic = async () => {
    // Check if points are still loading or null
    if (pointsLoading || points === null) {
      setMessage('ポイント情報を読み込み中です。しばらくお待ちください。');
      return;
    }
    
    // At this point TypeScript knows points is not null
    // Check if the user has enough points
    if (!hasEnoughPoints()) {
      // We can safely use points here since we've checked it's not null above
      const currentPoints = points; // TypeScript knows this is a number now
      setMessage(`ポイントが不足しています。必要なポイント: ${POINT_CONSUMPTION.WRITING_ESSAY}, 現在のポイント: ${currentPoints}`);
      return;
    }

    setIsGeneratingTopic(true);
    setMessage('');
    setIsFeedbackReceived(false);
    setFeedback('');
    setUserContent('');
    setWordCount(0);
    
    try {
      // Consume points client-side first
      const pointsConsumed = await consumePoints(POINT_CONSUMPTION.WRITING_ESSAY);
      
      if (!pointsConsumed) {
        // Get current points which could be null at this point
        const currentPoints = points ?? 0;
        setMessage(`ポイントが不足しています。必要なポイント: ${POINT_CONSUMPTION.WRITING_ESSAY}, 現在のポイント: ${currentPoints}`);
        setIsGeneratingTopic(false);
        return;
      }
      
      // Generate a new topic based on user's profile - use query params instead of body
      const response = await fetch(`/api/writing?action=topic&skipPointsConsumption=true`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to generate topic:', errorData);
        
        // Handle insufficient points error specifically
        if (response.status === 403 && errorData.error === 'ポイントが不足しています') {
          setMessage(`ポイントが不足しています。${errorData.details || ''}`);
          refreshPoints(); // Refresh points
          return;
        }
        
        throw new Error(errorData?.error || errorData?.details || 'トピックの生成に失敗しました');
      }
      
      // Update points after successful generation
      refreshPoints();
      
      const data = await response.json();
      
      if (!data.topic) {
        console.error('Invalid response format:', data);
        throw new Error('サーバーからの応答形式が不正です');
      }
      
      setTopic(data.topic);
      // No writingId in the response anymore, will create when submitting
      setWritingId('');
      setIsTopicGenerated(true);
      setIsFeedbackReceived(false);
      setUserContent('');
      setFeedback('');
      setWordCount(0);
      
      // Check if this is a fallback topic and show message if needed
      if (data.generated === false) {
        setMessage(data.message || 'AIからのトピック生成ができませんでした。代わりのトピックを表示しています。');
      }
      setMessage('新しいトピックが生成されました！');
    } catch (error: any) {
      console.error('Failed to generate topic:', error);
      setMessage(`トピックの生成に失敗しました。${error.message || 'APIエラーが発生しました。しばらくしてからもう一度お試しください。'}`);
      
      // Show additional help if it looks like an API key issue
      if (error.message?.includes('API') || error.message?.includes('認証')) {
        setMessage(prev => `${prev}\n\nDeepSeek APIキーの設定を確認してください。`);
      }
    } finally {
      setIsGeneratingTopic(false);
      refreshPoints();
    }
  };

  const submitWriting = async () => {
    if (!topic || !userContent.trim()) {
      setMessage('トピックと英作文の両方を入力してください。');
      return;
    }
    if (wordCount > 400) {
      setMessage('Word count exceeds the limit (400 words).');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      const response = await fetch('/api/writing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: topic,
          content: userContent,
          preferredTeacher: userProfile?.preferredTeacher,
          skipPointsConsumption: false
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to submit writing:', errorData);
        if (response.status === 403 && errorData.error === 'ポイントが不足しています') {
          setMessage(`ポイントが不足しています。現在のポイント: ${errorData.currentPoints ?? points ?? 'N/A'}`);
          refreshPoints();
          return;
        }
        throw new Error(errorData.error || 'フィードバックの取得に失敗しました。');
      }

      const data: WritingEntry = await response.json();

      setFeedback(data.feedback);
      setWritingId(data._id);
      setIsFeedbackReceived(true);
      setMessage('フィードバックを受け取りました！');
      
      fetchWritingHistory();
      refreshPoints();
    } catch (error: any) {
      console.error('Error submitting writing:', error);
      setMessage(error.message || 'フィードバックの取得中にエラーが発生しました。');
      refreshPoints();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setUserContent(text);
    setWordCount(text.trim().split(/\s+/).filter(Boolean).length);
  };

  const resetWriting = () => {
    setIsTopicGenerated(false);
    setIsFeedbackReceived(false);
    setTopic('');
    setUserContent('');
    setFeedback('');
    setWritingId('');
    setMessage('');
    setWordCount(0);
  };

  const renderContent = () => {
    if (!userProfile) {
      return <div className="text-center py-10">ユーザー情報を読み込み中...</div>;
    }

    // Ensure userProfile.preferredTeacher is treated as JapaneseTeacherKey, default to 'taro'
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
              disabled={isSubmitting}
            />
            <p className={`text-sm mt-1 ${wordCount > 400 ? 'text-red-500' : 'text-gray-500'}`}>
              単語数: {wordCount} / 400 words
            </p>
            <button
              onClick={submitWriting}
              disabled={isSubmitting || !userContent.trim() || wordCount > 400}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 w-full sm:w-auto inline-flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <LoadingAnimation message="" />
                  <span className="ml-2">フィードバックを生成中...</span>
                </>
              ) : (
                'フィードバックを受け取る'
              )}
            </button>
          </div>
        )}

        {isFeedbackReceived && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-lg font-semibold mb-2">フィードバック</h2>
            <div 
              className="prose prose-sm max-w-none p-4 bg-gray-50 rounded border border-gray-200" 
              dangerouslySetInnerHTML={{ __html: feedback.replace(/\n/g, '<br />') }}
            />
            <button onClick={resetWriting} className="mt-4 text-sm text-blue-600 hover:underline">
              新しいトピックで練習する
            </button>
          </div>
        )}
      </>
    );
  };

  // Reset pagination when show history is toggled or when entries change
  useEffect(() => {
    const filteredCount = previousEntries.filter(entry => entry.content && entry.feedback).length;
    // Reset to first page when toggling display or when entry count changes
    setCurrentPage(1);
    
    // If current page would be empty after filtering, go to the last page
    const totalPages = Math.ceil(filteredCount / entriesPerPage);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [showHistory, previousEntries]);

  if (isLoading) {
    return <div className="text-center py-10">読み込み中...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">ライティング練習</h1>
        <div className="flex items-center gap-4">
          {userProfile && (
            <div className="text-sm px-3 py-1 bg-blue-50 border border-blue-200 text-blue-600 rounded-full">
              ポイント: {renderPointsDisplay()}
            </div>
          )}
          {previousEntries.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {showHistory ? '履歴を隠す' : '過去のライティングを表示'}
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-6">
          {message}
        </div>
      )}

      {/* Writing section */}
      <div className="mb-8">
        {!isTopicGenerated ? (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            {userProfile && (
              <TeacherMessage
                teacher={userProfile.preferredTeacher as JapaneseTeacherKey} // Cast to Japanese type
              />
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
      {showHistory && previousEntries.length > 0 && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">過去のライティング</h2>
            <button
              onClick={() => setShowHistory(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              履歴を隠す
            </button>
          </div>
          <div className="space-y-4">
            {previousEntries
              .slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage)
              .map((entry) => {
                // Debug: Log each entry to see teacher info
                console.log(`Entry ${entry._id} teacher:`, entry.preferredTeacher);
                
                // Use a variable to hold the teacher key with fallback, cast to Japanese type
                const teacherKey = (entry.preferredTeacher || 'taro') as JapaneseTeacherKey;
                console.log('Using teacher key:', teacherKey, 'for entry', entry._id);
                
                // Check if teacher exists in teacherInfo (now only Japanese), fallback to taro
                const teacher = teacherInfo[teacherKey] ? teacherKey : 'taro'; 
                
                return (
                  <div key={entry._id} className="bg-white shadow rounded-lg p-6">
                    <div className="flex items-start space-x-4 mb-4">
                      <div className="flex-shrink-0 w-12 h-12 relative">
                        <div className="absolute inset-0 rounded-full overflow-hidden">
                          <Image
                            // Access image from the teacherInfo object
                            src={teacherInfo[teacher].image} 
                            alt={teacherInfo[teacher].name}
                            fill
                            style={{ objectFit: 'cover' }}
                          />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 mb-1">
                          {/* Access name from the teacherInfo object */}
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
                      <div className="prose max-w-none whitespace-pre-line text-gray-600 mb-4">
                        {entry.feedback}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          {previousEntries.length > entriesPerPage && (
            <div className="mt-4 flex justify-center">
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                {Array.from({ length: Math.ceil(previousEntries.length / entriesPerPage) }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      currentPage === i + 1
                        ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </nav>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 