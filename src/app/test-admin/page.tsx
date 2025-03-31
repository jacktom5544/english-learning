'use client';

import { useState } from 'react';

export default function TestAdminPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const createTestAdmin = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/create-test-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error creating test admin:', error);
      setResult({ error: 'Failed to create admin user' });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Create Test Admin Account</h1>
      
      <button
        onClick={createTestAdmin}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
      >
        {loading ? 'Creating...' : 'Create Test Admin'}
      </button>
      
      {result && (
        <div className="mt-8 p-4 border rounded bg-gray-50">
          <h2 className="text-xl font-semibold mb-2">Result:</h2>
          {result.error ? (
            <p className="text-red-600">{result.error}</p>
          ) : (
            <>
              <p className="mb-1">{result.message}</p>
              {result.user && (
                <div className="bg-white p-4 border rounded mt-2">
                  <p><strong>Email:</strong> {result.user.email}</p>
                  <p><strong>Password:</strong> {result.user.password}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
} 