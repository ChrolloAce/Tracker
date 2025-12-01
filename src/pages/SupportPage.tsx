import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';
import { Mail, Book, Send, CheckCircle } from 'lucide-react';

const SupportPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Here you would typically send to your support email/system
    console.log('Support request:', formData);
    
    // Simulate submission
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: '', email: '', subject: '', message: '' });
    }, 3000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <NavBar logo={viewtrackLogo} onGetStarted={() => navigate('/login')} />

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 pt-32 pb-20">
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">Support Center</h1>
          <p className="text-gray-500">We're here to help you get the most out of ViewTrack</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Quick Links */}
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 hover:shadow-lg transition-all cursor-pointer">
            <Book className="w-10 h-10 text-black mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">Documentation</h3>
            <p className="text-gray-500 text-sm">
              Learn how to use ViewTrack with our comprehensive guides.
            </p>
          </div>

          <a 
            href="mailto:support@viewtrack.app"
            className="bg-gray-50 border border-gray-100 rounded-2xl p-8 hover:shadow-lg transition-all cursor-pointer block"
          >
            <Mail className="w-10 h-10 text-black mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">Email Support</h3>
            <p className="text-gray-500 text-sm">
              Get help via email - we respond within 24 hours.
              <br />
              <span className="font-medium text-gray-900">support@viewtrack.app</span>
            </p>
          </a>
        </div>

        {/* FAQ Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-gray-900">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <details className="bg-gray-50 border border-gray-100 rounded-xl p-6 group cursor-pointer open:bg-white open:shadow-sm transition-all">
              <summary className="font-semibold text-gray-900 list-none flex items-center justify-between select-none">
                <span>How do I connect my social media accounts?</span>
                <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="text-gray-600 mt-4 leading-relaxed">
                Go to the Accounts tab and click "Add Account". Enter your social media handle and we'll 
                start tracking your content automatically.
              </p>
            </details>

            <details className="bg-gray-50 border border-gray-100 rounded-xl p-6 group cursor-pointer open:bg-white open:shadow-sm transition-all">
              <summary className="font-semibold text-gray-900 list-none flex items-center justify-between select-none">
                <span>How often is data refreshed?</span>
                <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="text-gray-600 mt-4 leading-relaxed">
                Data is refreshed every 30 minutes for Pro users and every 2 hours for Free users. 
                You can also manually refresh any account from the account details page.
              </p>
            </details>

            <details className="bg-gray-50 border border-gray-100 rounded-xl p-6 group cursor-pointer open:bg-white open:shadow-sm transition-all">
              <summary className="font-semibold text-gray-900 list-none flex items-center justify-between select-none">
                <span>Can I track multiple accounts?</span>
                <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="text-gray-600 mt-4 leading-relaxed">
                Yes! Free plans can track up to 3 accounts. Pro plans offer unlimited account tracking 
                across all platforms.
              </p>
            </details>

            <details className="bg-gray-50 border border-gray-100 rounded-xl p-6 group cursor-pointer open:bg-white open:shadow-sm transition-all">
              <summary className="font-semibold text-gray-900 list-none flex items-center justify-between select-none">
                <span>How do tracked links work?</span>
                <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="text-gray-600 mt-4 leading-relaxed">
                Create short links that track clicks, locations, devices, and referrers. Perfect for 
                measuring campaign performance and bio link analytics.
              </p>
            </details>

            <details className="bg-gray-50 border border-gray-100 rounded-xl p-6 group cursor-pointer open:bg-white open:shadow-sm transition-all">
              <summary className="font-semibold text-gray-900 list-none flex items-center justify-between select-none">
                <span>How do I upgrade my plan?</span>
                <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="text-gray-600 mt-4 leading-relaxed">
                Go to Settings → Subscription and choose the plan that works for you. Upgrades take 
                effect immediately.
              </p>
            </details>
          </div>
        </div>

        {/* Contact Form */}
        <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">Still Need Help?</h2>
          <p className="text-gray-500 mb-8">
            Send us a message and we'll get back to you as soon as possible.
          </p>

          {submitted ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Message Sent!</h3>
              <p className="text-gray-500">We'll get back to you within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Subject *
                </label>
                <select
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all appearance-none"
                >
                  <option value="">Select a topic...</option>
                  <option value="technical">Technical Issue</option>
                  <option value="billing">Billing Question</option>
                  <option value="feature">Feature Request</option>
                  <option value="account">Account Help</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all resize-none"
                  placeholder="Describe your issue or question..."
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-black hover:bg-gray-800 text-white font-bold rounded-xl transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                Send Message
              </button>
            </form>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SupportPage;
