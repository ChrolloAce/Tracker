import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import vtLogo from '/vtlogo.png';

const PrivacyPolicyPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Home</span>
              </button>
            </div>
            <img src={vtLogo} alt="ViewTrack" className="h-8 w-auto" />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-2xl mb-6">
            <Shield className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-gray-400">Last updated: November 1, 2025</p>
        </div>

        <div className="prose prose-invert prose-emerald max-w-none">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8 space-y-6">
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">1. Information We Collect</h2>
              <p className="text-gray-300 mb-4">
                ViewTrack collects information to provide and improve our social media analytics services. 
                The information we collect includes:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li><strong>Account Information:</strong> Name, email address, profile picture</li>
                <li><strong>Social Media Data:</strong> Public social media account information, video analytics, engagement metrics</li>
                <li><strong>Usage Data:</strong> How you interact with our service, features used, performance data</li>
                <li><strong>Device Information:</strong> Browser type, IP address, device identifiers</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">2. How We Use Your Information</h2>
              <p className="text-gray-300 mb-4">We use the collected information to:</p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Provide and maintain our analytics services</li>
                <li>Track and analyze social media performance metrics</li>
                <li>Send you notifications about account activity and updates</li>
                <li>Improve and optimize our platform</li>
                <li>Ensure security and prevent fraud</li>
                <li>Communicate with you about our services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">3. Data Sharing and Disclosure</h2>
              <p className="text-gray-300 mb-4">
                ViewTrack does not sell your personal information. We may share your information only in the following circumstances:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li><strong>With Your Consent:</strong> When you explicitly authorize us to share information</li>
                <li><strong>Service Providers:</strong> Third-party services that help us operate (Firebase, analytics tools)</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                <li><strong>Business Transfers:</strong> In connection with mergers, acquisitions, or asset sales</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">4. Data Security</h2>
              <p className="text-gray-300">
                We implement industry-standard security measures to protect your data, including:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-4">
                <li>Encrypted data transmission (HTTPS/SSL)</li>
                <li>Secure cloud storage with Firebase</li>
                <li>Regular security audits and updates</li>
                <li>Access controls and authentication</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">5. Your Rights</h2>
              <p className="text-gray-300 mb-4">You have the right to:</p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Access your personal information</li>
                <li>Correct inaccurate data</li>
                <li>Delete your account and associated data</li>
                <li>Export your data</li>
                <li>Opt-out of marketing communications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">6. Cookies and Tracking</h2>
              <p className="text-gray-300">
                We use cookies and similar technologies to enhance your experience, analyze usage patterns, 
                and maintain user sessions. You can control cookies through your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">7. Third-Party Services</h2>
              <p className="text-gray-300 mb-4">
                ViewTrack integrates with third-party platforms including:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Instagram, TikTok, YouTube (for social media data)</li>
                <li>Firebase (for data storage and authentication)</li>
                <li>Stripe (for payment processing)</li>
                <li>RevenueCat (for subscription management)</li>
              </ul>
              <p className="text-gray-300 mt-4">
                These services have their own privacy policies, and we encourage you to review them.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">8. Children's Privacy</h2>
              <p className="text-gray-300">
                ViewTrack is not intended for users under the age of 13. We do not knowingly collect 
                personal information from children under 13.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">9. Changes to This Policy</h2>
              <p className="text-gray-300">
                We may update this Privacy Policy from time to time. We will notify you of any changes 
                by posting the new policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">10. Contact Us</h2>
              <p className="text-gray-300">
                If you have questions about this Privacy Policy, please contact us:
              </p>
              <ul className="list-none text-gray-300 space-y-2 ml-4 mt-4">
                <li>📧 Email: <a href="mailto:privacy@viewtrack.app" className="text-emerald-400 hover:text-emerald-300">privacy@viewtrack.app</a></li>
                <li>🌐 Website: <a href="https://viewtrack.app" className="text-emerald-400 hover:text-emerald-300">viewtrack.app</a></li>
              </ul>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 mt-12">
        <div className="max-w-4xl mx-auto px-6 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} ViewTrack. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicyPage;

