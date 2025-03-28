'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface VocabularyItem {
  _id: string;
  word: string;
  translation: string;
  explanation: string;
  exampleSentence?: string;
  isRemembered: boolean;
  createdAt: string;
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface VocabularyCounts {
  all: number;
  remembered: number;
  notRemembered: number;
}

export default function VocabularyPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [vocabularies, setVocabularies] = useState<VocabularyItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'remembered' | 'not-remembered'>('all');
  const [message, setMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0
  });
  const [counts, setCounts] = useState<VocabularyCounts>({
    all: 0,
    remembered: 0,
    notRemembered: 0
  });

  useEffect(() => {
    if (session?.user?.id) {
      fetchVocabularies(currentPage);
    } else {
      router.push('/login');
    }
  }, [session, router, currentPage, filter]);

  // Separate useEffect for fetching counts - only when session changes
  useEffect(() => {
    if (session?.user?.id) {
      fetchCounts();
    }
  }, [session]);

  const fetchCounts = async () => {
    try {
      const response = await fetch('/api/vocabulary/counts');
      
      if (!response.ok) {
        throw new Error('Failed to fetch vocabulary counts');
      }
      
      const data = await response.json();
      setCounts({
        all: data.all,
        remembered: data.remembered,
        notRemembered: data.notRemembered
      });
    } catch (error) {
      console.error('Failed to fetch vocabulary counts:', error);
    }
  };

  const fetchVocabularies = async (page: number = 1) => {
    setIsLoading(true);
    setMessage('');

    try {
      let url = `/api/vocabulary?page=${page}&limit=10`;
      if (filter !== 'all') {
        url += `&filter=${filter}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch vocabularies');
      }
      
      const data = await response.json();
      setVocabularies(data.vocabularies);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to fetch vocabularies:', error);
      setMessage('単語データの取得に失敗しました。しばらくしてからもう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setCurrentPage(newPage);
    }
  };

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
      
      // Refetch counts after status update
      fetchCounts();
    } catch (error) {
      console.error('Failed to toggle vocabulary status:', error);
      setMessage('ステータスの更新に失敗しました。しばらくしてからもう一度お試しください。');
      
      // Revert the UI change if the API call failed
      fetchVocabularies(currentPage);
    }
  };

  // Function to generate pagination buttons
  const renderPagination = () => {
    if (pagination.totalPages <= 1) return null;

    const pageButtons = [];
    const maxButtonsToShow = 5; // Adjust based on your design preference
    
    let startPage = Math.max(1, currentPage - Math.floor(maxButtonsToShow / 2));
    let endPage = Math.min(pagination.totalPages, startPage + maxButtonsToShow - 1);
    
    // Adjust startPage if we're near the end
    if (endPage === pagination.totalPages) {
      startPage = Math.max(1, endPage - maxButtonsToShow + 1);
    }
    
    // Previous button
    pageButtons.push(
      <button
        key="prev"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1 rounded border text-sm disabled:opacity-50"
        aria-label="前のページ"
      >
        ←
      </button>
    );
    
    // First page button if not starting from page 1
    if (startPage > 1) {
      pageButtons.push(
        <button
          key="1"
          onClick={() => handlePageChange(1)}
          className="px-3 py-1 rounded border text-sm"
        >
          1
        </button>
      );
      
      // Ellipsis if there's a gap
      if (startPage > 2) {
        pageButtons.push(
          <span key="start-ellipsis" className="px-2">...</span>
        );
      }
    }
    
    // Page number buttons
    for (let i = startPage; i <= endPage; i++) {
      pageButtons.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`px-3 py-1 rounded border text-sm ${
            currentPage === i ? 'bg-blue-600 text-white' : ''
          }`}
        >
          {i}
        </button>
      );
    }
    
    // Last page button if not ending at the last page
    if (endPage < pagination.totalPages) {
      // Ellipsis if there's a gap
      if (endPage < pagination.totalPages - 1) {
        pageButtons.push(
          <span key="end-ellipsis" className="px-2">...</span>
        );
      }
      
      pageButtons.push(
        <button
          key={pagination.totalPages}
          onClick={() => handlePageChange(pagination.totalPages)}
          className="px-3 py-1 rounded border text-sm"
        >
          {pagination.totalPages}
        </button>
      );
    }
    
    // Next button
    pageButtons.push(
      <button
        key="next"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === pagination.totalPages}
        className="px-3 py-1 rounded border text-sm disabled:opacity-50"
        aria-label="次のページ"
      >
        →
      </button>
    );
    
    return (
      <div className="flex justify-center mt-6 space-x-2">
        {pageButtons}
      </div>
    );
  };

  if (isLoading) {
    return <div className="text-center py-10">読み込み中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <h1 className="text-2xl font-bold">単語帳</h1>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {setFilter('all'); setCurrentPage(1);}}
            className={`px-3 py-2 text-sm font-medium rounded-md ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            すべて ({counts.all})
          </button>
          <button
            onClick={() => {setFilter('remembered'); setCurrentPage(1);}}
            className={`px-3 py-2 text-sm font-medium rounded-md ${
              filter === 'remembered'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            覚えた ({counts.remembered})
          </button>
          <button
            onClick={() => {setFilter('not-remembered'); setCurrentPage(1);}}
            className={`px-3 py-2 text-sm font-medium rounded-md ${
              filter === 'not-remembered'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            すぐに忘れそう ({counts.notRemembered})
          </button>
        </div>
      </div>

      {message && (
        <div className="bg-amber-50 border border-amber-400 text-amber-700 px-4 py-3 rounded">
          {message}
        </div>
      )}

      {vocabularies.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
          単語データがありません。クイズに参加して単語を追加しましょう。
        </div>
      ) : (
        <>
          {/* Desktop View - Table */}
          <div className="hidden md:block bg-white shadow rounded-lg overflow-hidden">
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
                    例文
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
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {vocabulary.word}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {vocabulary.translation}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {vocabulary.explanation}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {vocabulary.exampleSentence ? (
                        <p className="italic">{vocabulary.exampleSentence}</p>
                      ) : (
                        <p className="text-gray-400">例文なし</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
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
                    <td className="px-6 py-4 text-right text-sm font-medium">
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

          {/* Mobile View - Cards */}
          <div className="md:hidden space-y-4">
            {vocabularies.map((vocabulary) => (
              <div key={vocabulary._id} className="bg-white shadow rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-medium">{vocabulary.word}</h3>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      vocabulary.isRemembered
                        ? 'bg-green-100 text-green-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {vocabulary.isRemembered ? '覚えた' : 'すぐに忘れそう'}
                  </span>
                </div>
                
                <div className="space-y-2 mb-4">
                  <p className="text-sm"><span className="font-medium">日本語:</span> {vocabulary.translation}</p>
                  <p className="text-sm"><span className="font-medium">解説:</span> {vocabulary.explanation}</p>
                  {vocabulary.exampleSentence ? (
                    <p className="text-sm"><span className="font-medium">例文:</span> <span className="italic">{vocabulary.exampleSentence}</span></p>
                  ) : (
                    <p className="text-sm"><span className="font-medium">例文:</span> <span className="text-gray-400">例文なし</span></p>
                  )}
                </div>
                
                <button
                  onClick={() => toggleVocabularyStatus(vocabulary._id, vocabulary.isRemembered)}
                  className={`w-full px-3 py-2 rounded text-sm text-center ${
                    vocabulary.isRemembered
                      ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                  }`}
                >
                  {vocabulary.isRemembered ? 'すぐに忘れそうにする' : '覚えたとマーク'}
                </button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {renderPagination()}
        </>
      )}
    </div>
  );
} 