import React, { useState } from 'react';

const DebugPanel: React.FC = () => {
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testAPI = async () => {
    setLoading(true);
    try {
      console.log('🧪 Testing API connection...');
      
      const response = await fetch('/api/test', {
        method: 'GET',
      });
      
      const data = await response.json();
      console.log('🧪 Test API response:', data);
      setTestResult(data);
      
    } catch (error) {
      console.error('❌ Test API failed:', error);
      setTestResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const testApifyProxy = async () => {
    setLoading(true);
    try {
      console.log('🧪 Testing Apify proxy...');
      
      const response = await fetch('/api/apify-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          actorId: 'apify~instagram-scraper',
          input: {
            directUrls: ['https://www.instagram.com/reel/DHo-T-dp2QT/'],
            resultsType: 'posts',
            resultsLimit: 1
          },
          action: 'run'
        }),
      });
      
      const data = await response.json();
      console.log('🧪 Apify proxy response:', data);
      setTestResult(data);
      
    } catch (error) {
      console.error('❌ Apify proxy test failed:', error);
      setTestResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-100 p-4 rounded-lg mb-6">
      <h3 className="text-lg font-semibold mb-4">🧪 Debug Panel</h3>
      
      <div className="space-x-2 mb-4">
        <button
          onClick={testAPI}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test API Connection'}
        </button>
        
        <button
          onClick={testApifyProxy}
          disabled={loading}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Apify Proxy'}
        </button>
      </div>

      {testResult && (
        <div className="bg-white p-4 rounded border">
          <h4 className="font-semibold mb-2">Test Result:</h4>
          <pre className="text-sm overflow-auto max-h-64">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default DebugPanel;
