'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

type UserPointsContextType = {
  points: number | null;
  pointsUsedThisMonth: number;
  isLoading: boolean;
  updatePoints: (newPoints: number, newPointsUsedThisMonth: number) => void;
  refreshPoints: () => Promise<void>;
  consumePoints: (pointsToConsume: number) => Promise<boolean>;
};

const UserPointsContext = createContext<UserPointsContextType | undefined>(undefined);

export function useUserPoints() {
  const context = useContext(UserPointsContext);
  if (context === undefined) {
    throw new Error('useUserPoints must be used within a UserPointsProvider');
  }
  return context;
}

interface UserPointsProviderProps {
  children: ReactNode;
}

export function UserPointsProvider({ children }: UserPointsProviderProps) {
  const { data: session } = useSession();
  const [points, setPoints] = useState<number | null>(null);
  const [pointsUsedThisMonth, setPointsUsedThisMonth] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const updatePoints = (newPoints: number, newPointsUsedThisMonth: number) => {
    setPoints(newPoints);
    setPointsUsedThisMonth(newPointsUsedThisMonth);
    setLastUpdated(new Date());
  };

  const refreshPoints = async (forceRetry = false) => {
    if (!session?.user?.email) return;
    
    // If we've tried recently (within 30 seconds), don't retry unless forced
    if (lastUpdated && !forceRetry) {
      const timeSinceLastUpdate = Date.now() - lastUpdated.getTime();
      if (timeSinceLastUpdate < 30000) { // 30 seconds
        return;
      }
    }
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/users/points');
      if (res.ok) {
        const data = await res.json();
        setPoints(data.points);
        setPointsUsedThisMonth(data.pointsUsedThisMonth);
        setLastUpdated(new Date());
        setRetryCount(0); // Reset retry count on success
      } else {
        // Handle specific errors
        console.error('Failed to fetch user points:', res.status);
        
        // If we've tried less than 3 times and got a 401/403/500 error, retry after a delay
        if (retryCount < 3 && [401, 403, 500, 503].includes(res.status)) {
          setRetryCount(prev => prev + 1);
          setTimeout(() => refreshPoints(true), 2000 * retryCount);
        } else if (points === null) {
          // Use session points as fallback if we have them and all retries failed
          setPoints(session?.user?.points as number || 0);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user points:', error);
      
      // Use session points as fallback if we have them
      if (points === null && session?.user?.points !== undefined) {
        setPoints(session.user.points as number || 0);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // New method to consume points
  const consumePoints = async (pointsToConsume: number): Promise<boolean> => {
    if (!session?.user?.email || points === null) return false;
    
    try {
      const res = await fetch('/api/users/points/consume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pointsToConsume }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setPoints(data.points);
        setPointsUsedThisMonth(data.pointsUsedThisMonth);
        setLastUpdated(new Date());
        return true;
      } else {
        // If we get a 403, it means not enough points
        if (res.status === 403) {
          const data = await res.json();
          setPoints(data.currentPoints);
          toast.error('ポイントが足りません。');
        } else {
          // For other errors, try to refresh points
          await refreshPoints(true);
          toast.error('ポイント消費中にエラーが発生しました。');
        }
        return false;
      }
    } catch (error) {
      console.error('Failed to consume points:', error);
      await refreshPoints(true);
      return false;
    }
  };

  // Fetch user points when session changes
  useEffect(() => {
    if (session?.user?.email) {
      refreshPoints();
    }
  }, [session?.user?.email]);

  // Set up periodic refresh of points (every 5 minutes)
  useEffect(() => {
    if (!session?.user?.email) return;
    
    const intervalId = setInterval(() => {
      refreshPoints();
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(intervalId);
  }, [session?.user?.email]);

  return (
    <UserPointsContext.Provider 
      value={{ 
        points: points === null ? session?.user?.points as number || null : points, 
        pointsUsedThisMonth, 
        isLoading,
        updatePoints,
        refreshPoints,
        consumePoints
      }}
    >
      {children}
    </UserPointsContext.Provider>
  );
} 