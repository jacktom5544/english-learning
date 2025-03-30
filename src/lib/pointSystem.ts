/**
 * Point system configuration
 * This file contains all configurable values for the point system
 */

// Points given to new users upon registration
export const INITIAL_POINTS = 5000;

// Points given to users every month (30 days)
export const MONTHLY_POINTS = 5000;

// Maximum points a user can have
export const MAX_POINTS = 20000;

// Point consumption for different actions
export const POINT_CONSUMPTION = {
  // Points consumed for chat submission in Conversation page
  CONVERSATION_CHAT: 1,
  
  // Points consumed for essay submission in Writing page
  WRITING_ESSAY: 1,
  
  // Points consumed for starting a quiz in Quiz page
  QUIZ_START: 1,
}; 