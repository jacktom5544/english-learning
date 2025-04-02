'use client';

import Link from 'next/link';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  points: number;
  subscriptionStatus: string;
}

interface DashboardUIProps {
  user: User;
}

export default function DashboardUI({ user }: DashboardUIProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
      
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            ようこそ、{user.name}さん！
          </h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>
              English Learning へようこそ。プロフィールを完成させて、英語学習を始めましょう。
            </p>
          </div>
          <div className="mt-3 border-t border-gray-100 pt-3">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">ユーザータイプ</dt>
                <dd className="mt-1 text-sm text-gray-900">{user.role}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">ポイント</dt>
                <dd className="mt-1 text-sm text-gray-900">{user.points}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">サブスクリプション</dt>
                <dd className="mt-1 text-sm text-gray-900">{user.subscriptionStatus}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">クイズに挑戦</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>英語レベルに合ったクイズで語彙力を高めましょう。</p>
            </div>
            <div className="mt-5">
              <Link
                href="/quiz"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                クイズスタート
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">単語帳</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>学習した単語を管理して、効率的に復習しましょう。</p>
            </div>
            <div className="mt-5">
              <Link
                href="/vocabulary"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                単語管理
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">ライティング練習</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>AIがフィードバックを提供し、ライティングスキルを向上させます。</p>
            </div>
            <div className="mt-5">
              <Link
                href="/writing"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                ライティング練習
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">プロフィール設定</h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>
              英語レベル、目標を設定して、あなたに最適な学習体験をカスタマイズしましょう。
            </p>
          </div>
          <div className="mt-5">
            <Link
              href="/profile"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              プロフィールを編集
            </Link>
          </div>
        </div>
      </div>
      
      {/* Debug information for admins only */}
      {user.role === 'admin' && (
        <div className="bg-gray-100 p-4 rounded-lg mt-8">
          <h3 className="text-sm font-medium text-gray-700">セッションデバッグ情報</h3>
          <pre className="mt-2 text-xs text-gray-600 overflow-auto max-h-40">
            {JSON.stringify(user, null, 2)}
          </pre>
          <div className="mt-2">
            <Link
              href="/api/debug/session"
              target="_blank"
              className="text-xs text-blue-600 hover:underline"
            >
              セッション詳細を表示
            </Link>
          </div>
        </div>
      )}
    </div>
  );
} 