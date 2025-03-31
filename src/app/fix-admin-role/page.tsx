'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';

export default function FixAdminRolePage() {
  const { data: session } = useSession();
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const fixAdminRole = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug/fix-admin-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email || session?.user?.email }),
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error fixing admin role:', error);
      setResult({ error: 'Failed to fix admin role' });
    } finally {
      setLoading(false);
    }
  };
  
  const handleLogout = async () => {
    await signOut({ redirect: true, callbackUrl: '/login' });
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Fix Admin Role</h1>
      
      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold mb-4">Current Session</h2>
        {session ? (
          <div>
            <p><strong>Email:</strong> {session.user?.email}</p>
            <p><strong>Role:</strong> {session.user?.role}</p>
          </div>
        ) : (
          <p>No session data available</p>
        )}
      </div>
      
      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold mb-4">Fix Role</h2>
        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email (leave empty to use current user)
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder={session?.user?.email || 'Email address'}
          />
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={fixAdminRole}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
          >
            {loading ? 'Processing...' : 'Fix Admin Role'}
          </button>
          
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Logout
          </button>
        </div>
      </div>
      
      {result && (
        <div className="mb-6 p-4 bg-gray-100 rounded">
          <h2 className="text-xl font-semibold mb-4">Result</h2>
          {result.error ? (
            <p className="text-red-600">{result.error}</p>
          ) : (
            <div>
              <p className="mb-2">{result.message}</p>
              {result.user && (
                <div className="bg-white p-4 rounded mb-4">
                  <p><strong>Email:</strong> {result.user.email}</p>
                  <p><strong>Role:</strong> {result.user.role}</p>
                  {result.user.previousRole && (
                    <p><strong>Previous Role:</strong> {result.user.previousRole}</p>
                  )}
                  <p><strong>Token Role:</strong> {result.user.tokenRole}</p>
                </div>
              )}
              {result.note && (
                <div className="bg-yellow-100 p-3 rounded text-yellow-800">
                  <p>{result.note}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 