import React from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';

const PrivacyPolicyPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <NavBar logo={viewtrackLogo} onGetStarted={() => navigate('/login')} />

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 pt-32 pb-20">
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">Privacy Policy</h1>
          <p className="text-gray-500">Last updated: November 1, 2025</p>
        </div>

        <div className="prose prose-lg prose-gray max-w-none">
          <div className="space-y-12">
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Information We Collect</h2>
              <p className="text-gray-600 mb-4">
                ViewTrack collects information to provide and improve our social media analytics services. 
                The information we collect includes:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li><strong>Account Information:</strong> Name, email address, profile picture</li>
                <li><strong>Social Media Data:</strong> Public social media account information, video analytics, engagement metrics</li>
                <li><strong>Usage Data:</strong> How you interact with our service, features used, performance data</li>
                <li><strong>Device Information:</strong> Browser type, IP address, device identifiers</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. How We Use Your Information</h2>
              <p className="text-gray-600 mb-4">We use the collected information to:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>Provide and maintain our analytics services</li>
                <li>Track and analyze social media performance metrics</li>
                <li>Send you notifications about account activity and updates</li>
                <li>Improve and optimize our platform</li>
                <li>Ensure security and prevent fraud</li>
                <li>Communicate with you about our services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Data Sharing and Disclosure</h2>
              <p className="text-gray-600 mb-4">
                ViewTrack does not sell your personal information. We may share your information only in the following circumstances:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li><strong>With Your Consent:</strong> When you explicitly authorize us to share information</li>
                <li><strong>Service Providers:</strong> Third-party services that help us operate (Firebase, analytics tools)</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                <li><strong>Business Transfers:</strong> In connection with mergers, acquisitions, or asset sales</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Data Security</h2>
              <p className="text-gray-600">
                We implement industry-standard security measures to protect your data, including:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4 mt-4">
                <li>Encrypted data transmission (HTTPS/SSL)</li>
                <li>Secure cloud storage with Firebase</li>
                <li>Regular security audits and updates</li>
                <li>Access controls and authentication</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Your Rights</h2>
              <p className="text-gray-600 mb-4">You have the right to:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>Access your personal information</li>
                <li>Correct inaccurate data</li>
                <li>Delete your account and associated data</li>
                <li>Export your data</li>
                <li>Opt-out of marketing communications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Cookies and Tracking</h2>
              <p className="text-gray-600">
                We use cookies and similar technologies to enhance your experience, analyze usage patterns, 
                and maintain user sessions. You can control cookies through your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Third-Party Services</h2>
              <p className="text-gray-600 mb-4">
                ViewTrack integrates with third-party platforms including:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>Instagram, TikTok, YouTube (for social media data)</li>
                <li>Firebase (for data storage and authentication)</li>
                <li>Stripe (for payment processing)</li>
                <li>RevenueCat (for subscription management)</li>
              </ul>
              <p className="text-gray-600 mt-4">
                These services have their own privacy policies, and we encourage you to review them.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Children's Privacy</h2>
              <p className="text-gray-600">
                ViewTrack is not intended for users under the age of 13. We do not knowingly collect 
                personal information from children under 13.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Changes to This Policy</h2>
              <p className="text-gray-600">
                We may update this Privacy Policy from time to time. We will notify you of any changes 
                by posting the new policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Contact Us</h2>
              <p className="text-gray-600">
                If you have questions about this Privacy Policy, please contact us:
              </p>
              <ul className="list-none text-gray-600 space-y-2 ml-4 mt-4">
                <li>📧 Email: <a href="mailto:team@viewtrack.app" className="text-blue-600 hover:underline">team@viewtrack.app</a></li>
                <li>🌐 Website: <a href="https://viewtrack.app" className="text-blue-600 hover:underline">viewtrack.app</a></li>
              </ul>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPolicyPage;
