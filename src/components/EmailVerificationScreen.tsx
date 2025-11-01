import React, { useState } from 'react';
import { Mail, RefreshCw, ArrowRight } from 'lucide-react';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../services/firebase';
import viewtrackLogo from '/vtlogo.png';

const EmailVerificationScreen: React.FC = () => {
  const [resending, setResending] = useState(false);
  const [resentSuccess, setResentSuccess] = useState(false);
  const user = auth.currentUser;

  const handleResendEmail = async () => {
    if (!user) return;
    
    setResending(true);
    setResentSuccess(false);
    
    try {
      await sendEmailVerification(user);
      setResentSuccess(true);
      console.log('✅ Verification email resent');
    } catch (error) {
      console.error('Failed to resend verification email:', error);
      alert('Failed to resend email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#FAFAFB] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 shadow-lg text-center">
        {/* Logo */}
        <div className="mb-6">
          <img src={viewtrackLogo} alt="ViewTrack" className="h-10 w-auto mx-auto" />
        </div>

        {/* Icon */}
        <div className="w-16 h-16 bg-[#2282FF]/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Mail className="w-8 h-8 text-[#2282FF]" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Verify Your Email
        </h2>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          We sent a verification email to:
        </p>
        <p className="text-gray-900 font-medium mb-6">
          {user?.email}
        </p>
        <p className="text-gray-600 text-sm mb-8">
          Click the link in the email to verify your account and continue to ViewTrack.
        </p>

        {/* Actions */}
        <div className="space-y-3">
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#2282FF] hover:bg-[#1b6dd9] text-white rounded-full transition-colors font-semibold shadow-lg shadow-[#2282FF]/20"
          >
            <span>I've Verified - Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Resend Email */}
          <button
            onClick={handleResendEmail}
            disabled={resending || resentSuccess}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-full transition-colors font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
            <span>
              {resending ? 'Sending...' : resentSuccess ? 'Email Sent!' : 'Resend Verification Email'}
            </span>
          </button>
        </div>

        {/* Help Text */}
        <p className="text-xs text-gray-500 mt-6">
          Didn't receive the email? Check your spam folder or resend it.
        </p>
      </div>
    </div>
  );
};

export default EmailVerificationScreen;

