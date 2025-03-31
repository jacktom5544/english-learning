'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { EssayWithErrors } from '../components';

interface GrammarEntryProps {
  params: {
    id: string;
  };
}

type TeacherType = 'hiroshi' | 'reiko' | 'iwao' | 'taro';

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
  preferredTeacher: TeacherType;
  conversation: {
    sender: 'user' | 'teacher';
    content: string;
    timestamp: string;
  }[];
  createdAt: string;
}

// Define teacher info
const teacherInfo = {
  hiroshi: {
    name: 'ひろし先生',
    image: '/hiroshi.png'
  },
  reiko: {
    name: '玲子先生',
    image: '/reiko.png'
  },
  iwao: {
    name: '巌男先生',
    image: '/iwao.png'
  },
  taro: {
    name: '太郎先生',
    image: '/taro.png'
  }
};

export default function GrammarEntryPage({ params }: GrammarEntryProps) {
  const { id } = params;
  const { data: session } = useSession();
  const router = useRouter();
  
  const [isLoading, setIsLoading] = useState(true);
  const [grammarEntry, setGrammarEntry] = useState<GrammarEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) {
      router.push('/login');
      return;
    }

    async function fetchGrammarEntry() {
      try {
        const response = await fetch(`/api/grammar/${id}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch grammar entry: ${response.status}`);
        }
        
        const data = await response.json();
        setGrammarEntry(data);
      } catch (err) {
        console.error('Error fetching grammar entry:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchGrammarEntry();
  }, [id, session, router]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">文法チェック詳細</h1>
        <p>読み込み中...</p>
      </div>
    );
  }

  if (error || !grammarEntry) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">文法チェック詳細</h1>
        <p className="text-red-500">エラーが発生しました: {error || 'エントリーが見つかりません'}</p>
        <button 
          onClick={() => router.push('/grammar')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          文法チェック一覧に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">文法チェック詳細</h1>
        <button 
          onClick={() => router.push('/grammar')}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm"
        >
          一覧に戻る
        </button>
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">文法エラー分析</h2>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex flex-wrap gap-2">
            {grammarEntry.grammaticalErrors?.map((error, index) => (
              <div key={index} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm">
                {error.category} ({error.count})
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">提出したエッセイ</h2>
        {grammarEntry.essays.map((essay, index) => (
          <div key={index} className="mb-4 bg-white p-4 rounded-lg shadow">
            <h3 className="font-medium mb-2">エッセイ {index + 1}: {grammarEntry.topics[index]}</h3>
            {grammarEntry.errorDetails && grammarEntry.errorDetails[index] ? (
              <EssayWithErrors 
                essay={essay} 
                errors={grammarEntry.errorDetails[index]?.errors || []} 
              />
            ) : (
              <div className="whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-200">
                {essay}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">会話履歴</h2>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="h-80 overflow-y-auto p-4">
            {grammarEntry.conversation.map((message, index) => (
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
                          src={teacherInfo[grammarEntry.preferredTeacher].image}
                          alt={teacherInfo[grammarEntry.preferredTeacher].name}
                          fill
                          style={{ objectFit: 'cover' }}
                        />
                      </div>
                    </div>
                  )}
                  <span className="font-medium">
                    {message.sender === 'teacher' ? teacherInfo[grammarEntry.preferredTeacher].name : 'あなた'}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 