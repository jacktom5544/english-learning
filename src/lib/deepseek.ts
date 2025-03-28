import OpenAI from 'openai';
import 'server-only';

// Initialize DeepSeek client with OpenAI-compatible API
const apiKey = process.env.DEEPSEEK_API_KEY || '';
const apiBaseUrl = process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com/v1';

// Ensure we have the API key
if (!apiKey) {
  console.warn('Warning: DEEPSEEK_API_KEY is not set in environment variables');
}

// Create and export the OpenAI-compatible client for DeepSeek
const deepseek = new OpenAI({
  apiKey,
  baseURL: apiBaseUrl,
  timeout: 60000, // Set a 60-second timeout for API calls
  maxRetries: 2, // Retry failed requests twice
});

export default deepseek; 