'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface WritingEntry {
  _id: string;
  topic: string;
  content: string;
  feedback: string;
  score: number;
  createdAt: string;
}

interface UserProfile {
  englishLevel: string;
  job: string;
  goal: string;
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
          englishLevel: userData.englishLevel || 'beginner',
          job: userData.job || '',
          goal: userData.goal || '',
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
      const response = await fetch('/api/writing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic,
          content: userContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to submit writing:', errorData);
        throw new Error(errorData?.error || errorData?.details || 'フィードバックの生成に失敗しました');
      }
      
      const data = await response.json();
      
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
      return (
        <div className="text-center py-10">
          <button
            onClick={generateTopic}
            disabled={isGeneratingTopic}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isGeneratingTopic ? 'トピック生成中...' : 'ライティングを始める'}
          </button>
          {message && (
            <div className="mt-4 text-sm text-amber-600">{message}</div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">トピック:</h2>
          <div className="p-4 bg-gray-50 rounded-md text-lg mb-6">
            {topic}
          </div>

          <h2 className="text-lg font-medium text-gray-900 mb-4">
            このトピックについて英語で書いてください:
          </h2>
          <textarea
            value={userContent}
            onChange={handleTextChange}
            disabled={isFeedbackReceived || isSubmitting}
            className="w-full h-40 p-4 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
            placeholder="ここに英語で文章を入力..."
          />
          
          <div className="mt-2 flex justify-end">
            <span className={`text-sm ${wordCount < 20 ? 'text-red-500' : wordCount > 100 ? 'text-green-500' : 'text-gray-500'}`}>
              {wordCount} 単語
            </span>
          </div>

          {!isFeedbackReceived ? (
            <div className="mt-6 flex flex-col sm:flex-row justify-between gap-4">
              <button
                onClick={resetWriting}
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                別のトピックを試す
              </button>
              <button
                onClick={submitWriting}
                disabled={isSubmitting || !userContent.trim()}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isSubmitting ? '提出中...' : '提出して添削を受ける'}
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <div className="border-t border-gray-200 pt-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">フィードバック:</h2>
                <div className="p-6 bg-gradient-to-br from-blue-50 to-sky-50 rounded-lg shadow-sm border border-blue-100">
                  <div className="whitespace-pre-line prose prose-blue max-w-none text-gray-800">
                    {feedback.split('\n').map((line, index) => {
                      // Check if the line contains a section number (like "1.", "2.")
                      const sectionMatch = line.match(/^(\d+)\./);
                      
                      if (sectionMatch) {
                        return (
                          <div key={index} className="mt-4 first:mt-0">
                            <h3 className="text-blue-700 font-medium">{line}</h3>
                          </div>
                        );
                      }
                      
                      // Check if line contains emphasis (between ** or __) and style it
                      const styledLine = line.replace(
                        /(\*\*|__)(.*?)(\*\*|__)/g, 
                        '<span class="font-bold text-blue-800">$2</span>'
                      );
                      
                      return (
                        <div 
                          key={index} 
                          className="mb-2"
                          dangerouslySetInnerHTML={{ __html: styledLine }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">スコア:</h2>
                <div className="flex items-center">
                  <div
                    className={`relative text-2xl font-bold rounded-full w-20 h-20 flex items-center justify-center shadow-md transition-all duration-300 ${
                      score >= 80
                        ? 'bg-gradient-to-br from-green-400 to-green-600 text-white'
                        : score >= 60
                        ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-white'
                        : 'bg-gradient-to-br from-red-300 to-red-500 text-white'
                    }`}
                  >
                    <div className="absolute inset-0 rounded-full bg-white opacity-20"></div>
                    {score}
                  </div>
                  <div className="ml-6 text-base">
                    <div className={`font-medium ${
                      score >= 80
                        ? 'text-green-600'
                        : score >= 60
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}>
                      {score >= 90
                        ? '素晴らしい！完璧に近い出来です！'
                        : score >= 80
                        ? '優れた出来栄えです！'
                        : score >= 70
                        ? '良い出来です！'
                        : score >= 60
                        ? 'まずまずの出来です！'
                        : score >= 50
                        ? 'もう少し頑張りましょう！'
                        : '基本から見直してみましょう！'}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {score >= 80
                        ? '文法や表現がしっかりしています。'
                        : score >= 60
                        ? '基本はできていますが、改善の余地があります。'
                        : '基礎から丁寧に学び直しましょう。'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={resetWriting}
                  className="inline-flex items-center justify-center w-full sm:w-auto px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  新しいライティングを始める
                </button>
              </div>
            </div>
          )}
        </div>
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold">ライティング練習</h1>
        
        {previousEntries.length > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {showHistory ? '履歴を隠す' : '過去のライティングを表示'}
          </button>
        )}
      </div>

      <p className="text-gray-600">
        トピックに基づいて英語で文章を書いてみましょう。AIがフィードバックを提供します。
      </p>

      {message && (
        <div className="bg-amber-50 border border-amber-400 text-amber-700 px-4 py-3 rounded whitespace-pre-line">
          {message}
        </div>
      )}

      {renderContent()}

      {showHistory && previousEntries.length > 0 && (
        <div className="bg-white shadow rounded-lg overflow-hidden mt-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">過去のライティング</h2>
          </div>
          {(() => {
            const filteredEntries = previousEntries.filter(entry => entry.content && entry.feedback);
            return (
              <>
                <div className="divide-y divide-gray-200">
                  {filteredEntries.length === 0 ? (
                    <div className="px-6 py-10 text-center text-gray-500">
                      過去のライティングがありません。ライティング練習を始めてみましょう！
                    </div>
                  ) : (
                    filteredEntries
                      .slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage)
                      .map((entry) => {
                        return (
                          <div key={entry._id} className="px-6 py-4">
                            <div className="mb-2 flex flex-wrap items-center">
                              <span className="text-sm text-gray-500 mr-3">
                                {new Date(entry.createdAt).toLocaleDateString('ja-JP')}
                              </span>
                              <span
                                className={`mt-1 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium shadow-sm ${
                                  entry.score >= 80
                                    ? 'bg-gradient-to-r from-green-400 to-green-500 text-white'
                                    : entry.score >= 60
                                    ? 'bg-gradient-to-r from-yellow-300 to-yellow-400 text-white'
                                    : 'bg-gradient-to-r from-red-300 to-red-400 text-white'
                                }`}
                              >
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                                </svg>
                                スコア: {entry.score}
                              </span>
                            </div>
                            <div className="mb-2 p-3 bg-gray-50 rounded-md text-sm">
                              <div className="font-medium">トピック:</div>
                              <div className="mt-1 break-words">{entry.topic}</div>
                            </div>
                            <div className="mb-2 p-3 bg-blue-50 rounded-md text-sm">
                              <div className="font-medium">あなたの回答:</div>
                              <div className="mt-1 break-words whitespace-pre-wrap">{entry.content}</div>
                            </div>
                            <div className="p-4 bg-gradient-to-br from-green-50 to-blue-50 rounded-lg shadow-sm border border-green-100 text-sm">
                              <div className="font-medium">フィードバック:</div>
                              <div className="mt-2 break-words whitespace-pre-line prose prose-sm prose-blue max-w-none text-gray-800">
                                {entry.feedback.split('\n').map((line, index) => {
                                  // Check if the line contains a section number (like "1.", "2.")
                                  const sectionMatch = line.match(/^(\d+)\./);
                                  
                                  if (sectionMatch) {
                                    return (
                                      <div key={index} className="mt-3 first:mt-0">
                                        <h4 className="text-blue-700 font-medium">{line}</h4>
                                      </div>
                                    );
                                  }
                                  
                                  // Check if line contains emphasis (between ** or __) and style it
                                  const styledLine = line.replace(
                                    /(\*\*|__)(.*?)(\*\*|__)/g, 
                                    '<span class="font-bold text-blue-800">$2</span>'
                                  );
                                  
                                  return (
                                    <div 
                                      key={index} 
                                      className="mb-1"
                                      dangerouslySetInnerHTML={{ __html: styledLine }}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
                
                {filteredEntries.length > 0 && (
                  <div className="px-6 py-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        <span>表示: </span>
                        <span className="font-medium">{Math.min((currentPage - 1) * entriesPerPage + 1, filteredEntries.length)}</span>
                        <span> - </span>
                        <span className="font-medium">{Math.min(currentPage * entriesPerPage, filteredEntries.length)}</span>
                        <span> / </span>
                        <span className="font-medium">{filteredEntries.length}</span>
                        <span> 件</span>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          className="inline-flex items-center justify-center p-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                          aria-label="最初のページへ"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          前のページ
                        </button>
                        
                        <div className="flex items-center">
                          {Array.from({ length: Math.min(5, Math.ceil(filteredEntries.length / entriesPerPage)) }, (_, i) => {
                            // Show current page and two pages before and after
                            let pageToShow;
                            const totalPages = Math.ceil(filteredEntries.length / entriesPerPage);
                            
                            if (totalPages <= 5) {
                              // If total pages are 5 or less, show all
                              pageToShow = i + 1;
                            } else if (currentPage <= 3) {
                              // If current page is near the beginning
                              pageToShow = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              // If current page is near the end
                              pageToShow = totalPages - 4 + i;
                            } else {
                              // If current page is in the middle
                              pageToShow = currentPage - 2 + i;
                            }
                            
                            return (
                              <button
                                key={i}
                                onClick={() => setCurrentPage(pageToShow)}
                                className={`inline-flex items-center justify-center w-8 h-8 mx-1 border ${
                                  pageToShow === currentPage
                                    ? 'border-blue-500 bg-blue-50 text-blue-600 font-medium'
                                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                                } rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                              >
                                {pageToShow}
                              </button>
                            );
                          })}
                        </div>
                        
                        <button
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={currentPage === Math.ceil(filteredEntries.length / entriesPerPage)}
                          className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          次のページ
                        </button>
                        <button
                          onClick={() => setCurrentPage(Math.ceil(filteredEntries.length / entriesPerPage))}
                          disabled={currentPage === Math.ceil(filteredEntries.length / entriesPerPage)}
                          className="inline-flex items-center justify-center p-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                          aria-label="最後のページへ"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10.293 15.707a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            <path fillRule="evenodd" d="M4.293 15.707a1 1 0 010-1.414L8.586 10 4.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
} 