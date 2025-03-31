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
  essays: string[];
  errorDetails?: {
    essayIndex: number;
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
    introduction: '{nickname}はんの文法ミスの傾向を知りたいから以下の3つのトピックについて英文を書いてくれへん？出来るだけ長く書いてもらえるとより{nickname}はん向けの的確なアドバイスが出来るで！'
  },
  reiko: {
    name: '玲子先生',
    image: '/reiko.png',
    introduction: '{nickname}さんの文法ミスの傾向を知りたいので以下の3つのトピックについて英文を書いて下さいまし。出来るだけ長く書いてもらえるとより{nickname}さん向けの的確なアドバイスが出来ますわ！'
  },
  iwao: {
    name: '巌男先生',
    image: '/iwao.png',
    introduction: 'お前の文法ミスの傾向を知りたいから以下の3つのトピックについて英文を書いてくれ。出来るだけ長く書けばお前にとって的確なアドバイスが出来るぞ。'
  },
  taro: {
    name: '太郎先生',
    image: '/taro.png',
    introduction: '{nickname}さんの文法ミスの傾向を知りたいので以下の3つのトピックについて英文を書いて下さい。出来るだけ長く書いてもらえるとより{nickname}さんの文法ミスの傾向を深く知り的確なアドバイスが出来ます。'
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
  const [essays, setEssays] = useState<string[]>(['', '', '']);
  const [grammarEntryId, setGrammarEntryId] = useState('');
  const [grammaticalErrors, setGrammaticalErrors] = useState<{category: string, count: number}[]>([]);
  const [isTopicGenerated, setIsTopicGenerated] = useState(false);
  const [isEssaysSubmitted, setIsEssaysSubmitted] = useState(false);
  const [isAnalysisCompleted, setIsAnalysisCompleted] = useState(false);
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState<{sender: 'user' | 'teacher', content: string, timestamp: string}[]>([]);
  const [userQuestion, setUserQuestion] = useState('');
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  const [wordCounts, setWordCounts] = useState<number[]>([0, 0, 0]);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  
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

  const submitEssays = async () => {
    // Check word counts
    const invalidEssays = wordCounts.map((count, index) => 
      count < 20 || count > 1000 ? index : -1
    ).filter(index => index !== -1);

    if (invalidEssays.length > 0) {
      setMessage(`エッセイ ${invalidEssays.map(i => i + 1).join(', ')} は20単語以上、1000単語以下である必要があります。`);
      return;
    }

    if (!hasEnoughPoints('ANALYSIS')) {
      setMessage('ポイントが足りません。');
      return;
    }

    setIsSubmitting(true);
    setMessage('エッセイを分析中...');
    
   

    try {
      // First create a grammar entry
      
      const createResponse = await fetch('/api/grammar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topics,
          essays,
          grammaticalErrors: [],
          conversation: []
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        throw new Error(`Failed to create grammar entry: ${createResponse.status} ${createResponse.statusText}`);
      }

      const grammarEntry = await createResponse.json();
      
      setGrammarEntryId(grammarEntry._id);

      // Now analyze the essays
      
      const analysisResponse = await fetch('/api/grammar', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          essays,
          grammarEntryId: grammarEntry._id
        }),
      });

      
      
      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json().catch(() => ({}));
        throw new Error(`Failed to analyze essays: ${analysisResponse.status} ${analysisResponse.statusText}`);
      }

      const analysisResult = await analysisResponse.json();
      
      
      // Handle the different response structure from Deepseek
      if (!analysisResult.analysis && analysisResult.errorCategories && analysisResult.errors) {
        // Direct structure from Deepseek extraction
        setGrammaticalErrors(analysisResult.errorCategories || []);
        setAnalysisResult({
          analysis: {
            errorCategories: analysisResult.errorCategories || [],
            errors: analysisResult.errors || []
          },
          teacherFeedback: analysisResult.feedback || "エッセイを分析しました。"
        });
        
        // Add teacher feedback to conversation
        setConversation([{
          sender: 'teacher',
          content: analysisResult.feedback || "エッセイを分析しました。",
          timestamp: new Date().toISOString()
        }]);
      } else if (analysisResult.analysis && analysisResult.teacherFeedback) {
        // Original expected structure
        setGrammaticalErrors(analysisResult.analysis.errorCategories || []);
        setAnalysisResult(analysisResult);
        setConversation([{
          sender: 'teacher',
          content: analysisResult.teacherFeedback,
          timestamp: new Date().toISOString()
        }]);
      } else {
        throw new Error('Server returned invalid analysis format');
      }
      
      setIsEssaysSubmitted(true);
      setIsAnalysisCompleted(true);
      setMessage('エッセイの分析が完了しました');
      await refreshPoints();
    } catch (error: any) {
      setMessage(`エッセイの分析に失敗しました。${error.message || 'しばらくしてからもう一度お試しください。'}`);
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
      const response = await fetch(`/api/grammar/${grammarEntryId}/question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userQuestion,
          conversation: updatedConversation
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to get response: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Add teacher's response to the conversation
      setConversation([
        ...updatedConversation,
        {
          sender: 'teacher' as 'user' | 'teacher',
          content: data.response,
          timestamp: new Date().toISOString()
        }
      ]);
      
      await refreshPoints();
    } catch (error: any) {
      setMessage(`質問の送信に失敗しました。${error.message || 'しばらくしてからもう一度お試しください。'}`);
    } finally {
      setIsAskingQuestion(false);
    }
  };

  const handleEssayChange = (index: number, value: string) => {
    const newEssays = [...essays];
    newEssays[index] = value;
    setEssays(newEssays);
    
    // Update word count
    const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
    const newWordCounts = [...wordCounts];
    newWordCounts[index] = wordCount;
    setWordCounts(newWordCounts);
  };

  const resetExercise = () => {
    setTopics([]);
    setEssays(['', '', '']);
    setWordCounts([0, 0, 0]);
    setGrammaticalErrors([]);
    setConversation([]);
    setGrammarEntryId('');
    setIsTopicGenerated(false);
    setIsEssaysSubmitted(false);
    setIsAnalysisCompleted(false);
    setUserQuestion('');
  };

  // Function to filter out teacher introduction from feedback
  const filterTeacherIntroduction = (content: string) => {
    // Find the first paragraph break after any introduction text
    const introPatterns = [
      '文法ミスの傾向を知りたい',
      '英文を書いて',
      '出来るだけ長く書いて'
    ];
    
    if (introPatterns.some(pattern => content.includes(pattern))) {
      const paragraphBreak = content.indexOf('\n\n');
      if (paragraphBreak !== -1) {
        return content.substring(paragraphBreak + 2);
      }
    }
    
    return content;
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
      
      {!isEssaysSubmitted && (
        <TeacherMessage teacher={userProfile.preferredTeacher} nickname={userProfile.nickname} />
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
      ) : !isEssaysSubmitted ? (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">トピック (3つの中から好きなものを選んで英作文を書いてください)</h2>
            <button 
              onClick={toggleTopicLanguage}
              className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
            >
              {showJapaneseTopics ? '英語で表示する' : '日本語で表示する'}
            </button>
          </div>
          
          {topics.map((topic, index) => (
            <div key={index} className="mb-6">
              <div className="bg-white p-4 rounded-lg shadow mb-2">
                <p className="font-medium">{index + 1}. {topic}</p>
              </div>
              
              <div className="mb-1 flex justify-between">
                <label htmlFor={`essay-${index}`} className="block text-sm font-medium text-gray-700">
                  エッセイ {index + 1}
                </label>
                <span className={`text-sm ${wordCounts[index] < 20 ? 'text-red-500' : wordCounts[index] > 1000 ? 'text-red-500' : 'text-gray-500'}`}>
                  {wordCounts[index]} / 1000 単語
                </span>
              </div>
              
              <textarea
                id={`essay-${index}`}
                value={essays[index]}
                onChange={(e) => handleEssayChange(index, e.target.value)}
                className="w-full h-40 p-2 border rounded-md"
                placeholder={`このトピックについて英語で20単語以上、1000単語以内で書いてください`}
              />
            </div>
          ))}
          
          <button
            onClick={submitEssays}
            disabled={isSubmitting || !hasEnoughPoints('ANALYSIS')}
            className={`px-4 py-2 rounded ${
              hasEnoughPoints('ANALYSIS') ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-500'
            } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? '分析中...' : 'エッセイを提出して文法をチェック'}
          </button>
          <p className="text-xs text-gray-500 mt-1">
            消費ポイント: {POINT_CONSUMPTION.GRAMMAR_ANALYSIS}
          </p>
          
          {isSubmitting && (
            <div className="mt-8 flex flex-col items-center">
              <div className="animate-pulse flex space-x-4 mb-4">
                <div className="h-12 w-12 bg-blue-400 rounded-full animate-bounce"></div>
                <div className="h-12 w-12 bg-blue-500 rounded-full animate-bounce delay-100"></div>
                <div className="h-12 w-12 bg-blue-600 rounded-full animate-bounce delay-200"></div>
              </div>
              <p className="text-lg font-medium text-gray-700 mt-2">AIが文法を解析中です・・・</p>
              <p className="text-sm text-gray-500 mt-1">少々お待ちください</p>
            </div>
          )}
        </div>
      ) : (
        <div>
          {grammaticalErrors.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">文法エラー分析</h2>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex flex-wrap gap-2">
                  {grammaticalErrors.map((error, index) => (
                    <div key={index} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm">
                      {error.category} ({error.count})
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">提出したエッセイ</h2>
            {essays.map((essay, index) => (
              <div key={index} className="mb-4 bg-white p-4 rounded-lg shadow">
                <h3 className="font-medium mb-2">エッセイ {index + 1}: {topics[index]}</h3>
                {(() => {
                  const essayErrors = analysisResult?.analysis?.errors?.find(
                    (e: {essayIndex: number, errors: any[]}) => e.essayIndex === index
                  )?.errors || [];
                  
                  return analysisResult?.analysis?.errors ? (
                    <EssayWithErrors 
                      essay={essay} 
                      errors={essayErrors} 
                    />
                  ) : (
                    <div className="whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-200">
                      {essay}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
          
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">先生の説明</h2>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="h-80 overflow-y-auto p-4">
                {conversation.filter((msg, idx) => 
                  !(idx === 0 && msg.sender === 'teacher' && 
                    (msg.content.includes('文法ミスの傾向を知りたい') || 
                     msg.content.includes('英文を書いて下さい') ||
                     msg.content.includes('英文を書いてくれへん') ||
                     msg.content.includes('英文を書いてくれ')))
                ).map((message, index) => (
                  <div 
                    key={index} 
                    className={`mb-4 ${
                      message.sender === 'teacher' ? 'bg-blue-50 p-3 rounded-lg' : 'bg-gray-50 p-3 rounded-lg'
                    }`}
                  >
                    <div className="flex items-center mb-2">
                      {message.sender === 'teacher' && (
                        <div className="w-8 h-8 relative mr-2">
                          <div className="absolute inset-0 rounded-full overflow-hidden">
                            <Image
                              src={teacherInfo[userProfile.preferredTeacher].image}
                              alt={teacherInfo[userProfile.preferredTeacher].name}
                              fill
                              style={{ objectFit: 'cover' }}
                            />
                          </div>
                        </div>
                      )}
                      <span className="font-medium">
                        {message.sender === 'teacher' ? teacherInfo[userProfile.preferredTeacher].name : userProfile.nickname}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">
                      {message.sender === 'teacher' && index === 0 
                        ? filterTeacherIntroduction(message.content) 
                        : message.content}
                    </p>
                  </div>
                ))}
                <div ref={conversationEndRef} />
              </div>
              
              <div className="p-4 border-t">
                <div className="flex">
                  <input
                    type="text"
                    value={userQuestion}
                    onChange={(e) => setUserQuestion(e.target.value)}
                    disabled={isAskingQuestion}
                    placeholder="文法について質問してみましょう..."
                    className="flex-1 p-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={askQuestion}
                    disabled={isAskingQuestion || !userQuestion.trim() || !hasEnoughPoints('QUESTION')}
                    className={`px-4 py-2 rounded-r-md ${
                      hasEnoughPoints('QUESTION') ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-500'
                    } ${isAskingQuestion ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isAskingQuestion ? '送信中...' : '質問する'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  消費ポイント: {POINT_CONSUMPTION.GRAMMAR_CHECK}
                </p>
                
                {isAskingQuestion && (
                  <div className="mt-4 flex items-center justify-center">
                    <div className="animate-pulse flex space-x-2">
                      <div className="h-3 w-3 bg-blue-400 rounded-full animate-bounce"></div>
                      <div className="h-3 w-3 bg-blue-500 rounded-full animate-bounce delay-100"></div>
                      <div className="h-3 w-3 bg-blue-600 rounded-full animate-bounce delay-200"></div>
                    </div>
                    <span className="ml-2 text-sm text-gray-500">回答を作成中...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <button
            onClick={resetExercise}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded"
          >
            新しい練習を始める
          </button>
        </div>
      )}
    </div>
  );
} 