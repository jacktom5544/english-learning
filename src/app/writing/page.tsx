'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface WritingEntry {
  _id: string;
  topic: string;
  content: string;
  feedback: string;
  score: number;
  createdAt: string;
  preferredTeacher?: 'hiroshi' | 'reiko' | 'iwao' | 'taro';
}

interface UserProfile {
  name: string;
  englishLevel: string;
  job: string;
  goal: string;
  preferredTeacher: 'hiroshi' | 'reiko' | 'iwao' | 'taro';
}

const teacherInfo = {
  hiroshi: {
    name: 'ひろし先生',
    image: '/hiroshi.png',
    messageTemplate: 'が{name}はんに合ったトピックを作るからそれに合った英文を書いてや！結果を楽しみにしてるで！',
    prefix: '俺'
  },
  reiko: {
    name: '玲子先生',
    image: '/reiko.png',
    messageTemplate: 'が{name}さんに合ったトピックを作りますのでそれに合った英文を書いて下さいね！結果を楽しみにしてますわ！',
    prefix: 'わたくし'
  },
  iwao: {
    name: '巌男先生',
    image: '/iwao.png',
    messageTemplate: 'がお前に合ったトピックを作るからそれに合った英文を書いてこい！おい、間違ってもガッカリさせんじゃねーぞ！',
    prefix: '俺'
  },
  taro: {
    name: '太郎先生',
    image: '/taro.png',
    messageTemplate: 'が{name}さんに合ったトピックを作るのでそれに合った英文を書いて下さい。結果を楽しみにしてますね。',
    prefix: '僕'
  }
};

interface TeacherMessageProps {
  teacher: 'hiroshi' | 'reiko' | 'iwao' | 'taro';
  userName: string;
}

