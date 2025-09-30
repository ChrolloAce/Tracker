import { useEffect, useState } from 'react';
import TrackedLinksService from '../services/TrackedLinksService';

const LinkRedirect: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'redirecting' | 'not_found'>('loading');
  const [linkTitle, setLinkTitle] = useState<string>('');

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/l\/([a-zA-Z0-9]+)$/);

    if (match) {
      const shortCode = match[1];
      console.log('🔗 Short code detected:', shortCode);

      // Get the link from storage
      const link = TrackedLinksService.getLinkByShortCode(shortCode);

      if (link) {
        console.log('✅ Link found:', link.originalUrl);
        setLinkTitle(link.title);
        setStatus('redirecting');

        // Record the click with basic device detection
        const userAgent = navigator.userAgent.toLowerCase();
        let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
        
        if (/mobile|android|iphone/.test(userAgent)) {
          deviceType = 'mobile';
        } else if (/tablet|ipad/.test(userAgent)) {
          deviceType = 'tablet';
        }

        // Get browser info
        let browser = 'Unknown';
        if (userAgent.includes('chrome')) browser = 'Chrome';
        else if (userAgent.includes('safari')) browser = 'Safari';
        else if (userAgent.includes('firefox')) browser = 'Firefox';
        else if (userAgent.includes('edge')) browser = 'Edge';

        // Get OS info
        let os = 'Unknown';
        if (userAgent.includes('windows')) os = 'Windows';
        else if (userAgent.includes('mac')) os = 'macOS';
        else if (userAgent.includes('linux')) os = 'Linux';
        else if (userAgent.includes('android')) os = 'Android';
        else if (userAgent.includes('ios') || userAgent.includes('iphone') || userAgent.includes('ipad')) os = 'iOS';

        // Record the click
        TrackedLinksService.recordClick(link.id, {
          userAgent: navigator.userAgent,
          deviceType,
          browser,
          os,
          referrer: document.referrer || 'Direct'
        });

        // Redirect after a short delay to ensure click is recorded
        setTimeout(() => {
          window.location.href = link.originalUrl;
        }, 100);
      } else {
        console.log('❌ Link not found');
        setStatus('not_found');
      }
    }
  }, []);

  if (status === 'loading' || status === 'redirecting') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {status === 'redirecting' ? 'Redirecting...' : 'Loading...'}
          </h2>
          {linkTitle && (
            <p className="text-gray-600 dark:text-gray-400">
              Taking you to: {linkTitle}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (status === 'not_found') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#161616] rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 p-8 text-center">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔗</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Link Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This short link doesn't exist or has been deleted.
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return null;
};

export default LinkRedirect;
