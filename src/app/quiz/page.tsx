'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { POINT_CONSUMPTION } from '@/lib/pointSystem';
import { useUserPoints } from '@/components/providers/UserPointsProvider';

interface QuizQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  exampleSentence: string;
}

interface QuizResult {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  exampleSentence: string;
  userAnswer: number | null;
  isCorrect: boolean;
}

interface UserProfile {
  id: string;
  username: string;
  points: number | null;
}

export default function QuizPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { points, pointsUsedThisMonth, isLoading: pointsLoading, consumePoints, refreshPoints } = useUserPoints();
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('');
  const [quizId, setQuizId] = useState<string | null>(null);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [markedVocabularies, setMarkedVocabularies] = useState<Record<number, boolean | undefined | null>>({});

  // Fetch user profile data
  const fetchUserProfile = useCallback(async () => {
    if (status !== 'authenticated') return;
    
    try {
      // Get basic profile info
      const response = await fetch('/api/users/profile');
      if (!response.ok) return;
      
      const profileData = await response.json();
      console.log('User profile data:', profileData);
      
      setUserProfile({
        id: profileData.id || session?.user?.id || '',
        username: profileData.username || profileData.email || session?.user?.email || '',
        points: points // Use points from the useUserPoints hook (can be null)
      });
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  }, [status, session, points]);

  // Handle initial loading
  useEffect(() => {
    if (status === 'authenticated') {
      fetchUserProfile();
      setIsLoading(false);
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [fetchUserProfile, status, router]);
  
  // Update profile when points change
  useEffect(() => {
    if (userProfile && points !== userProfile.points) {
      setUserProfile({
        ...userProfile,
        points: points
      });
    }
  }, [points, userProfile]);

  const generateQuiz = async () => {
    if (isGenerating || points === null) return;
    
    setIsGenerating(true);
    setMessage('');
    console.log('Starting quiz generation...');
    console.log('Current points:', points);
    
    try {
      // Consume points client-side first
      const pointsConsumed = await consumePoints(POINT_CONSUMPTION.QUIZ_START);
      
      if (!pointsConsumed) {
        setMessage(`ポイントが不足しています。現在のポイント: ${points}, 必要なポイント: ${POINT_CONSUMPTION.QUIZ_START}`);
        setIsGenerating(false);
        return;
      }
      
      console.log('Sending quiz generation request...');
      const response = await fetch('/api/quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          count: 10, // Request 10 quiz questions
          skipPointsConsumption: true, // Tell server we already consumed points
        }),
      });

      console.log('Quiz API response status:', response.status);
      
      const responseText = await response.text();
      console.log('Response text:', responseText);
      
      let quizData;
      try {
        quizData = JSON.parse(responseText);
      } catch (e) {
        throw new Error(responseText || 'Unknown error');
      }
      
      if (!response.ok) {
        console.error('Quiz generation failed:', quizData);
        
        // If server still reports insufficient points (unlikely since we checked client-side)
        if (response.status === 403) {
          setMessage(`ポイントが不足しています。${quizData.currentPoints !== undefined ? `現在のポイント: ${quizData.currentPoints}, 必要なポイント: ${quizData.requiredPoints || 1}` : ''}`);
          // Refresh points
          refreshPoints();
          setIsGenerating(false);
          return;
        }
        
        throw new Error(quizData?.error || 'クイズの生成に失敗しました');
      }

      // Extract quiz ID from the response
      if (quizData._id) {
        setQuizId(quizData._id);
        console.log('Quiz ID set:', quizData._id);
      }
      
      // Extract questions from the response
      let quizQuestions = [];
      if (quizData && quizData.questions && Array.isArray(quizData.questions)) {
        quizQuestions = quizData.questions;
      } else if (Array.isArray(quizData)) {
        quizQuestions = quizData;
      } else {
        console.error('Invalid quiz data format:', quizData);
        throw new Error('クイズデータが無効です');
      }
      
      if (quizQuestions.length === 0) {
        throw new Error('クイズの問題が含まれていません');
      }
      
      console.log('Setting questions state with', quizQuestions.length, 'questions');
      setQuestions(quizQuestions);
      setCurrentQuestionIndex(0);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setQuizCompleted(false);
      setScore(0);
      console.log('Quiz generation complete - state updated');
    } catch (error: any) {
      console.error('Failed to generate quiz:', error);
      setMessage(`クイズの生成に失敗しました。${error.message || 'しばらくしてからもう一度お試しください。'}`);
      // Refresh points after an error
      refreshPoints();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (isAnswered) return;
    
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;
    
    setSelectedAnswer(answerIndex);
    setIsAnswered(true);
    
    // Record the result
    const isCorrect = answerIndex === currentQuestion.correctIndex;
    
    // Update quiz results
    setQuizResults(prevResults => [
      ...prevResults,
      {
        ...currentQuestion,
        userAnswer: answerIndex,
        isCorrect,
      }
    ]);
    
    // If answer is correct, increment score
    if (isCorrect) {
      setScore(prevScore => prevScore + 1);
    }
  };

  const handleNextQuestion = () => {
    const nextIndex = currentQuestionIndex + 1;
    
    if (nextIndex < questions.length) {
      setCurrentQuestionIndex(nextIndex);
      setSelectedAnswer(null);
      setIsAnswered(false);
    } else {
      setQuizCompleted(true);
      // Save the quiz results if we have a quiz ID
      if (quizId) {
        saveQuizResults();
      }
    }
  };

  const saveQuizResults = async () => {
    if (!quizId) return;
    
    try {
      const response = await fetch(`/api/quiz/${quizId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          completed: true,
          score: score,
          results: quizResults,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Failed to save quiz results:', errorData);
      } else {
        console.log('Quiz results saved successfully');
      }
    } catch (error) {
      console.error('Error saving quiz results:', error);
    }
  };

  const markVocabulary = async (index: number, remembered: boolean) => {
    if (!session?.user?.id) return;
    
    const result = quizResults[index];
    if (!result) return;
    
    try {
      // Save the vocabulary to the database
      const response = await fetch('/api/quiz/vocabulary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          word: result.question,
          translation: result.choices[result.correctIndex],
          explanation: result.explanation,
          exampleSentence: result.exampleSentence || '',
          isRemembered: remembered,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to save vocabulary');
      }
      
      // Update marked vocabularies state
      setMarkedVocabularies(prev => ({
        ...prev,
        [index]: remembered
      }));
      
    } catch (error: any) {
      console.error('Failed to mark vocabulary:', error);
      setMessage(`単語の保存に失敗しました。${error.message || 'しばらくしてからもう一度お試しください。'}`);
    }
  };

  const startNewQuiz = () => {
    console.log('Starting new quiz...');
    // Reset all quiz-related state completely
    setQuizResults([]);
    setMarkedVocabularies({});
    setQuizCompleted(false);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setScore(0);
    setQuestions([]);
    setQuizId(null);
    setMessage('');
    
    // Call generateQuiz after a short delay to ensure state is reset
    setTimeout(() => {
      generateQuiz();
    }, 100);
  };

  const renderQuizContent = () => {
    if (questions.length === 0) {
      return (
        <div className="text-center py-10">
          <h1 className="text-3xl font-bold mb-6">英語クイズチャレンジ</h1>
          <p className="mb-8 text-gray-700">
            日常会話や基本的な表現から、文法、語彙などをカバーする多彩なクイズに挑戦して、
            <br />
            英語力を楽しく向上させましょう。
          </p>
          
          <div className="mb-4">
            <div className="inline-flex items-center px-3 py-1 bg-blue-50 border border-blue-200 text-blue-600 rounded-full mb-4">
              <span>現在のポイント: <span className="font-semibold">
                {pointsLoading || points === null ? "..." : points}
              </span></span>
              <button 
                onClick={refreshPoints}
                className="ml-2 text-xs text-blue-600 hover:text-blue-800"
                title="ポイントを更新"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
          
          {!pointsLoading && points !== null && points < POINT_CONSUMPTION.QUIZ_START && (
            <div className="text-yellow-700 bg-yellow-50 border border-yellow-200 px-4 py-3 rounded">
              ポイントが不足しています。必要なポイント: {POINT_CONSUMPTION.QUIZ_START}, 現在のポイント: {points}
            </div>
          )}
          
          <button
            onClick={generateQuiz}
            disabled={isGenerating || pointsLoading || points === null || points < POINT_CONSUMPTION.QUIZ_START}
            className={`px-8 py-3 rounded-lg font-medium text-white ${
              isGenerating || pointsLoading || points === null || points < POINT_CONSUMPTION.QUIZ_START
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            } transition-colors`}
          >
            {isGenerating ? 'クイズを作成中...' : 
             pointsLoading || points === null ? 'ポイントを読み込み中...' :
             points < POINT_CONSUMPTION.QUIZ_START ? 'ポイントが不足しています' : 'クイズを始める'}
          </button>
          
          {isGenerating && (
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
          
          {message && !isGenerating && (
            <div className="mt-4 text-sm text-amber-600">{message}</div>
          )}
        </div>
      );
    }

    if (quizCompleted) {
      return (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">クイズ完了！</h2>
            <p className="text-xl mb-4">あなたのスコア: {score} / {questions.length}</p>
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">結果一覧</h3>
            <div className="space-y-4">
              {quizResults.map((result, index) => (
                <div 
                  key={index} 
                  className={`p-4 rounded-lg border ${
                    result.isCorrect 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium">{index + 1}. {result.question}</p>
                      <p className="text-gray-700 mt-1">
                        正解: {result.choices[result.correctIndex]}
                      </p>
                      {!result.isCorrect && result.userAnswer !== null && (
                        <p className="text-red-600 mt-1">
                          あなたの回答: {result.choices[result.userAnswer]}
                        </p>
                      )}
                      <p className="text-gray-600 text-sm mt-2">{result.explanation}</p>
                      {result.exampleSentence && (
                        <p className="text-gray-600 text-sm mt-2 italic">例文: {result.exampleSentence}</p>
                      )}
                    </div>
                    <div className="ml-4 flex space-x-2">
                      {markedVocabularies[index] === undefined ? (
                        <>
                          <button
                            onClick={() => markVocabulary(index, true)}
                            className="px-3 py-2 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 cursor-pointer"
                          >
                            覚えた
                          </button>
                          <button
                            onClick={() => markVocabulary(index, false)}
                            className="px-3 py-2 bg-amber-600 text-white text-xs rounded-md hover:bg-amber-700 cursor-pointer"
                          >
                            すぐに忘れそう
                          </button>
                        </>
                      ) : (
                        <span className={`inline-flex items-center px-3 py-2 rounded-full text-xs font-medium ${
                          markedVocabularies[index] === true
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {markedVocabularies[index] === true ? '覚えた' : 'すぐに忘れそう'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-center">
            <button
              onClick={() => {
                console.log('New quiz button clicked');
                startNewQuiz();
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              新しいクイズを始める
            </button>
          </div>
        </div>
      );
    }

    // Get the current question
    const currentQuestion = currentQuestionIndex < questions.length ? questions[currentQuestionIndex] : null;
    
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-6">
          <div className="text-sm text-gray-500 mb-1">問題 {currentQuestionIndex + 1} / {questions.length}</div>
          <h2 className="text-xl font-bold">{currentQuestion?.question}</h2>
        </div>

        <div className="space-y-3 mb-6">
          {currentQuestion?.choices.map((choice, index) => (
            <button
              key={index}
              onClick={() => handleAnswerSelect(index)}
              disabled={isAnswered}
              className={`w-full text-left p-3 rounded-md border ${
                isAnswered
                  ? index === currentQuestion.correctIndex
                    ? 'bg-green-100 border-green-500'
                    : selectedAnswer === index
                    ? 'bg-red-100 border-red-500'
                    : 'border-gray-300'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {choice}
            </button>
          ))}
        </div>

        {isAnswered && currentQuestion && (
          <div className="mb-6 p-4 bg-gray-50 rounded-md">
            <p className="font-medium">解説:</p>
            <p>{currentQuestion.explanation}</p>
            {currentQuestion.exampleSentence && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="font-medium">例文:</p>
                <p className="italic">{currentQuestion.exampleSentence}</p>
              </div>
            )}
          </div>
        )}

        {isAnswered && (
          <div className="flex justify-between">
            <div></div>
            <button
              onClick={handleNextQuestion}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              次の問題へ
            </button>
          </div>
        )}
      </div>
    );
  };

  if (status === 'loading') {
    return <div className="text-center py-10">読み込み中...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">英単語クイズ</h1>
      <p className="text-gray-600">
        あなたの英語レベル、職業、目標に合わせた英単語クイズを生成します。10問のクイズに答えた後、結果を確認できます。
      </p>
      {message && (
        <div className="bg-amber-50 border border-amber-400 text-amber-700 px-4 py-3 rounded">
          {message}
        </div>
      )}
      {renderQuizContent()}
    </div>
  );
} 