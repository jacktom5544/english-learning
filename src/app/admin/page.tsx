'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type User = {
  _id: string;
  name: string;
  email: string;
  points: number;
  subscriptionStatus: 'inactive' | 'active' | 'cancelled';
  createdAt: string;
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState<{ id: string, points: number } | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(10);
  
  // Check if user is authenticated and is admin
  useEffect(() => {
    console.log('Admin page - session changed:', { 
      status, 
      userExists: !!session?.user,
      role: session?.user?.role 
    });
    
    if (session && session.user && session.user.role !== 'admin') {
      console.log('Redirecting non-admin user to dashboard');
      router.push('/dashboard');
    }
  }, [session, router]);

  // Fetch users when component mounts
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        console.log('Fetching users with session:', { 
          status, 
          userExists: !!session?.user,
          role: session?.user?.role 
        });
        
        const response = await fetch('/api/admin/users');
        if (!response.ok) {
          throw new Error('ユーザー情報の取得に失敗しました');
        }
        const data = await response.json();
        setUsers(data.users);
      } catch (err: any) {
        console.error('Error fetching users:', err);
        setError(err.message || 'ユーザー情報の取得中にエラーが発生しました');
      } finally {
        setIsLoading(false);
      }
    };

    if (session && session.user && session.user.role === 'admin') {
      fetchUsers();
    } else if (session && session.user) {
      // For debugging - fetch server-side session data
      const fetchDebugInfo = async () => {
        try {
          const response = await fetch('/api/debug/session');
          if (response.ok) {
            const data = await response.json();
            setDebugInfo(data);
          }
        } catch (error) {
          console.error('Error fetching debug info:', error);
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchDebugInfo();
    } else if (status === 'loading') {
      // Session is still loading, do nothing yet
    } else {
      // No session, set not loading
      setIsLoading(false);
    }
  }, [session, status]);

  const handlePointsChange = (userId: string, points: number) => {
    setEditingUser({ id: userId, points });
  };

  const savePoints = async (userId: string) => {
    if (!editingUser) return;
    
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ points: editingUser.points }),
      });
      
      if (!response.ok) {
        throw new Error('ポイントの更新に失敗しました');
      }
      
      // Update the user in the state
      setUsers(users.map(user => 
        user._id === userId 
          ? { ...user, points: editingUser.points } 
          : user
      ));
      
      setEditingUser(null);
    } catch (err: any) {
      setError(err.message || 'ポイントの更新中にエラーが発生しました');
    }
  };
  
  // Pagination logic
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(users.length / usersPerPage);
  
  // Change page
  const goToPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  if (!session || !session.user) {
    return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold text-red-600">ログインが必要です</h1>
        <p className="mt-4 text-gray-600">このページにアクセスするにはログインしてください。</p>
        <div className="mt-6">
          <Link href="/login" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            ログインページへ
          </Link>
        </div>
      </div>
    );
  }

  if (session.user.role !== 'admin') {
    return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold text-red-600">アクセス権限がありません</h1>
        <p className="mt-4 text-gray-600">このページは管理者のみがアクセスできます。</p>
        
        {/* Debugging information */}
        <div className="mt-8 max-w-2xl mx-auto p-4 bg-gray-100 rounded text-left">
          <h2 className="text-xl font-semibold mb-2">デバッグ情報</h2>
          <div className="bg-white p-4 rounded mb-4">
            <h3 className="font-medium mb-1">クライアントセッション:</h3>
            <pre className="text-xs overflow-auto bg-gray-50 p-2 rounded">
              {JSON.stringify({ role: session.user.role, id: session.user.id, email: session.user.email }, null, 2)}
            </pre>
          </div>
          
          {debugInfo && (
            <>
              <div className="bg-white p-4 rounded mb-4">
                <h3 className="font-medium mb-1">サーバートークン:</h3>
                <pre className="text-xs overflow-auto bg-gray-50 p-2 rounded">
                  {JSON.stringify(debugInfo.token, null, 2)}
                </pre>
              </div>
              
              <div className="bg-white p-4 rounded">
                <h3 className="font-medium mb-1">サーバーセッション:</h3>
                <pre className="text-xs overflow-auto bg-gray-50 p-2 rounded">
                  {JSON.stringify(debugInfo.session, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
        
        <div className="mt-6 space-x-4">
          <Link href="/dashboard" className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
            ダッシュボードへ戻る
          </Link>
          <Link href="/fix-admin-role" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            管理者権限を修正する
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold text-red-600">エラーが発生しました</h1>
        <p className="mt-4 text-gray-600">{error}</p>
        
        <div className="mt-6">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-8">管理ページ</h1>
      
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">ユーザー管理</h2>
        
        {users.length === 0 ? (
          <p className="text-gray-500">ユーザーが見つかりません</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名前</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">メールアドレス</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">サブスクリプション</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ポイント</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">アカウント作成日</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">アクション</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentUsers.map(user => (
                    <tr key={user._id}>
                      <td className="px-6 py-4 whitespace-nowrap">{user.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.subscriptionStatus === 'active' ? 'bg-green-100 text-green-800' : 
                          user.subscriptionStatus === 'cancelled' ? 'bg-red-100 text-red-800' : 
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {user.subscriptionStatus === 'active' ? 'アクティブ' : 
                          user.subscriptionStatus === 'cancelled' ? 'キャンセル' : 
                          '未購読'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingUser && editingUser.id === user._id ? (
                          <input
                            type="number"
                            min="0"
                            value={editingUser.points}
                            onChange={(e) => handlePointsChange(user._id, parseInt(e.target.value))}
                            className="border rounded px-2 py-1 w-24"
                          />
                        ) : (
                          user.points
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ja-JP', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        }) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingUser && editingUser.id === user._id ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => savePoints(user._id)}
                              className="text-green-600 hover:text-green-900"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingUser(null)}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              キャンセル
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handlePointsChange(user._id, user.points)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            編集
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-6 px-4">
                <div className="text-sm text-gray-700">
                  全 <span className="font-medium">{users.length}</span> 件中 
                  <span className="font-medium"> {indexOfFirstUser + 1}</span> - 
                  <span className="font-medium"> {Math.min(indexOfLastUser, users.length)}</span> 件を表示
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      currentPage === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    前へ
                  </button>
                  
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => goToPage(i + 1)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md ${
                        currentPage === i + 1
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      currentPage === totalPages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    次へ
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 