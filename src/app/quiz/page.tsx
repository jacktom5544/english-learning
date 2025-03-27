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
    
    // If answer is correct, increment score
    if (answerIndex === currentQuestion.correctIndex) {
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

  const markVocabulary = async (remembered: boolean) => {
    if (!session?.user?.id || currentQuestionIndex >= questions.length) return;
    
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;
    
    try {
      // Save the vocabulary to the database
      const response = await fetch('/api/quiz/vocabulary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          word: currentQuestion.question,
          translation: currentQuestion.choices[currentQuestion.correctIndex],
          explanation: currentQuestion.explanation,
          isRemembered: remembered,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to save vocabulary');
      }
      
      // Go to next question
      handleNextQuestion();
    } catch (error: any) {
      console.error('Failed to mark vocabulary:', error);
      setMessage(`単語の保存に失敗しました。${error.message || 'しばらくしてからもう一度お試しください。'}`);
    }
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
            {isGenerating ? 'クイズを生成中...' : 'クイズを始める'}
          </button>
          {message && (
            <div className="mt-4 text-sm text-amber-600">{message}</div>
          )}
        </div>
      );
    }

    if (quizCompleted) {
      return (
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <h2 className="text-2xl font-bold mb-4">クイズ完了！</h2>
          <p className="text-xl mb-4">あなたのスコア: {score} / {questions.length}</p>
          <button
            onClick={generateQuiz}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            新しいクイズを始める
          </button>
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
            <div className="space-x-3">
              <button
                onClick={() => markVocabulary(true)}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                覚えた
              </button>
              <button
                onClick={() => markVocabulary(false)}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
              >
                すぐに忘れそう
              </button>
            </div>
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
        あなたの英語レベル、職業、目標に合わせた英単語クイズを生成します。
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