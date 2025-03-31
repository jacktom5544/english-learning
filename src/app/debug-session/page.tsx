'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export default function DebugSessionPage() {
  const { data: session, status } = useSession();
  const [jwtCookieValue, setJwtCookieValue] = useState<string | null>(null);
  const [serverData, setServerData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    // Get the JWT cookie if it exists
    const cookies = document.cookie.split(';');
    const jwtCookie = cookies.find(cookie => cookie.trim().startsWith('next-auth.session-token='));
    
    if (jwtCookie) {
      const jwtValue = jwtCookie.split('=')[1];
      setJwtCookieValue(jwtValue);
    }
  }, []);
  
  useEffect(() => {
    const fetchServerData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/debug/session');
        if (!response.ok) {
          throw new Error('Failed to fetch server data');
        }
        const data = await response.json();
        setServerData(data);
      } catch (error) {
        console.error('Error fetching server data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchServerData();
  }, []);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Debug Session Information</h1>
      
      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold mb-2">Session Status</h2>
        <p className="mb-2">
          <strong>Status:</strong> {status}
        </p>
      </div>
      
      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold mb-2">Client Session Data</h2>
        {session ? (
          <pre className="bg-white p-4 rounded overflow-auto max-h-96">
            {JSON.stringify(session, null, 2)}
          </pre>
        ) : (
          <p>No session data available</p>
        )}
      </div>
      
      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold mb-2">JWT Cookie</h2>
        {jwtCookieValue ? (
          <div>
            <p className="mb-2 overflow-auto">
              <strong>JWT Token:</strong>{' '}
              <span className="font-mono text-xs break-all">{jwtCookieValue}</span>
            </p>
            <p className="text-sm text-gray-600">
              Note: This is just the encoded token, not the decoded value.
            </p>
          </div>
        ) : (
          <p>No JWT cookie found</p>
        )}
      </div>
      
      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold mb-2">Server-Side Data</h2>
        {loading ? (
          <p>Loading server data...</p>
        ) : serverData ? (
          <div>
            <h3 className="text-lg font-medium mb-2">Server Token</h3>
            <pre className="bg-white p-4 rounded overflow-auto max-h-96 mb-4">
              {JSON.stringify(serverData.token, null, 2)}
            </pre>
            
            <h3 className="text-lg font-medium mb-2">Server Session</h3>
            <pre className="bg-white p-4 rounded overflow-auto max-h-96">
              {JSON.stringify(serverData.session, null, 2)}
            </pre>
          </div>
        ) : (
          <p>No server data available</p>
        )}
      </div>
      
      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold mb-2">All Cookies</h2>
        <pre className="bg-white p-4 rounded overflow-auto max-h-96">
          {document.cookie || 'No cookies found'}
        </pre>
      </div>
    </div>
  );
} 