function TeacherMessage({ teacher, userName }: TeacherMessageProps) {
  const info = teacherInfo[teacher];
  const message = info.prefix + info.messageTemplate.replace('{name}', userName);

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
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  const [topic, setTopic] = useState('');
  const [writingId, setWritingId] = useState('');
  const [userContent, setUserContent] = useState('');
  const [feedback, setFeedback] = useState('');
  const [score, setScore] = useState(0);
  const [isTopicGenerated, setIsTopicGenerated] = useState(false);
  const [isFeedbackReceived, setIsFeedbackReceived] = useState(false);
  const [isGeneratingTopic, setIsGeneratingTopic] = useState(false);
  const [message, setMessage] = useState('');
  const [previousEntries, setPreviousEntries] = useState<WritingEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 3;

  useEffect(() => {
    if (session?.user?.id) {
      fetchUserProfile();
    } else {
      router.push('/login');
    }
  }, [session, router]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch(`/api/users/${session?.user?.id}`);
      if (response.ok) {
        const userData = await response.json();
        setUserProfile({
          name: userData.name || '',
          englishLevel: userData.englishLevel || 'beginner',
          job: userData.job || '',
          goal: userData.goal || '',
          preferredTeacher: userData.preferredTeacher || 'taro',
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

  const generateTopic = async () => {
    setIsGeneratingTopic(true);
    setMessage('');

    try {
      // Generate a new topic based on user's profile
      const response = await fetch(`/api/writing?action=topic`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to generate topic:', errorData);
        throw new Error(errorData?.error || errorData?.details || 'トピックの生成に失敗しました');
      }
      
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
      setScore(0);
      setWordCount(0);
      
      // Check if this is a fallback topic and show message if needed
      if (data.generated === false) {
        setMessage(data.message || 'AIからのトピック生成ができませんでした。代わりのトピックを表示しています。');
      }
    } catch (error: any) {
      console.error('Failed to generate topic:', error);
      setMessage(`トピックの生成に失敗しました。${error.message || 'APIエラーが発生しました。しばらくしてからもう一度お試しください。'}`);
      
      // Show additional help if it looks like an API key issue
      if (error.message?.includes('API') || error.message?.includes('認証')) {
        setMessage(prev => `${prev}\n\nDeepSeek APIキーの設定を確認してください。`);
      }
    } finally {
      setIsGeneratingTopic(false);
    }
  };

  const submitWriting = async () => {
    if (!userContent.trim()) {
      setMessage('文章を入力してください。');
      return;
    }

    if (wordCount < 5) {
      setMessage('少なくとも5単語以上書いてください。');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      // Submit the writing for feedback
      const preferredTeacher = userProfile?.preferredTeacher || 'taro';
      console.log('Submitting writing with teacher:', preferredTeacher);
      
      const response = await fetch('/api/writing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic,
          content: userContent,
          preferredTeacher,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to submit writing:', errorData);
        throw new Error(errorData?.error || errorData?.details || 'フィードバックの生成に失敗しました');
      }
      
      const data = await response.json();
      
      console.log('Feedback response data:', data);
      
      if (!data.feedback || typeof data.score !== 'number') {
        console.error('Invalid response format:', data);
        throw new Error('サーバーからの応答形式が不正です');
      }
      
      // Set the writing ID from the response
      if (data._id) {
        setWritingId(data._id);
      }
      
      setFeedback(data.feedback);
      setScore(data.score);
      setIsFeedbackReceived(true);

      // Refresh writing history
      fetchWritingHistory();
    } catch (error: any) {
      console.error('Failed to submit writing:', error);
      setMessage(`フィードバックの生成に失敗しました。${error.message || 'APIエラーが発生しました。しばらくしてからもう一度お試しください。'}`);
      
      // Show additional help if it looks like an API key issue
      if (error.message?.includes('API') || error.message?.includes('認証')) {
        setMessage(prev => `${prev}\n\nDeepSeek APIキーの設定を確認してください。`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setUserContent(text);
    
    // Calculate word count (split by spaces and filter empty strings)
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
  };

  const resetWriting = () => {
    setIsTopicGenerated(false);
    setIsFeedbackReceived(false);
    setTopic('');
    setWritingId('');
    setUserContent('');
    setFeedback('');
    setScore(0);
    setWordCount(0);
  };

  const renderContent = () => {
    if (!isTopicGenerated) {
      return null;
    }

    return (
      <div className="space-y-6">
        {userProfile && (
          <TeacherMessage
            teacher={userProfile.preferredTeacher}
            userName={userProfile.name}
          />
        )}
        
        <div className="bg-white shadow rounded-lg p-6">
          <div className="mb-4">
            <h2 className="text-lg font-medium text-gray-900 mb-2">トピック</h2>
            <p className="text-gray-600">{topic}</p>
          </div>

          <div className="mb-4">
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
              英作文
            </label>
            <textarea
              id="content"
              rows={6}
              value={userContent}
              onChange={(e) => {
                setUserContent(e.target.value);
                // Count words (split by whitespace)
                setWordCount(e.target.value.trim().split(/\s+/).filter(Boolean).length);
              }}
              className="w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="ここに英語で文章を書いてください..."
              disabled={isFeedbackReceived}
            />
            <p className="mt-1 text-sm text-gray-500">
              単語数: {wordCount} words {wordCount < 5 && wordCount > 0 && '(最低5単語必要です)'}
            </p>
          </div>

          {!isFeedbackReceived && (
            <div className="flex justify-end">
              <button
                onClick={submitWriting}
                disabled={isSubmitting || wordCount < 5}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isSubmitting ? '送信中...' : 'フィードバックを受け取る'}
              </button>
            </div>
          )}

          {isSubmitting && (
            <div className="mt-8 flex flex-col items-center">
              <div className="animate-pulse flex space-x-4 mb-4">
                <div className="h-12 w-12 bg-blue-400 rounded-full animate-bounce"></div>
                <div className="h-12 w-12 bg-blue-500 rounded-full animate-bounce delay-100"></div>
                <div className="h-12 w-12 bg-blue-600 rounded-full animate-bounce delay-200"></div>
              </div>
              <p className="text-lg font-medium text-gray-700 mt-2">AIが文章を添削中です・・・</p>
              <p className="text-sm text-gray-500 mt-1">少々お待ちください</p>
            </div>
          )}
        </div>

        {isFeedbackReceived && feedback && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">フィードバック</h2>
            <div className="prose max-w-none whitespace-pre-line text-gray-600">
              {feedback}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-gray-700">
                スコア: <span className="font-medium">{score}</span>/100
              </p>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setIsTopicGenerated(false);
                  setIsFeedbackReceived(false);
                  setUserContent('');
                  setFeedback('');
                  setScore(0);
                  setWordCount(0);
                  setTopic('');
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                新しいトピックで書く
              </button>
            </div>
          </div>
        )}
      </div>
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
        {previousEntries.length > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {showHistory ? '履歴を隠す' : '過去のライティングを表示'}
          </button>
        )}
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
                teacher={userProfile.preferredTeacher}
                userName={userProfile.name}
              />
            )}
            <button
              onClick={generateTopic}
              disabled={isGeneratingTopic}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isGeneratingTopic ? 'トピックを生成中...' : 'ライティングを始める'}
            </button>
            {isGeneratingTopic && (
              <div className="mt-8 flex flex-col items-center">
                <div className="animate-pulse flex space-x-4 mb-4">
                  <div className="h-12 w-12 bg-blue-400 rounded-full animate-bounce"></div>
                  <div className="h-12 w-12 bg-blue-500 rounded-full animate-bounce delay-100"></div>
                  <div className="h-12 w-12 bg-blue-600 rounded-full animate-bounce delay-200"></div>
                </div>
                <p className="text-lg font-medium text-gray-700 mt-2">AIが現在作成中です・・・</p>
                <p className="text-sm text-gray-500 mt-1">少々お待ちください</p>
              </div>
            )}
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
                
                // Use a variable to hold the teacher key with fallback
                const teacherKey = entry.preferredTeacher || 'taro';
                console.log('Using teacher key:', teacherKey, 'for entry', entry._id);
                
                // Make sure teacher exists in teacherInfo
                if (!teacherInfo[teacherKey]) {
                  console.warn(`Teacher ${teacherKey} not found, falling back to taro`);
                }
                
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
                      <div className="prose max-w-none whitespace-pre-line text-gray-600 mb-4">
                        {entry.feedback}
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-gray-700">
                          スコア: <span className="font-medium">{entry.score}</span>/100
                        </p>
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