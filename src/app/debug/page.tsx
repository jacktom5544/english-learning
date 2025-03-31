'use client';

import { useState } from 'react';

export default function DebugPage() {
  const [getResponse, setGetResponse] = useState<any>(null);
  const [postResponse, setPostResponse] = useState<any>(null);
  const [grammarResponse, setGrammarResponse] = useState<any>(null);
  const [envVars, setEnvVars] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<{ [key: string]: boolean }>({
    get: false,
    post: false,
    grammar: false,
    env: false
  });

  const testGet = async () => {
    setIsLoading({ ...isLoading, get: true });
    try {
      console.log("Calling debug GET API");
      const response = await fetch('/api/debug');
      console.log("Debug GET response status:", response.status);
      const data = await response.json();
      console.log("Debug GET response data:", data);
      setGetResponse(data);
    } catch (error) {
      console.error("Error testing GET:", error);
      setGetResponse({ error: String(error) });
    } finally {
      setIsLoading({ ...isLoading, get: false });
    }
  };

  const testPost = async () => {
    setIsLoading({ ...isLoading, post: true });
    try {
      console.log("Calling debug POST API");
      const response = await fetch('/api/debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: 'data', timestamp: new Date().toISOString() }),
      });
      console.log("Debug POST response status:", response.status);
      const data = await response.json();
      console.log("Debug POST response data:", data);
      setPostResponse(data);
    } catch (error) {
      console.error("Error testing POST:", error);
      setPostResponse({ error: String(error) });
    } finally {
      setIsLoading({ ...isLoading, post: false });
    }
  };

  const testGrammarPatch = async () => {
    setIsLoading({ ...isLoading, grammar: true });
    try {
      console.log("Testing Grammar PATCH API directly");
      
      // First create a dummy grammar entry
      console.log("Creating test grammar entry");
      const createResponse = await fetch('/api/grammar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topics: ["Test topic 1", "Test topic 2", "Test topic 3"],
          essays: [
            "This is a test essay. I am writing this to test the grammar API.",
            "This is another test essay. It has some grammar mistakes like he go to school.",
            "Third test essay with errors. She dont like apples. We was there yesterday."
          ],
          grammaticalErrors: [],
          conversation: []
        }),
      });
      
      console.log("Create response status:", createResponse.status);
      if (!createResponse.ok) {
        throw new Error(`Failed to create grammar entry: ${createResponse.status}`);
      }
      
      const grammarEntry = await createResponse.json();
      console.log("Test grammar entry created:", grammarEntry._id);
      
      // Now call the PATCH endpoint
      console.log("Calling grammar PATCH API");
      const analysisResponse = await fetch('/api/grammar', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          essays: [
            "This is a test essay. I am writing this to test the grammar API.",
            "This is another test essay. It has some grammar mistakes like he go to school.",
            "Third test essay with errors. She dont like apples. We was there yesterday."
          ],
          grammarEntryId: grammarEntry._id
        }),
      });
      
      console.log("Analysis response status:", analysisResponse.status);
      if (!analysisResponse.ok) {
        const errorText = await analysisResponse.text();
        throw new Error(`Failed to analyze essays: ${analysisResponse.status} - ${errorText}`);
      }
      
      const analysisResult = await analysisResponse.json();
      console.log("Analysis result:", analysisResult);
      setGrammarResponse(analysisResult);
    } catch (error) {
      console.error("Error testing grammar PATCH:", error);
      setGrammarResponse({ error: String(error) });
    } finally {
      setIsLoading({ ...isLoading, grammar: false });
    }
  };

  const testEnvVars = async () => {
    setIsLoading({ ...isLoading, env: true });
    try {
      console.log("Checking environment variables");
      const response = await fetch('/api/debug-env');
      console.log("Env vars response status:", response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to check environment: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Environment variables:", data);
      setEnvVars(data);
    } catch (error) {
      console.error("Error checking environment variables:", error);
      setEnvVars({ error: String(error) });
    } finally {
      setIsLoading({ ...isLoading, env: false });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">API Debug Page</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Test Debug GET API</h2>
        <button 
          onClick={testGet}
          disabled={isLoading.get}
          className={`px-4 py-2 rounded ${isLoading.get ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
        >
          {isLoading.get ? 'Testing...' : 'Test GET'}
        </button>
        
        {getResponse && (
          <div className="mt-4 p-4 bg-gray-100 rounded overflow-auto">
            <pre>{JSON.stringify(getResponse, null, 2)}</pre>
          </div>
        )}
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Test Debug POST API</h2>
        <button 
          onClick={testPost}
          disabled={isLoading.post}
          className={`px-4 py-2 rounded ${isLoading.post ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
        >
          {isLoading.post ? 'Testing...' : 'Test POST'}
        </button>
        
        {postResponse && (
          <div className="mt-4 p-4 bg-gray-100 rounded overflow-auto">
            <pre>{JSON.stringify(postResponse, null, 2)}</pre>
          </div>
        )}
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Test Grammar PATCH API</h2>
        <button 
          onClick={testGrammarPatch}
          disabled={isLoading.grammar}
          className={`px-4 py-2 rounded ${isLoading.grammar ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
        >
          {isLoading.grammar ? 'Testing...' : 'Test Grammar PATCH'}
        </button>
        
        {grammarResponse && (
          <div className="mt-4 p-4 bg-gray-100 rounded overflow-auto">
            <pre>{JSON.stringify(grammarResponse, null, 2)}</pre>
          </div>
        )}
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Check Environment Variables</h2>
        <button 
          onClick={testEnvVars}
          disabled={isLoading.env}
          className={`px-4 py-2 rounded ${isLoading.env ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
        >
          {isLoading.env ? 'Checking...' : 'Check Env Vars'}
        </button>
        
        {envVars && (
          <div className="mt-4 p-4 bg-gray-100 rounded overflow-auto">
            <pre>{JSON.stringify(envVars, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
} 