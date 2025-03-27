'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface QuizQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

interface QuizResult {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  userAnswer: number | null;
  isCorrect: boolean;
}

interface UserProfile {
  englishLevel: string;
  job: string;
  goal: string;
}

export default function QuizPage() {
  const { data: session } = useSession();
  const router = useRouter();
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
  const [markedVocabularies, setMarkedVocabularies] = useState<Record<number, boolean | null>>({});

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
        setIsLoading(false);

        // If profile is incomplete, show a message
        if (!userData.job || !userData.goal) {
          setMessage('より適切なクイズを生成するために、プロフィールで職業と目標を設定してください。');
        }
      } else {
        throw new Error('Failed to fetch user profile');
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      setMessage('プロフィールの取得に失敗しました。しばらくしてからもう一度お試しください。');
      setIsLoading(false);
    }
  };

  const generateQuiz = async () => {
    setIsGenerating(true);
    setMessage('');
    setQuizResults([]);
    setMarkedVocabularies({});

    try {
      console.log('Generating quiz...');
      const response = await fetch('/api/quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          englishLevel: userProfile?.englishLevel,
          job: userProfile?.job,
          goal: userProfile?.goal,
          count: 20, // Request 20 quiz questions
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Quiz generation failed:', errorData);
        throw new Error(errorData?.error || 'クイズの生成に失敗しました');
      }

      const quizData = await response.json();
      console.log('Quiz data received:', quizData);
      
      // Extract quiz ID from the response
      if (quizData._id) {
        setQuizId(quizData._id);
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
      
      setQuestions(quizQuestions);
      setCurrentQuestionIndex(0);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setQuizCompleted(false);
      setScore(0);
    } catch (error: any) {
      console.error('Failed to generate quiz:', error);
      setMessage(`クイズの生成に失敗しました。${error.message || 'しばらくしてからもう一度お試しください。'}`);
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
    setQuizResults([]);
    setMarkedVocabularies({});
    setQuizCompleted(false);
    generateQuiz();
  };

  const renderQuizContent = () => {
    if (questions.length === 0) {
      return (
        <div className="text-center py-10">
          <button
            onClick={generateQuiz}
            disabled={isGenerating}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isGenerating ? 'クイズを生成中...' : 'クイズを始める (20問)'}
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
                    </div>
                    <div className="ml-4 flex space-x-2">
                      {markedVocabularies[index] === undefined ? (
                        <>
                          <button
                            onClick={() => markVocabulary(index, true)}
                            className="px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700"
                          >
                            覚えた
                          </button>
                          <button
                            onClick={() => markVocabulary(index, false)}
                            className="px-3 py-1 bg-amber-600 text-white text-xs rounded-md hover:bg-amber-700"
                          >
                            すぐに忘れそう
                          </button>
                        </>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          markedVocabularies[index] 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {markedVocabularies[index] ? '覚えた' : 'すぐに忘れそう'}
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
              onClick={startNewQuiz}
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

  if (isLoading) {
    return <div className="text-center py-10">読み込み中...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">英単語クイズ</h1>
      <p className="text-gray-600">
        あなたの英語レベル、職業、目標に合わせた英単語クイズを生成します。20問のクイズに答えた後、結果を確認できます。
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