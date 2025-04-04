'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { POINT_CONSUMPTION } from '@/lib/pointSystem';
import { useUserPoints } from '@/components/providers/UserPointsProvider';
import { EssayWithErrors } from './components';

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
        setUserProfile({
          englishLevel: userData.englishLevel || 'beginner',
          nickname: userData.nickname || userData.name || '',
          preferredTeacher: userData.preferredTeacher || 'taro',
          points: points,
        });
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
          conversation: []
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to submit: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setGrammarEntryId(data._id);
      
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
            }
          }
        } catch (error) {
          console.error("Error checking for conversation updates:", error);
        }
      }, 2000);
      
      // Clear interval after 30 seconds as a fallback
      setTimeout(() => {
        if (checkInterval) clearInterval(checkInterval);
      }, 30000);
      
      await refreshPoints();
    } catch (error: any) {
      setMessage(`質問の送信に失敗しました。${error.message || 'しばらくしてからもう一度お試しください。'}`);
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
        <div className="text-sm">
          残りポイント: {renderPointsDisplay()}
        </div>
      </div>
      
      {message && (
        <div className="p-3 mb-4 bg-blue-50 text-blue-700 rounded-md">
          {message}
        </div>
      )}
      
      {!isEssaySubmitted && (
        <TeacherMessage teacher={userProfile?.preferredTeacher || 'taro'} nickname={userProfile?.nickname || ''} />
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
              <p className="text-sm text-gray-500 mt-1">少々お待ちください（数秒～30秒程度）</p>
              <p className="text-xs text-gray-400 mt-1">タイムアウトした場合は、再度試してみてください</p>
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
              <p className="text-sm text-gray-500 mt-1">少々お待ちください（数秒～30秒程度）</p>
              <p className="text-xs text-gray-400 mt-1">タイムアウトしても裏でAIが処理を継続しています。数分後に再度確認してください。</p>
            </div>
          ) : (
            <>
              {isAnalysisCompleted && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-3">文法エラーの分析</h2>
                    
                    {grammaticalErrors.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        {grammaticalErrors.map((error, index) => (
                          <div key={index} className="bg-white p-4 rounded-lg shadow">
                            <h3 className="font-medium text-lg">{error.category}</h3>
                            <p className="text-gray-700">エラー回数: {error.count}</p>
                          </div>
                        ))}
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