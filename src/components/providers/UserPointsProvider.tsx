'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';

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

  const updatePoints = (newPoints: number, newPointsUsedThisMonth: number) => {
    setPoints(newPoints);
    setPointsUsedThisMonth(newPointsUsedThisMonth);
  };

  const refreshPoints = async () => {
    if (!session?.user?.email) return;
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/users/points');
      if (res.ok) {
        const data = await res.json();
        setPoints(data.points);
        setPointsUsedThisMonth(data.pointsUsedThisMonth);
      }
    } catch (error) {
      console.error('Failed to fetch user points:', error);
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
        return true;
      } else {
        // If we get a 403, it means not enough points
        if (res.status === 403) {
          const data = await res.json();
          setPoints(data.currentPoints);
        }
        return false;
      }
    } catch (error) {
      console.error('Failed to consume points:', error);
      return false;
    }
  };

  // Fetch user points when session changes
  useEffect(() => {
    if (session?.user?.email) {
      refreshPoints();
    }
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