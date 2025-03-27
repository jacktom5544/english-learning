'use client';

import { useState } from 'react';

export default function TestPage() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch('/api/deepseek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });
      
      const data = await res.json();
      if (res.ok) {
        setResponse(data.result);
      } else {
        setResponse(`エラー: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error communicating with API:', error);
      setResponse('API通信中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  const testApiConnection = async () => {
    setLoading(true);
    setTestResults(null);
    
    try {
      const res = await fetch('/api/test-deepseek');
      const data = await res.json();
      
      if (res.ok) {
        setTestResults(JSON.stringify(data, null, 2));
      } else {
        setTestResults(`テスト失敗: ${JSON.stringify(data, null, 2)}`);
      }
    } catch (error) {
      console.error('API接続テストエラー:', error);
      setTestResults('API接続テスト中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">DeepSeek AI テスト</h1>
      
      <div className="mb-6">
        <button 
          onClick={testApiConnection}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 mb-4"
        >
          {loading ? 'テスト中...' : 'API接続テスト'}
        </button>
        
        {testResults && (
          <div className="border rounded-md p-4 bg-gray-50 mt-2 overflow-auto">
            <h2 className="font-medium mb-2">テスト結果:</h2>
            <pre className="text-xs">{testResults}</pre>
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="mb-4">
          <label htmlFor="message" className="block mb-2 text-sm font-medium">
            メッセージ:
          </label>
          <textarea 
            id="message"
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            className="w-full p-3 border rounded-md min-h-24"
            placeholder="DeepSeek AIに質問してみましょう..."
          />
        </div>
        <button 
          type="submit" 
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? '送信中...' : '送信'}
        </button>
      </form>
      
      {response && (
        <div className="border rounded-md p-4 bg-gray-50">
          <h2 className="font-medium mb-2">回答:</h2>
          <div className="whitespace-pre-wrap">{response}</div>
        </div>
      )}
    </div>
  );
}
