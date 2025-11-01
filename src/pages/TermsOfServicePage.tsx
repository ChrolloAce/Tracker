import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import vtLogo from '/vtlogo.png';

const TermsOfServicePage: React.FC = () => {
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
            <FileText className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
          <p className="text-gray-400">Last updated: November 1, 2025</p>
        </div>

        <div className="prose prose-invert prose-emerald max-w-none">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8 space-y-6">
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-300">
                By accessing and using ViewTrack, you accept and agree to be bound by these Terms of Service. 
                If you do not agree to these terms, please do not use our service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">2. Description of Service</h2>
              <p className="text-gray-300 mb-4">
                ViewTrack provides social media analytics and tracking tools for Instagram, TikTok, YouTube, 
                and Twitter/X platforms. Our services include:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Video performance tracking and analytics</li>
                <li>Account monitoring and insights</li>
                <li>Link tracking and click analytics</li>
                <li>Creator management and campaign tools</li>
                <li>Revenue tracking and reporting</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">3. User Accounts</h2>
              <p className="text-gray-300 mb-4">You are responsible for:</p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized use</li>
                <li>Providing accurate and current information</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">4. Acceptable Use</h2>
              <p className="text-gray-300 mb-4">You agree NOT to:</p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Violate any laws or regulations</li>
                <li>Infringe on intellectual property rights</li>
                <li>Transmit viruses, malware, or harmful code</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Use the service for any illegal or unauthorized purpose</li>
                <li>Scrape or harvest data without permission</li>
                <li>Reverse engineer or copy our software</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">5. Subscription and Billing</h2>
              <p className="text-gray-300 mb-4">
                ViewTrack offers both free and paid subscription plans. By subscribing to a paid plan:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>You authorize recurring charges to your payment method</li>
                <li>Subscriptions auto-renew unless cancelled</li>
                <li>Refunds are handled according to our refund policy</li>
                <li>We may change pricing with 30 days notice</li>
                <li>You can cancel anytime from your account settings</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">6. Intellectual Property</h2>
              <p className="text-gray-300">
                ViewTrack and its content (excluding user-generated content) are owned by us and protected 
                by copyright, trademark, and other intellectual property laws. You may not copy, modify, 
                distribute, or create derivative works without our permission.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">7. Data and Analytics</h2>
              <p className="text-gray-300">
                ViewTrack aggregates publicly available social media data for analytics purposes. We do not 
                claim ownership of your social media content. You retain all rights to your content and data.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">8. Third-Party Platforms</h2>
              <p className="text-gray-300">
                Our service integrates with third-party platforms (Instagram, TikTok, YouTube, Twitter). 
                Your use of these platforms is subject to their respective terms of service. ViewTrack is 
                not responsible for changes to third-party APIs or services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">9. Limitation of Liability</h2>
              <p className="text-gray-300">
                ViewTrack is provided "as is" without warranties of any kind. We are not liable for any 
                indirect, incidental, special, or consequential damages arising from your use of the service. 
                Our total liability is limited to the amount you paid us in the last 12 months.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">10. Termination</h2>
              <p className="text-gray-300">
                We reserve the right to suspend or terminate your account at any time for violations of 
                these terms. You may also terminate your account at any time from your account settings. 
                Upon termination, your data will be deleted according to our data retention policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">11. Modifications to Terms</h2>
              <p className="text-gray-300">
                We may modify these Terms of Service at any time. We will notify you of significant changes 
                via email or through the service. Continued use after changes constitutes acceptance of the 
                modified terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">12. Governing Law</h2>
              <p className="text-gray-300">
                These terms are governed by the laws of the United States. Any disputes shall be resolved 
                in the courts of [Your State/Country].
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">13. Contact Information</h2>
              <p className="text-gray-300">
                For questions about these Terms of Service:
              </p>
              <ul className="list-none text-gray-300 space-y-2 ml-4 mt-4">
                <li>📧 Email: <a href="mailto:legal@viewtrack.app" className="text-emerald-400 hover:text-emerald-300">legal@viewtrack.app</a></li>
                <li>💬 Support: <a href="/support" className="text-emerald-400 hover:text-emerald-300">viewtrack.app/support</a></li>
              </ul>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} ViewTrack. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default TermsOfServicePage;

