import OpenAI from 'openai';
import 'server-only';

// Initialize DeepSeek client with OpenAI-compatible API
const apiKey = process.env.DEEPSEEK_API_KEY || '';
const apiBaseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';

// Ensure we have the API key
if (!apiKey) {
  console.warn('Warning: DEEPSEEK_API_KEY is not set in environment variables');
}

// Create and export the OpenAI-compatible client for DeepSeek
const deepseek = new OpenAI({
  apiKey,
  baseURL: apiBaseUrl,
  timeout: 9000, // Reduced to 9 seconds to be under Vercel's 10-second limit
  maxRetries: 3, // Increased retries
});

export default deepseek; 