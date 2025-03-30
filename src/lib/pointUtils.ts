// This file now contains only client-safe code
// Server functions have been moved to serverUtils.ts
import { MONTHLY_POINTS, MAX_POINTS } from './pointSystem';

// Re-export constants that are needed on client side
export { MONTHLY_POINTS, MAX_POINTS };

/**
 * Client-side utility for fetching user points
 * This function should be used across all pages to ensure consistent point data
 * @returns Object containing user points or null if fetch failed
 */
export const fetchUserPoints = async () => {
  try {
    const response = await fetch('/api/users/points', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    });
    
    if (!response.ok) {
      console.error('Failed to fetch user points:', response.status);
      return null;
    }
    
    const data = await response.json();
    return { 
      points: data.points,
      pointsUsedThisMonth: data.pointsUsedThisMonth,
      pointsLastUpdated: data.pointsLastUpdated
    };
  } catch (error) {
    console.error('Error fetching user points:', error);
    return null;
  }
}; 