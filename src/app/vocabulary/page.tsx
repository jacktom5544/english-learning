'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface VocabularyItem {
  _id: string;
  word: string;
  translation: string;
  explanation: string;
  isRemembered: boolean;
  createdAt: string;
}

interface GeneratedVocabularyItem {
  word: string;
  translation: string;
  explanation: string;
  isRemembered: boolean;
}

export default function VocabularyPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [vocabularies, setVocabularies] = useState<VocabularyItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'remembered' | 'not-remembered'>('all');
  const [message, setMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVocabulary, setGeneratedVocabulary] = useState<GeneratedVocabularyItem[]>([]);
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(10);
  const [showGenerateForm, setShowGenerateForm] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      fetchVocabularies();
    } else {
      router.push('/login');
    }
  }, [session, router]);

  const fetchVocabularies = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      let url = '/api/vocabulary';
      if (filter !== 'all') {
        url += `?filter=${filter}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch vocabularies');
      }
      
      const data = await response.json();
      setVocabularies(data);
    } catch (error) {
      console.error('Failed to fetch vocabularies:', error);
      setMessage('単語データの取得に失敗しました。しばらくしてからもう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetchVocabularies();
    }
  }, [filter, session?.user?.id]);

  const toggleVocabularyStatus = async (id: string, currentStatus: boolean) => {
    try {
      // Update UI immediately for better user experience
      const updatedVocabularies = vocabularies.map(vocab => {
        if (vocab._id === id) {
          return { ...vocab, isRemembered: !currentStatus };
        }
        return vocab;
      });

      setVocabularies(updatedVocabularies);

      // Then update in the database
      const response = await fetch(`/api/vocabulary/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isRemembered: !currentStatus,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update vocabulary status');
      }
      
      // We could refresh the data from the server here if needed
      // fetchVocabularies();
    } catch (error) {
      console.error('Failed to toggle vocabulary status:', error);
      setMessage('ステータスの更新に失敗しました。しばらくしてからもう一度お試しください。');
      
      // Revert the UI change if the API call failed
      fetchVocabularies();
    }
  };

  const generateVocabulary = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setGeneratedVocabulary([]);
    setMessage('');

    try {
      const response = await fetch('/api/vocabulary/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic,
          count,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'ボキャブラリーの生成に失敗しました');
      }

      const data = await response.json();
      setGeneratedVocabulary(data.vocabulary);
    } catch (error: any) {
      console.error('Failed to generate vocabulary:', error);
      setMessage(`ボキャブラリーの生成に失敗しました: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveGeneratedVocabulary = async (vocabulary: GeneratedVocabularyItem) => {
    try {
      const response = await fetch('/api/vocabulary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          word: vocabulary.word,
          translation: vocabulary.translation,
          explanation: vocabulary.explanation,
          isRemembered: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save vocabulary');
      }

      // Remove from generated list
      setGeneratedVocabulary(prev => prev.filter(item => item.word !== vocabulary.word));
      
      // Refresh the vocabulary list
      fetchVocabularies();
      
      // Show success message
      setMessage(`「${vocabulary.word}」を保存しました`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Failed to save vocabulary:', error);
      setMessage('ボキャブラリーの保存に失敗しました。しばらくしてからもう一度お試しください。');
    }
  };

  const saveAllGeneratedVocabulary = async () => {
    if (generatedVocabulary.length === 0) return;
    
    setIsLoading(true);
    let savedCount = 0;
    
    try {
      for (const vocabulary of generatedVocabulary) {
        const response = await fetch('/api/vocabulary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            word: vocabulary.word,
            translation: vocabulary.translation,
            explanation: vocabulary.explanation,
            isRemembered: false,
          }),
        });
        
        if (response.ok) {
          savedCount++;
        }
      }
      
      // Clear the generated list
      setGeneratedVocabulary([]);
      
      // Refresh the vocabulary list
      fetchVocabularies();
      
      // Show success message
      setMessage(`${savedCount}個の単語を保存しました`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Failed to save vocabularies:', error);
      setMessage('一部のボキャブラリーの保存に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-10">読み込み中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">単語帳</h1>

        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-2 text-sm font-medium rounded-md ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            すべて ({vocabularies.length})
          </button>
          <button
            onClick={() => setFilter('remembered')}
            className={`px-3 py-2 text-sm font-medium rounded-md ${
              filter === 'remembered'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            覚えた ({vocabularies.filter(v => v.isRemembered).length})
          </button>
          <button
            onClick={() => setFilter('not-remembered')}
            className={`px-3 py-2 text-sm font-medium rounded-md ${
              filter === 'not-remembered'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            すぐに忘れそう ({vocabularies.filter(v => !v.isRemembered).length})
          </button>
        </div>
      </div>

      {message && (
        <div className="bg-amber-50 border border-amber-400 text-amber-700 px-4 py-3 rounded">
          {message}
        </div>
      )}

      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowGenerateForm(!showGenerateForm)}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          {showGenerateForm ? '生成フォームを隠す' : 'ボキャブラリーを生成する'}
        </button>
      </div>

      {showGenerateForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">ボキャブラリー生成</h2>
          
          <form onSubmit={generateVocabulary} className="space-y-4">
            <div>
              <label htmlFor="topic" className="block text-sm font-medium text-gray-700">
                トピック
              </label>
              <input
                type="text"
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="ビジネス、旅行、医療など"
                required
              />
            </div>
            
            <div>
              <label htmlFor="count" className="block text-sm font-medium text-gray-700">
                生成する単語数
              </label>
              <input
                type="number"
                id="count"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value))}
                min="1"
                max="20"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            
            <div className="pt-2">
              <button
                type="submit"
                disabled={isGenerating}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isGenerating ? '生成中...' : 'ボキャブラリーを生成'}
              </button>
            </div>
          </form>
          
          {generatedVocabulary.length > 0 && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">生成されたボキャブラリー</h3>
                <button
                  onClick={saveAllGeneratedVocabulary}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                >
                  すべて保存
                </button>
              </div>
              
              <div className="bg-gray-50 rounded-md p-4 space-y-4">
                {generatedVocabulary.map((vocabulary, index) => (
                  <div key={index} className="border-b pb-3 last:border-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold">{vocabulary.word}</h4>
                        <p className="text-gray-700">{vocabulary.translation}</p>
                        {vocabulary.explanation && (
                          <p className="text-gray-500 text-sm mt-1">{vocabulary.explanation}</p>
                        )}
                      </div>
                      <button
                        onClick={() => saveGeneratedVocabulary(vocabulary)}
                        className="px-2 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {vocabularies.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
          単語データがありません。クイズに参加して単語を追加しましょう。
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  英単語
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  日本語
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  解説
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  アクション
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vocabularies.map((vocabulary) => (
                <tr key={vocabulary._id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {vocabulary.word}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {vocabulary.translation}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {vocabulary.explanation}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        vocabulary.isRemembered
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {vocabulary.isRemembered ? '覚えた' : 'すぐに忘れそう'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => toggleVocabularyStatus(vocabulary._id, vocabulary.isRemembered)}
                      className={`px-3 py-1 rounded text-xs ${
                        vocabulary.isRemembered
                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          : 'bg-green-100 text-green-800 hover:bg-green-200'
                      }`}
                    >
                      {vocabulary.isRemembered ? 'すぐに忘れそうにする' : '覚えたとマーク'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 