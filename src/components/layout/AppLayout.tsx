'use client';

import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { useEffect, useState } from 'react';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Don't render sidebar for authentication pages
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/';
  
  // Only show sidebar for authenticated users on non-auth pages
  const showSidebar = isMounted && status === 'authenticated' && !isAuthPage;

  if (!isMounted) {
    return null;
  }

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {showSidebar && <Sidebar />}
      
      <div className={`flex flex-col flex-1 ${showSidebar ? 'lg:pl-64' : ''}`}>
        <main className="flex-1">
          <div className="py-6">
            <div className="mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
} 