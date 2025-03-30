import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { fetchUserPoints } from '@/lib/pointUtils';

/**
 * Custom hook for managing user points
 * This provides a consistent way to access and update points across all pages
 * 
 * @returns Object containing user points and related functions
 */
export function usePoints() {
  const { data: session, status } = useSession();
  const [points, setPoints] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch user points from the API
   */
  const refreshPoints = useCallback(async () => {
    if (status !== 'authenticated') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const pointsData = await fetchUserPoints();
      
      if (pointsData) {
        setPoints(pointsData.points);
      } else {
        setError('Failed to fetch points');
      }
    } catch (err) {
      console.error('Error fetching points:', err);
      setError('An error occurred while fetching points');
    } finally {
      setLoading(false);
    }
  }, [status]);

  /**
   * Check if user has enough points for an action
   */
  const hasEnoughPoints = useCallback((requiredPoints: number): boolean => {
    return points >= requiredPoints;
  }, [points]);

  // Initial fetch when component mounts
  useEffect(() => {
    refreshPoints();
    
    // Set up interval to refresh points periodically
    const intervalId = setInterval(() => {
      refreshPoints();
    }, 30000); // 30 seconds
    
    return () => clearInterval(intervalId);
  }, [refreshPoints]);

  return {
    points,
    loading,
    error,
    refreshPoints,
    hasEnoughPoints,
  };
} 