'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { POINT_CONSUMPTION } from '@/lib/pointSystem';
import { useUserPoints } from '@/components/providers/UserPointsProvider';
import { EssayWithErrors } from './components';
import { JAPANESE_TEACHER_PROFILES, JapaneseTeacherKey } from '@/lib/japanese-teachers';

interface GrammarEntry {
  _id: string;
  topics: string[];
  essay: string;
  errorDetails?: {
    errors: {
      type: string;
      text: string;
      startPos: number;
      endPos: number;
      explanation: string;
    }[];
  }[];
  grammaticalErrors: {
    category: string;
    count: number;
  }[];
  preferredTeacher: 'hiroshi' | 'reiko' | 'iwao' | 'taro';
  conversation: {
    sender: 'user' | 'teacher';
    content: string;
    timestamp: string;
  }[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
}

interface UserProfile {
  englishLevel: string;
  nickname: string;
  preferredTeacher: 'hiroshi' | 'reiko' | 'iwao' | 'taro';
  points: number | null;
}

const teacherInfo = {
  hiroshi: {
    name: 'ひろし先生',
    image: '/hiroshi.png',
    introduction: '{nickname}はんの文法ミスの傾向を知りたいから以下のトピックについて英文を書いてくれへん？出来るだけ長く書いてもらえるとより{nickname}はん向けの的確なアドバイスが出来るで！'
  },
  reiko: {
    name: '玲子先生',
    image: '/reiko.png',
    introduction: '{nickname}さんの文法ミスの傾向を知りたいので以下のトピックについて英文を書いて下さいまし。出来るだけ長く書いてもらえるとより{nickname}さん向けの的確なアドバイスが出来ますわ！'
  },
  iwao: {
    name: '巌男先生',
    image: '/iwao.png',
    introduction: 'お前の文法ミスの傾向を知りたいから以下のトピックについて英文を書いてくれ。出来るだけ長く書けばお前にとって的確なアドバイスが出来るぞ。'
  },
  taro: {
    name: '太郎先生',
    image: '/taro.png',
    introduction: '{nickname}さんの文法ミスの傾向を知りたいので以下のトピックについて英文を書いて下さい。出来るだけ長く書いてもらえるとより{nickname}さんの文法ミスの傾向を深く知り的確なアドバイスが出来ます。'
  }
};

interface TeacherMessageProps {
  teacher: 'hiroshi' | 'reiko' | 'iwao' | 'taro';
  nickname: string;
}

function TeacherMessage({ teacher, nickname }: TeacherMessageProps) {
  const info = teacherInfo[teacher];
  const message = info.introduction.replace(/\{nickname\}/g, nickname || '');

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

export default function GrammarPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { points, pointsUsedThisMonth, isLoading: pointsLoading, consumePoints, refreshPoints } = useUserPoints();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  const [topics, setTopics] = useState<string[]>([]);
  const [topicsEnglish, setTopicsEnglish] = useState<string[]>([]);
  const [topicsJapanese, setTopicsJapanese] = useState<string[]>([]);
  const [showJapaneseTopics, setShowJapaneseTopics] = useState(false);
  const [essay, setEssay] = useState('');
  const [grammarEntryId, setGrammarEntryId] = useState('');
  const [grammaticalErrors, setGrammaticalErrors] = useState<{category: string, count: number}[]>([]);
  const [isTopicGenerated, setIsTopicGenerated] = useState(false);
  const [isEssaySubmitted, setIsEssaySubmitted] = useState(false);
  const [isAnalysisCompleted, setIsAnalysisCompleted] = useState(false);
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState<{sender: 'user' | 'teacher', content: string, timestamp: string}[]>([]);
  const [userQuestion, setUserQuestion] = useState('');
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkProgressInterval, setCheckProgressInterval] = useState<NodeJS.Timeout | null>(null);
  const [isTeacherTyping, setIsTeacherTyping] = useState(false);
  
  const [showHistory, setShowHistory] = useState(false);
  const [grammarHistory, setGrammarHistory] = useState<GrammarEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 5;
  const [currentEntryTeacher, setCurrentEntryTeacher] = useState<'hiroshi' | 'reiko' | 'iwao' | 'taro'>('taro');
  
  const conversationEndRef = useRef<HTMLDivElement>(null);

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
        const preferredTeacher = userData.preferredTeacher || 'taro';
        
