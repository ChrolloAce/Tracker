import { useEffect, useState } from 'react';
import FirestoreDataService from '../services/FirestoreDataService';

const LinkRedirect: React.FC = () => {
  const [status, setStatus] = useState<'redirecting' | 'not_found'>('redirecting');

  useEffect(() => {
    const handleRedirect = async () => {
      const path = window.location.pathname;
      const match = path.match(/^\/l\/([a-zA-Z0-9]+)$/);

      if (match) {
        const shortCode = match[1];

        try {
          // Get link info (single fast read with URL included)
          const resolved = await FirestoreDataService.resolveShortCode(shortCode);

          if (resolved && resolved.url) {
            // INSTANT REDIRECT - happens immediately
            window.location.replace(resolved.url);

            // Record analytics in background (after redirect starts)
            const userAgent = navigator.userAgent.toLowerCase();
            let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
            
            if (/mobile|android|iphone/.test(userAgent)) {
              deviceType = 'mobile';
            } else if (/tablet|ipad/.test(userAgent)) {
              deviceType = 'tablet';
            }

            let browser = 'Unknown';
            if (userAgent.includes('chrome')) browser = 'Chrome';
            else if (userAgent.includes('safari')) browser = 'Safari';
            else if (userAgent.includes('firefox')) browser = 'Firefox';
            else if (userAgent.includes('edge')) browser = 'Edge';

            let os = 'Unknown';
            if (userAgent.includes('windows')) os = 'Windows';
            else if (userAgent.includes('mac')) os = 'macOS';
            else if (userAgent.includes('linux')) os = 'Linux';
            else if (userAgent.includes('android')) os = 'Android';
            else if (userAgent.includes('ios') || userAgent.includes('iphone') || userAgent.includes('ipad')) os = 'iOS';

            // Background analytics (won't delay redirect)
            FirestoreDataService.recordLinkClick(resolved.orgId, resolved.projectId, resolved.linkId, {
              userAgent: navigator.userAgent,
              deviceType,
              browser,
              os,
              referrer: document.referrer || 'Direct',
              country: undefined,
              city: undefined,
              accountHandle: resolved.accountHandle,
              accountProfilePicture: resolved.accountProfilePicture,
              accountPlatform: resolved.accountPlatform
            }).catch(err => console.error('Analytics failed:', err));
          } else {
            setStatus('not_found');
          }
        } catch (error) {
          console.error('❌ Error resolving link:', error);
          setStatus('not_found');
        }
      }
    };

    handleRedirect();
  }, []);

  // While redirecting, show nothing (instant redirect)
  if (status === 'redirecting') {
    return null;
  }

  // Only show error if link not found
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
};

export default LinkRedirect;
