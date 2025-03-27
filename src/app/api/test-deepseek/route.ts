import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

export async function GET(req: NextRequest) {
  try {
    // Log environment variables (redacted for security)
    console.log('API Key present:', !!process.env.DEEPSEEK_API_KEY);
    console.log('API Key format:', 
      process.env.DEEPSEEK_API_KEY 
        ? `${process.env.DEEPSEEK_API_KEY.substring(0, 5)}...${process.env.DEEPSEEK_API_KEY.substring(process.env.DEEPSEEK_API_KEY.length - 4)}`
        : 'Not available'
    );
    console.log('Base URL:', process.env.DEEPSEEK_BASE_URL);
    
    // Initialize the client directly in this route handler
    const deepseek = new OpenAI({
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      apiKey: process.env.DEEPSEEK_API_KEY || '',
    });
    
    // Try to list available models first
    console.log('Attempting to list models...');
    const models = await deepseek.models.list();
    console.log('Available models:', models.data.map(model => model.id));
    
    // Simple test completion
    console.log('Attempting a simple chat completion...');
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello!' },
      ],
      max_tokens: 10,
    });
    
    return NextResponse.json({
      status: 'success',
      models: models.data.map(model => model.id),
      testResponse: response.choices[0].message.content,
    });
  } catch (error: any) {
    console.error('Error in test-deepseek route:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      details: error.response?.data || error,
    }, { status: 500 });
  }
} 