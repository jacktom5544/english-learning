// Test script for OpenAI API integration
require('dotenv').config({ path: '.env.local' });
const { OpenAI } = require('openai');
const axios = require('axios');

async function testOpenAI() {
  try {
    console.log('Testing OpenAI API integration');
    
    // Check if API key is set
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not set in environment variables');
      return;
    }
    
    // Log first and last few characters of the API key for verification
    console.log(`API Key starts with: ${apiKey.substring(0, 10)}...`);
    console.log(`API Key length: ${apiKey.length}`);
    console.log(`API Key ends with: ...${apiKey.substring(apiKey.length - 5)}`);
    
    // Check if we're using a project API key
    const isProjectKey = apiKey.startsWith('sk-proj-');
    console.log(`Using ${isProjectKey ? 'project' : 'standard'} API key format`);
    
    if (isProjectKey) {
      // Method 1: Using direct axios call for project API keys
      console.log('Making direct API call with axios...');
      
      const response = await axios({
        method: 'post',
        url: 'https://api.openai.com/v1/chat/completions',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'platform-public'
        },
        data: {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Say "Hello, the OpenAI API is working!" in Japanese' }
          ]
        }
      });
      
      console.log('API call successful!');
      console.log('Response status:', response.status);
      console.log('Response:', response.data.choices[0].message.content);
    } else {
      // Method 2: Using OpenAI library for standard API keys
      console.log('Making API call with OpenAI library...');
      
      const openai = new OpenAI({
        apiKey,
      });
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say "Hello, the OpenAI API is working!" in Japanese' }
        ],
      });
      
      console.log('API call successful!');
      console.log('Response:', completion.choices[0].message.content);
    }
  } catch (error) {
    console.error('Error testing OpenAI:', error);
    
    if (error.response) {
      // Handle Axios error response
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.message) {
      console.error('Error message:', error.message);
    }
  }
}

testOpenAI(); 