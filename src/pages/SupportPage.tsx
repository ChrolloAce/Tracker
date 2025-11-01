import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, MessageSquare, Book, Send, CheckCircle } from 'lucide-react';
import vtLogo from '/vtlogo.png';

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
            <MessageSquare className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Support Center</h1>
          <p className="text-gray-400">We're here to help you get the most out of ViewTrack</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {/* Quick Links */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all cursor-pointer">
            <Book className="w-10 h-10 text-emerald-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Documentation</h3>
            <p className="text-gray-400 text-sm">
              Learn how to use ViewTrack with our comprehensive guides
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all cursor-pointer">
            <MessageSquare className="w-10 h-10 text-emerald-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Live Chat</h3>
            <p className="text-gray-400 text-sm">
              Chat with our support team in real-time
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all cursor-pointer">
            <Mail className="w-10 h-10 text-emerald-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Email Support</h3>
            <p className="text-gray-400 text-sm">
              Get help via email - we respond within 24 hours
            </p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <details className="bg-white/5 border border-white/10 rounded-xl p-6 group hover:bg-white/10 transition-all">
              <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                <span>How do I connect my social media accounts?</span>
                <span className="text-emerald-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="text-gray-400 mt-4">
                Go to the Accounts tab and click "Add Account". Enter your social media handle and we'll 
                start tracking your content automatically.
              </p>
            </details>

            <details className="bg-white/5 border border-white/10 rounded-xl p-6 group hover:bg-white/10 transition-all">
              <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                <span>How often is data refreshed?</span>
                <span className="text-emerald-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="text-gray-400 mt-4">
                Data is refreshed every 30 minutes for Pro users and every 2 hours for Free users. 
                You can also manually refresh any account from the account details page.
              </p>
            </details>

            <details className="bg-white/5 border border-white/10 rounded-xl p-6 group hover:bg-white/10 transition-all">
              <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                <span>Can I track multiple accounts?</span>
                <span className="text-emerald-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="text-gray-400 mt-4">
                Yes! Free plans can track up to 3 accounts. Pro plans offer unlimited account tracking 
                across all platforms.
              </p>
            </details>

            <details className="bg-white/5 border border-white/10 rounded-xl p-6 group hover:bg-white/10 transition-all">
              <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                <span>How do tracked links work?</span>
                <span className="text-emerald-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="text-gray-400 mt-4">
                Create short links that track clicks, locations, devices, and referrers. Perfect for 
                measuring campaign performance and bio link analytics.
              </p>
            </details>

            <details className="bg-white/5 border border-white/10 rounded-xl p-6 group hover:bg-white/10 transition-all">
              <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                <span>How do I upgrade my plan?</span>
                <span className="text-emerald-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="text-gray-400 mt-4">
                Go to Settings → Subscription and choose the plan that works for you. Upgrades take 
                effect immediately.
              </p>
            </details>
          </div>
        </div>

        {/* Contact Form */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <h2 className="text-3xl font-bold mb-6">Still Need Help?</h2>
          <p className="text-gray-400 mb-8">
            Send us a message and we'll get back to you as soon as possible.
          </p>

          {submitted ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Message Sent!</h3>
              <p className="text-gray-400">We'll get back to you within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Subject *
                </label>
                <select
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="" className="bg-gray-900">Select a topic...</option>
                  <option value="technical" className="bg-gray-900">Technical Issue</option>
                  <option value="billing" className="bg-gray-900">Billing Question</option>
                  <option value="feature" className="bg-gray-900">Feature Request</option>
                  <option value="account" className="bg-gray-900">Account Help</option>
                  <option value="other" className="bg-gray-900">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Message *
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 resize-none"
                  placeholder="Describe your issue or question..."
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                Send Message
              </button>
            </form>
          )}
        </div>

        {/* Quick Contact */}
        <div className="mt-12 grid md:grid-cols-2 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <Mail className="w-8 h-8 text-emerald-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Email Us</h3>
            <p className="text-gray-400 text-sm mb-3">
              For general inquiries and support
            </p>
            <a 
              href="mailto:support@viewtrack.app" 
              className="text-emerald-400 hover:text-emerald-300 font-medium"
            >
              support@viewtrack.app
            </a>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <Book className="w-8 h-8 text-emerald-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Documentation</h3>
            <p className="text-gray-400 text-sm mb-3">
              Browse our knowledge base
            </p>
            <a 
              href="https://docs.viewtrack.app" 
              className="text-emerald-400 hover:text-emerald-300 font-medium"
            >
              docs.viewtrack.app
            </a>
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

export default SupportPage;