        setUserProfile({
          englishLevel: userData.englishLevel || 'beginner',
          nickname: userData.nickname || userData.name || '',
          preferredTeacher: preferredTeacher,
          points: points,
        });
        
        // Initialize the current entry teacher with the user's preferred teacher
        setCurrentEntryTeacher(preferredTeacher);
      }
    } catch (error) {
      // Error silently handled
      setIsLoading(false);
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

  // Scroll to bottom of conversation when new messages are added
  useEffect(() => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation]);

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
  const hasEnoughPoints = (action: 'TOPIC_GENERATION' | 'ANALYSIS' | 'QUESTION') => {
    if (pointsLoading || points === null) return false;
    
    switch (action) {
      case 'TOPIC_GENERATION':
        return points >= POINT_CONSUMPTION.GRAMMAR_TOPIC_GENERATION;
      case 'ANALYSIS':
        return points >= POINT_CONSUMPTION.GRAMMAR_ANALYSIS;
      case 'QUESTION':
        return points >= POINT_CONSUMPTION.GRAMMAR_CHECK;
      default:
        return false;
    }
  };

  const generateTopics = async () => {
    if (!hasEnoughPoints('TOPIC_GENERATION')) {
      setMessage('ポイントが足りません。');
      return;
    }

    setIsGeneratingTopics(true);
    setMessage('トピックを生成中... AIが処理しています');

    try {
      const response = await fetch('/api/grammar', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}) // Add empty JSON body to satisfy API expectations
      });

      // Read response data even if not OK to get error details
      const data = await response.json().catch(err => {
        return { error: "Could not parse server response" };
      });

      if (!response.ok) {
        let errorMessage = `トピックの生成に失敗しました: ${response.status} ${response.statusText}`;
        if (data.message) {
          errorMessage += ` - ${data.message}`;
        }
        
        throw new Error(errorMessage);
      }

      if (!data.topics || !Array.isArray(data.topics) || data.topics.length === 0) {
        throw new Error('サーバーから有効なトピックが返されませんでした');
      }
      
     
      
      // Store topics in state
      setTopics(data.topics);
      
      // For now, just use the same topics for both languages
      // In a real implementation, you might want to request translations
      setTopicsJapanese(data.topics);
      setTopicsEnglish(data.topics);
      
      // Set Japanese topics by default for beginner levels
      if (userProfile?.englishLevel === '超初級者' || userProfile?.englishLevel === '初級者') {
        setShowJapaneseTopics(true);
      }
      
      setIsTopicGenerated(true);
      setMessage(data.modelUsed === "fallback" 
        ? 'AIサーバーに問題が発生しています。基本的なトピックで練習を続けることができます。' 
        : `トピックが生成されました`);
      await refreshPoints();
    } catch (error: any) {
      setMessage(`トピックの生成に失敗しました。${error.message || 'しばらくしてからもう一度お試しください。'}`);
    } finally {
      setIsGeneratingTopics(false);
    }
  };

  const toggleTopicLanguage = () => {
    setShowJapaneseTopics(!showJapaneseTopics);
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if (isProcessing && grammarEntryId) {
      intervalId = setInterval(async () => {
        try {
          const response = await fetch(`/api/grammar/${grammarEntryId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.status === 'completed') {
              setIsProcessing(false);
              setIsAnalysisCompleted(true);
              setGrammaticalErrors(data.grammaticalErrors || []);
              setAnalysisResult({
                errors: data.errorDetails || []
              });
              // Add initial teacher message if conversation is empty
              if (!data.conversation || data.conversation.length === 0) {
                // This will be replaced by the proper teacher feedback from the API
                setConversation([{
                  sender: 'teacher',
                  content: "エッセイを分析しました。質問があればどうぞ。",
                  timestamp: new Date().toISOString()
                }]);
              } else {
                setConversation(data.conversation);
              }
              setMessage('エッセイの分析が完了しました');
              if (intervalId) clearInterval(intervalId);
            } else if (data.status === 'failed') {
              setIsProcessing(false);
              setMessage('エッセイの分析に失敗しました。もう一度お試しください。');
              if (intervalId) clearInterval(intervalId);
            }
          }
        } catch (error) {
          console.error("Error checking grammar analysis status:", error);
        }
      }, 3000); // Check every 3 seconds
      
      setCheckProgressInterval(intervalId);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isProcessing, grammarEntryId]);

  const handleSubmitEssay = async () => {
    if (!essay.trim()) {
      setMessage('エッセイを入力してください。');
      return;
    }

    if (!hasEnoughPoints('ANALYSIS')) {
      setMessage('ポイントが足りません。');
      return;
    }

    setIsSubmitting(true);
    setMessage('エッセイを送信中... 処理には数秒かかります');
    
    try {
      // Create a new grammar entry
      const response = await fetch('/api/grammar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topics,
          essay,
          grammaticalErrors: [],
          conversation: [],
          preferredTeacher: userProfile?.preferredTeacher || 'taro'
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to submit: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setGrammarEntryId(data._id);
      
      // Set current teacher from the user profile
      setCurrentEntryTeacher(userProfile?.preferredTeacher || 'taro');
      
      // Check the status and set up for progress tracking
      if (data.status === 'pending' || data.status === 'processing') {
        setIsProcessing(true);
        setIsEssaySubmitted(true);
        setMessage('エッセイを分析中... AIが処理しています');
      } else if (data.status === 'completed') {
        // If already completed, update state directly
        setGrammaticalErrors(data.grammaticalErrors || []);
        setAnalysisResult({
          errors: data.errorDetails || []
        });
        setConversation(data.conversation || [{
          sender: 'teacher',
          content: "エッセイを分析しました。質問があればどうぞ。",
          timestamp: new Date().toISOString()
        }]);
        setIsEssaySubmitted(true);
        setIsAnalysisCompleted(true);
        setMessage('エッセイの分析が完了しました');
      } else {
        throw new Error('サーバーからのレスポンスが無効です');
      }
      
      await refreshPoints();
    } catch (error: any) {
      setMessage(`エッセイの送信に失敗しました。${error.message || 'しばらくしてからもう一度お試しください。'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const askQuestion = async () => {
    if (!userQuestion.trim()) {
      setMessage('質問を入力してください。');
      return;
    }

    if (!hasEnoughPoints('QUESTION')) {
      setMessage('ポイントが足りません。');
      return;
    }

    setIsAskingQuestion(true);
    
    try {
      // Add user question to the conversation
      const updatedConversation = [
        ...conversation,
        {
          sender: 'user' as 'user' | 'teacher',
          content: userQuestion,
          timestamp: new Date().toISOString()
        }
      ];
      
      setConversation(updatedConversation);
      setUserQuestion('');
      
      // Show typing indicator after a short delay
      setTimeout(() => setIsTeacherTyping(true), 300);
      
      // Send the question to the API
      const response = await fetch(`/api/grammar`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userQuestion,
          grammarEntryId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to get response: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // The conversation will be updated asynchronously by the server
      setMessage('質問が送信されました。回答が生成されるのを待っています...');
      
      // Start polling for updates
      const checkInterval = setInterval(async () => {
        try {
          const checkResponse = await fetch(`/api/grammar/${grammarEntryId}`);
          if (checkResponse.ok) {
            const checkData = await checkResponse.json();
            
            // Check if we have more messages than we currently have locally
            if (checkData.conversation && checkData.conversation.length > updatedConversation.length) {
              clearInterval(checkInterval);
              setConversation(checkData.conversation);
              setMessage('');
              setIsTeacherTyping(false); // Hide typing indicator when response is received
            }
          }
        } catch (error) {
          console.error("Error checking for conversation updates:", error);
        }
      }, 2000);
      
      // Clear interval after 30 seconds as a fallback
      setTimeout(() => {
        if (checkInterval) clearInterval(checkInterval);
        setIsTeacherTyping(false); // Ensure typing indicator is hidden even if polling fails
      }, 30000);
      
      await refreshPoints();
    } catch (error: any) {
      setMessage(`質問の送信に失敗しました。${error.message || 'しばらくしてからもう一度お試しください。'}`);
      setIsTeacherTyping(false); // Hide typing indicator on error
    } finally {
      setIsAskingQuestion(false);
    }
  };

  const handleEssayChange = (value: string) => {
    setEssay(value);
    
    // Update word count
    const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
    setWordCount(wordCount);
  };

  const resetExercise = () => {
    setTopics([]);
    setEssay('');
    setWordCount(0);
    setGrammaticalErrors([]);
    setConversation([]);
    setGrammarEntryId('');
    setIsTopicGenerated(false);
    setIsEssaySubmitted(false);
    setIsAnalysisCompleted(false);
    setUserQuestion('');
    setAnalysisResult(null);
    setMessage('');
    // Reset to user's current preferred teacher
    setCurrentEntryTeacher(userProfile?.preferredTeacher || 'taro');
  };

  // Fetch grammar history
  const fetchGrammarHistory = useCallback(async () => {
    if (!session?.user?.id) return;
    
    setIsLoadingHistory(true);
    setCurrentPage(1); // Reset to page 1 when fetching new data
    
    try {
      const response = await fetch('/api/grammar');
      
      if (!response.ok) {
        throw new Error('Failed to fetch grammar history');
      }
      
      const data = await response.json();
      
      // Make sure we received an array
      if (Array.isArray(data)) {
        setGrammarHistory(data);
      } else {
        console.error('Expected array but got:', data);
        setGrammarHistory([]);
        setMessage('履歴データの形式が無効です。');
      }
    } catch (error) {
      console.error('Error fetching grammar history:', error);
      setGrammarHistory([]);
      setMessage('履歴の読み込みに失敗しました。');
    } finally {
      setIsLoadingHistory(false);
    }
  }, [session?.user?.id]);
  
  // Load history when toggle is clicked
  useEffect(() => {
    if (showHistory && grammarHistory.length === 0) {
      fetchGrammarHistory();
    }
  }, [showHistory, grammarHistory.length, fetchGrammarHistory]);
  
  const loadHistoryEntry = (entry: GrammarEntry) => {
    setTopics(entry.topics);
    setEssay(entry.essay);
    setGrammarEntryId(entry._id);
    setGrammaticalErrors(entry.grammaticalErrors || []);
    setConversation(entry.conversation || []);
    setIsEssaySubmitted(true);
    setIsAnalysisCompleted(true);
    setIsTopicGenerated(true);
    
    // Set the teacher from the entry
    setCurrentEntryTeacher(entry.preferredTeacher || 'taro');
    
    if (entry.errorDetails && entry.errorDetails.length > 0) {
      setAnalysisResult({
        errors: entry.errorDetails
      });
    }
  };

  if (isLoading || !userProfile) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">文法チェック</h1>
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">文法チェック</h1>
        <div className="flex items-center gap-4">
          <div className="text-sm">
            残りポイント: {renderPointsDisplay()}
          </div>
        </div>
      </div>
      
      {message && (
        <div className="p-3 mb-4 bg-blue-50 text-blue-700 rounded-md">
          {message}
        </div>
      )}
      
      {/* History section - always accessible */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-medium text-gray-900">過去の文法チェック</h2>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            {showHistory ? '履歴を隠す' : '履歴を表示する'}
          </button>
        </div>
        
        {showHistory && (
          <>
            {isLoadingHistory ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
              </div>
            ) : grammarHistory.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">まだ文法チェックの履歴はありません。</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Array.isArray(grammarHistory) && grammarHistory
                  .slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage)
                  .filter(entry => entry && typeof entry === 'object')
                  .map((entry) => (
                    <div 
                      key={entry._id || `entry-${Math.random()}`} 
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => loadHistoryEntry(entry)}
                    >
                      <div className="flex items-start">
                        <div className="flex-shrink-0 w-12 h-12 mr-4 relative">
                          <div className="absolute inset-0 rounded-full overflow-hidden">
                            <Image
                              src={teacherInfo[entry.preferredTeacher || 'taro'].image}
                              alt={teacherInfo[entry.preferredTeacher || 'taro'].name}
                              fill
                              style={{ objectFit: 'cover' }}
                            />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <h3 className="font-medium text-gray-900 text-lg">{entry.topics?.[0] || 'トピック名なし'}</h3>
                            <p className="text-xs text-gray-500">
                              {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '日付なし'}
                            </p>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2 mt-1">{entry.essay ? entry.essay.substring(0, 120) + '...' : '内容なし'}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {entry.grammaticalErrors && Array.isArray(entry.grammaticalErrors) && entry.grammaticalErrors.length > 0 ? (
                              entry.grammaticalErrors.slice(0, 3).map((error, i) => (
                                <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                                  {error?.category || '不明なエラー'}: {error?.count || 0}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                                エラーなし
                              </span>
                            )}
                            {entry.grammaticalErrors && Array.isArray(entry.grammaticalErrors) && entry.grammaticalErrors.length > 3 && (
                              <span className="text-xs text-gray-500">
                                +{entry.grammaticalErrors.length - 3}項目
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
            
            {Array.isArray(grammarHistory) && grammarHistory.length > entriesPerPage && (
              <div className="flex justify-center mt-6 space-x-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded-md hover:bg-gray-100 disabled:opacity-50"
                >
                  前へ
                </button>
                <span className="px-3 py-1">
                  {currentPage} / {Math.ceil(grammarHistory.length / entriesPerPage) || 1}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(grammarHistory.length / entriesPerPage) || 1, p + 1))}
                  disabled={currentPage >= (Math.ceil(grammarHistory.length / entriesPerPage) || 1)}
                  className="px-3 py-1 border rounded-md hover:bg-gray-100 disabled:opacity-50"
                >
                  次へ
                </button>
              </div>
            )}
          </>
        )}
      </div>
      
      {!isEssaySubmitted && (
        <TeacherMessage teacher={currentEntryTeacher} nickname={userProfile?.nickname || ''} />
      )}
      
      {!isTopicGenerated ? (
        <div className="mb-6">
          <button
            onClick={generateTopics}
            disabled={isGeneratingTopics || !hasEnoughPoints('TOPIC_GENERATION')}
            className={`px-4 py-2 rounded ${
              hasEnoughPoints('TOPIC_GENERATION') ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-500'
            } ${isGeneratingTopics ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isGeneratingTopics ? 'トピック生成中...' : 'ランダムトピックを生成'}
          </button>
          <p className="text-xs text-gray-500 mt-1">
            消費ポイント: {POINT_CONSUMPTION.GRAMMAR_TOPIC_GENERATION}
          </p>
          
          {isGeneratingTopics && (
            <div className="mt-8 flex flex-col items-center">
              <div className="animate-pulse flex space-x-4 mb-4">
                <div className="h-12 w-12 bg-blue-400 rounded-full animate-bounce"></div>
                <div className="h-12 w-12 bg-blue-500 rounded-full animate-bounce delay-100"></div>
                <div className="h-12 w-12 bg-blue-600 rounded-full animate-bounce delay-200"></div>
              </div>
              <p className="text-lg font-medium text-gray-700 mt-2">AIがトピックを生成中です・・・</p>
              <p className="text-sm text-gray-500 mt-1">少々お待ちください（30秒程度）</p>
              <p className="text-xs text-gray-400 mt-1">※ユーザーに合ったトピックを生成するので少し時間が掛かります</p>
            </div>
          )}
        </div>
      ) : !isEssaySubmitted ? (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-semibold">トピック</h2>
            <button 
              onClick={() => setShowJapaneseTopics(!showJapaneseTopics)}
              className="text-sm px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
            >
              {showJapaneseTopics ? '英語で表示' : '日本語で表示'}
            </button>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow mb-4">
            <p className="text-lg mb-2 font-medium">{topics[0]}</p>
          </div>
          
          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2">エッセイ</h3>
            <div className="flex justify-between text-sm text-gray-500 mb-1">
              <span>できるだけ詳しく書いてください (100-300単語程度)</span>
              <span>{wordCount} 単語</span>
            </div>
            <textarea
              value={essay}
              onChange={(e) => handleEssayChange(e.target.value)}
              className="w-full h-64 p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Write your essay here..."
            ></textarea>
          </div>
          
          <div className="flex justify-between">
            <button
              onClick={resetExercise}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              リセット
            </button>
            <div>
              <button
                onClick={handleSubmitEssay}
                disabled={isSubmitting || !essay.trim() || !hasEnoughPoints('ANALYSIS')}
                className={`px-4 py-2 rounded ${
                  hasEnoughPoints('ANALYSIS') && essay.trim() ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-500'
                } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSubmitting ? '送信中...' : 'エッセイを送信'}
              </button>
              <p className="text-xs text-gray-500 mt-1 text-right">
                消費ポイント: {POINT_CONSUMPTION.GRAMMAR_CHECK}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div>
          {isProcessing ? (
            <div className="my-8 flex flex-col items-center">
              <div className="animate-pulse flex space-x-4 mb-4">
                <div className="h-12 w-12 bg-blue-400 rounded-full animate-bounce"></div>
                <div className="h-12 w-12 bg-blue-500 rounded-full animate-bounce delay-100"></div>
                <div className="h-12 w-12 bg-blue-600 rounded-full animate-bounce delay-200"></div>
              </div>
              <p className="text-lg font-medium text-gray-700 mt-2">AIがエッセイを分析中です・・・</p>
              <p className="text-sm text-gray-500 mt-1">少々お待ちください（1分～2分程度）</p>
              <p className="text-xs text-gray-400 mt-1">AIがエッセイを細かく分析するので時間が掛かります</p>
            </div>
          ) : (
            <>
              {isAnalysisCompleted && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-3">文法エラーの分析</h2>
                    
                    {grammaticalErrors.length > 0 ? (
                      <div className="bg-white p-4 rounded-lg shadow mb-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {grammaticalErrors.map((error, index) => (
                            <div key={index} className="bg-blue-50 p-3 rounded-lg">
                              <h3 className="font-medium text-sm">{error.category}</h3>
                              <p className="text-gray-700 text-sm">回数: {error.count}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-green-50 p-4 rounded-lg mb-4">
                        <p className="text-green-700">文法エラーが見つかりませんでした。素晴らしい！</p>
                      </div>
                    )}
                    
                    <div className="mb-6">
                      <h3 className="text-lg font-medium mb-2">あなたのエッセイ</h3>
                      <div className="bg-white p-4 rounded-lg shadow">
                        {analysisResult && analysisResult.errors && analysisResult.errors.length > 0 ? (
                          <EssayWithErrors 
                            essay={essay} 
                            errors={(analysisResult.errors[0]?.errors || [])}
                          />
                        ) : (
                          <p className="whitespace-pre-wrap">{essay}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-3">先生とのやり取り</h2>
                    
                    <div className="bg-white p-4 rounded-lg shadow mb-4">
                      <div className="mb-4 max-h-96 overflow-y-auto">
                        {conversation.map((msg, index) => (
                          <div key={index} className={`mb-4 ${msg.sender === 'user' ? 'text-right' : ''}`}>
                            {msg.sender === 'teacher' && (
                              <div className="flex items-start mb-1">
                                <div className="flex-shrink-0 w-10 h-10 mr-2 relative">
                                  <div className="absolute inset-0 rounded-full overflow-hidden">
                                    <Image
                                      src={teacherInfo[currentEntryTeacher].image}
                                      alt={teacherInfo[currentEntryTeacher].name}
                                      fill
                                      style={{ objectFit: 'cover' }}
                                    />
                                  </div>
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                  {teacherInfo[currentEntryTeacher].name}
                                </div>
                              </div>
                            )}
                            <div className={`inline-block p-3 rounded-lg max-w-[80%] ${
                              msg.sender === 'user' ? 'bg-blue-100 text-blue-900' : 'bg-gray-100 text-gray-900'
                            }`}>
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                            <div className={`text-xs text-gray-500 mt-1 ${msg.sender === 'user' ? 'text-right' : ''}`}>
                              {new Date(msg.timestamp).toLocaleString()}
                            </div>
                          </div>
                        ))}
                        
                        {/* Typing indicator */}
                        {isTeacherTyping && (
                          <div className="flex items-start mb-4">
                            <div className="flex-shrink-0 w-10 h-10 mr-2 relative">
                              <div className="absolute inset-0 rounded-full overflow-hidden">
                                <Image
                                  src={teacherInfo[currentEntryTeacher].image}
                                  alt={teacherInfo[currentEntryTeacher].name}
                                  fill
                                  style={{ objectFit: 'cover' }}
                                />
                              </div>
                            </div>
                            <div className="inline-block p-3 rounded-lg bg-gray-100">
                              <div className="flex items-center">
                                <div className="flex space-x-1">
                                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '600ms' }}></div>
                                </div>
                                <span className="ml-2 text-sm text-gray-500">回答を作成中...</span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div ref={conversationEndRef} />
                      </div>
                      
                      <div className="flex flex-col">
                        <textarea
                          value={userQuestion}
                          onChange={(e) => setUserQuestion(e.target.value)}
                          placeholder="先生に文法について質問する..."
                          className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                          rows={3}
                        ></textarea>
                        <div className="self-end">
                          <button
                            onClick={askQuestion}
                            disabled={isAskingQuestion || !userQuestion.trim() || !hasEnoughPoints('QUESTION')}
                            className={`px-4 py-2 rounded ${
                              hasEnoughPoints('QUESTION') && userQuestion.trim() ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-500'
                            } ${isAskingQuestion ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {isAskingQuestion ? '送信中...' : '質問する'}
                          </button>
                          <p className="text-xs text-gray-500 mt-1 text-right">
                            消費ポイント: {POINT_CONSUMPTION.GRAMMAR_CHECK}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-center">
                    <button
                      onClick={resetExercise}
                      className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      新しいエッセイを書く
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
} 