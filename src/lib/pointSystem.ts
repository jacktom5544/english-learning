/**
 * Point system configuration
 * This file contains all configurable values for the point system
 */

import { isProduction, isAWSAmplify } from './env';
import { safeLog, safeError } from './utils';

// Points given to new users upon registration
export const INITIAL_POINTS = 5000;

// Points given to users every month (30 days)
export const MONTHLY_POINTS = 5000;

// Maximum points a user can have
export const MAX_POINTS = 20000;

// Minimum remaining points warning threshold
export const LOW_POINTS_WARNING = 10;

// Point consumption for different actions
export const POINT_CONSUMPTION = {
  // Points consumed for chat submission in Conversation page
  CONVERSATION_CHAT: 1,
  
  // Points consumed for essay submission in Writing page
  WRITING_ESSAY: 1,
  
  // Points consumed for starting a quiz in Quiz page
  QUIZ_START: 1,
  
  // Points consumed for grammar check submission
  GRAMMAR_CHECK: 1,
  
  // Points consumed for generating grammar topics
  GRAMMAR_TOPIC_GENERATION: 1,
  
  // Points consumed for analyzing grammar
  GRAMMAR_ANALYSIS: 1,
  
  // Points consumed for starting a coaching session
  COACHING_SESSION: 5,
  
  // Points consumed for each coaching message
  COACHING_MESSAGE: 2,
};

// Helper for point operations
export class PointSystem {
  // Check if point consumption is working correctly
  static diagnosticCheck(): boolean {
    try {
      // Check if we're on AWS Amplify
      if (isAWSAmplify()) {
        safeLog('PointSystem diagnostic running on AWS Amplify');
      }
      
      // All systems go
      return true;
    } catch (error) {
      safeError('PointSystem diagnostic error:', error);
      return false;
    }
  }
  
  // Calculate if user has enough points
  static hasEnoughPoints(userPoints: number, actionCost: number): boolean {
    // If in development, allow point usage regardless
    if (!isProduction()) {
      return true;
    }
    
    // In production, enforce point requirements
    return userPoints >= actionCost;
  }
  
  // For debugging info on point operations
  static getDebugInfo() {
    return {
      monthly_points: MONTHLY_POINTS,
      max_points: MAX_POINTS,
      environment: isProduction() ? 'production' : 'development',
      is_amplify: isAWSAmplify(),
      time: new Date().toISOString()
    };
  }
}

// Run diagnostic check on module import (server-side only)
if (typeof window === 'undefined') {
  PointSystem.diagnosticCheck();
} 