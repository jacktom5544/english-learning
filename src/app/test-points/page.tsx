'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function TestPointsPage() {
  const { data: session, status } = useSession();
  const [userDetails, setUserDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [pointsToSet, setPointsToSet] = useState('5000');
  
  // Check user points from session
  useEffect(() => {
    if (session?.user) {
      setUserDetails({
        ...session.user,
        sessionPoints: session.user.points
      });
    }
  }, [session]);
  
  // Function to check points from API
  const checkApiPoints = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await fetch('/api/users/points');
      if (response.ok) {
        const data = await response.json();
        setUserDetails((prev: any) => ({
          ...prev,
          apiPoints: data.points,
          pointsUsedThisMonth: data.pointsUsedThisMonth,
          pointsLastUpdated: data.pointsLastUpdated
        }));
        setSuccess('Successfully retrieved points from API');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to get points from API');
      }
    } catch (err) {
      setError('Error fetching points: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Function to update points for a specific user
  const updateUserPoints = async () => {
    if (!testEmail) {
      setError('Email is required');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await fetch('/api/debug/update-user-points', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: testEmail,
          points: parseInt(pointsToSet)
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuccess(`Successfully updated points for ${data.user.email} to ${data.user.points}`);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update points');
      }
    } catch (err) {
      setError('Error updating points: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };
  
  // Function to check all users' points
  const checkAllUsers = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await fetch('/api/debug/check-user-points');
      if (response.ok) {
        const data = await response.json();
        setUserDetails((prev: any) => ({
          ...prev,
          allUsers: data
        }));
        setSuccess(`Found ${data.totalUsers} users. ${data.usersWithPoints} users have points.`);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to check users');
      }
    } catch (err) {
      setError('Error checking users: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Points Testing Page</h1>
      
      {status === 'loading' && <p>Loading session...</p>}
      
      {status === 'unauthenticated' && (
        <div className="mb-6 p-4 bg-yellow-100 rounded">
          <p>You are not logged in. <Link href="/login" className="text-blue-600 underline">Login</Link> to test points.</p>
        </div>
      )}
      
      {status === 'authenticated' && (
        <div className="mb-6 p-4 bg-gray-100 rounded">
          <h2 className="text-xl font-semibold mb-2">Current User</h2>
          <p>Name: {session.user.name}</p>
          <p>Email: {session.user.email}</p>
          <p>Points from session: {session.user.points !== undefined ? session.user.points : 'Not available'}</p>
          {userDetails?.apiPoints !== undefined && (
            <p>Points from API: {userDetails.apiPoints}</p>
          )}
          {userDetails?.pointsUsedThisMonth !== undefined && (
            <p>Points used this month: {userDetails.pointsUsedThisMonth}</p>
          )}
        </div>
      )}
      
      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-6 p-4 bg-green-100 text-green-700 rounded">
          {success}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-4 border rounded">
          <h2 className="text-lg font-semibold mb-4">Check API Points</h2>
          <button 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            onClick={checkApiPoints}
            disabled={loading || status !== 'authenticated'}
          >
            Check Points via API
          </button>
        </div>
        
        <div className="p-4 border rounded">
          <h2 className="text-lg font-semibold mb-4">Update User Points</h2>
          <div className="mb-4">
            <label className="block mb-2">Email:</label>
            <input 
              type="email" 
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="user@example.com"
            />
          </div>
          
          <div className="mb-4">
            <label className="block mb-2">Points:</label>
            <input 
              type="number" 
              value={pointsToSet}
              onChange={(e) => setPointsToSet(e.target.value)}
              className="w-full p-2 border rounded"
              min="0"
            />
          </div>
          
          <button 
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            onClick={updateUserPoints}
            disabled={loading || !testEmail}
          >
            Update Points
          </button>
        </div>
        
        <div className="p-4 border rounded md:col-span-2">
          <h2 className="text-lg font-semibold mb-4">All Users</h2>
          <button 
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 mb-4"
            onClick={checkAllUsers}
            disabled={loading}
          >
            Check All Users
          </button>
          
          {userDetails?.allUsers && (
            <div className="mt-4">
              <p>Total users: {userDetails.allUsers.totalUsers}</p>
              <p>Users with points: {userDetails.allUsers.usersWithPoints}</p>
              <p>Users with zero points: {userDetails.allUsers.usersWithZeroPoints}</p>
              <p>Users without points: {userDetails.allUsers.usersWithoutPoints}</p>
              
              <h3 className="font-semibold mt-4 mb-2">User List:</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="py-2 px-4 border">Email</th>
                      <th className="py-2 px-4 border">Name</th>
                      <th className="py-2 px-4 border">Points</th>
                      <th className="py-2 px-4 border">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userDetails.allUsers.users.map((user: any) => (
                      <tr key={user.id}>
                        <td className="py-2 px-4 border">{user.email}</td>
                        <td className="py-2 px-4 border">{user.name}</td>
                        <td className="py-2 px-4 border">{user.points !== undefined ? user.points : 'N/A'}</td>
                        <td className="py-2 px-4 border">{user.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 