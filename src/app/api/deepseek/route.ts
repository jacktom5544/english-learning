import { NextRequest, NextResponse } from 'next/server';
import deepseek from '@/lib/deepseek';

export async function POST(req: NextRequest) {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('DEEPSEEK_API_KEY is not defined in environment variables');
    return NextResponse.json(
      { error: 'DeepSeek API key is not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const userMessage = body.message || 'Hello, how can I integrate DeepSeek into my Next.js app?';

    console.log('Sending request to DeepSeek with model: deepseek-chat');
    console.log('API Key format check:', process.env.DEEPSEEK_API_KEY?.substring(0, 5) + '...');
    console.log('Base URL:', process.env.DEEPSEEK_BASE_URL);
    
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are a helpful assistant specialized in English language learning.' },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    console.log('Received response from DeepSeek');
    
    return NextResponse.json({ 
      result: response.choices[0].message.content 
    });
  } catch (error: any) {
    console.error('DeepSeek API error details:', JSON.stringify(error, null, 2));
    
    // More specific error message based on the error type
    let errorMessage = 'Something went wrong';
    let statusCode = 500;
    
    if (error.status === 401) {
      errorMessage = 'Authentication error: Invalid API key';
      statusCode = 401;
    } else if (error.status === 404) {
      errorMessage = 'Model not found: The specified model may not be available';
      statusCode = 404;
    } else if (error.status === 429) {
      errorMessage = 'Rate limit exceeded or quota exceeded';
      statusCode = 429;
    }
    
    return NextResponse.json(
      { error: errorMessage, details: error.message },
      { status: statusCode }
    );
  }
} 