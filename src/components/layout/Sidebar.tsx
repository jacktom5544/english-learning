'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
        isActive
          ? 'bg-gray-800 text-white'
          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
      }`}
    >
      {children}
    </Link>
  );
}

export default function Sidebar() {
  const { data: session } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex flex-col flex-grow bg-gray-900 overflow-y-auto">
          <div className="flex items-center h-16 flex-shrink-0 px-4 bg-gray-800">
            <Link href="/dashboard" className="text-white text-lg font-bold">
              English Learning
            </Link>
          </div>
          <div className="mt-5 flex-1 flex flex-col">
            <nav className="flex-1 px-2 space-y-1">
              <NavLink href="/dashboard">ダッシュボード</NavLink>
              <NavLink href="/profile">プロフィール</NavLink>
              <NavLink href="/quiz">クイズ</NavLink>
              <NavLink href="/vocabulary">単語</NavLink>
              <NavLink href="/writing">ライティング</NavLink>
              <NavLink href="/conversation">会話</NavLink>
            </nav>
          </div>
          <div className="p-4 border-t border-gray-700">
            <div className="flex flex-col">
              <span className="text-white text-sm mb-2">{session?.user?.name}</span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu button */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-gray-800 px-4 h-16 flex items-center justify-between">
        <span className="text-white text-lg font-bold">English Learning</span>
        <button
          type="button"
          className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <span className="sr-only">メニューを開く</span>
          <svg
            className="h-6 w-6"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {isMobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Sidebar */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black bg-opacity-50">
          <div className="fixed inset-y-0 left-0 flex flex-col w-64 bg-gray-900 overflow-y-auto">
            <div className="flex items-center h-16 flex-shrink-0 px-4 bg-gray-800 justify-between">
              <Link href="/dashboard" className="text-white text-lg font-bold">
                English Learning
              </Link>
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className="sr-only">メニューを閉じる</span>
                <svg
                  className="h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-5 flex-1 flex flex-col">
              <nav className="flex-1 px-2 space-y-1">
                <NavLink href="/dashboard">ダッシュボード</NavLink>
                <NavLink href="/profile">プロフィール</NavLink>
                <NavLink href="/quiz">クイズ</NavLink>
                <NavLink href="/vocabulary">単語</NavLink>
                <NavLink href="/writing">ライティング</NavLink>
                <NavLink href="/conversation">会話</NavLink>
              </nav>
            </div>
            <div className="p-4 border-t border-gray-700">
              <div className="flex flex-col">
                <span className="text-white text-sm mb-2">{session?.user?.name}</span>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 