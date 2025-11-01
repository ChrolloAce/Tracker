import React, { useState, useEffect } from 'react';
import { Mail, RefreshCw, ArrowRight, ArrowLeft } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import viewtrackLogo from '/vtlogo.png';

const EmailVerificationScreen: React.FC = () => {
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resentSuccess, setResentSuccess] = useState(false);
  const [error, setError] = useState('');
  const user = auth.currentUser;

  // Generate and send verification code on mount
  useEffect(() => {
    sendVerificationCode();
  }, []);

  const generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const sendVerificationCode = async () => {
    if (!user) return;
    
    setResending(true);
    setResentSuccess(false);
    setError('');
    
    try {
      // Generate 6-digit code
      const verificationCode = generateCode();
      
      // Store code in Firestore with 15-minute expiry
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await setDoc(doc(db, 'verificationCodes', user.uid), {
        code: verificationCode,
        email: user.email,
        expiresAt,
        createdAt: new Date()
      });
      
      // Send email via your API (you'll need to create this endpoint)
      await fetch('/api/send-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          code: verificationCode
        })
      });
      
      setResentSuccess(true);
      console.log('✅ Verification code sent to:', user.email);
    } catch (error) {
      console.error('Failed to send verification code:', error);
      setError('Failed to send code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleVerify = async () => {
    if (!user || code.length !== 6) return;
    
    setVerifying(true);
    setError('');
    
    try {
      // Get stored code
      const codeDoc = await getDoc(doc(db, 'verificationCodes', user.uid));
      
      if (!codeDoc.exists()) {
        setError('Verification code expired. Please request a new one.');
        setVerifying(false);
        return;
      }
      
      const data = codeDoc.data();
      const expiresAt = data.expiresAt.toDate();
      
      // Check if expired
      if (new Date() > expiresAt) {
        setError('Verification code expired. Please request a new one.');
        await deleteDoc(doc(db, 'verificationCodes', user.uid));
        setVerifying(false);
        return;
      }
      
      // Verify code
      if (data.code === code) {
        // Mark as verified in user document
        await setDoc(doc(db, 'users', user.uid), {
          emailVerified: true,
          verifiedAt: new Date()
        }, { merge: true });
        
        // Delete verification code
        await deleteDoc(doc(db, 'verificationCodes', user.uid));
        
        console.log('✅ Email verified successfully');
        
        // Reload to continue to app
        window.location.reload();
      } else {
        setError('Invalid code. Please check and try again.');
        setVerifying(false);
      }
    } catch (error) {
      console.error('Failed to verify code:', error);
      setError('Verification failed. Please try again.');
      setVerifying(false);
    }
  };

  const handleBackToLogin = async () => {
    await signOut(auth);
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-[#FAFAFB] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 shadow-lg">
        {/* Back Button */}
        <button
          onClick={handleBackToLogin}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Login</span>
        </button>

        {/* Logo */}
        <div className="mb-6 text-center">
          <img src={viewtrackLogo} alt="ViewTrack" className="h-10 w-auto mx-auto" />
        </div>

        {/* Icon */}
        <div className="w-16 h-16 bg-[#2282FF]/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Mail className="w-8 h-8 text-[#2282FF]" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
          Verify Your Email
        </h2>

        {/* Message */}
        <p className="text-gray-600 mb-4 text-center">
          We sent a 6-digit code to:
        </p>
        <p className="text-gray-900 font-medium mb-6 text-center">
          {user?.email}
        </p>

        {/* Code Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
            Enter verification code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
              setCode(value);
              setError('');
            }}
            onKeyPress={(e) => e.key === 'Enter' && code.length === 6 && handleVerify()}
            placeholder="000000"
            maxLength={6}
            className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border-0 border-b-2 border-gray-300 focus:border-[#2282FF] focus:outline-none transition-colors bg-transparent"
            autoFocus
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600 text-center">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {resentSuccess && !error && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-sm text-emerald-600 text-center">Code sent! Check your email.</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {/* Verify Button */}
          <button
            onClick={handleVerify}
            disabled={verifying || code.length !== 6}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#2282FF] hover:bg-[#1b6dd9] text-white rounded-full transition-colors font-semibold shadow-lg shadow-[#2282FF]/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{verifying ? 'Verifying...' : 'Verify Email'}</span>
            {!verifying && <ArrowRight className="w-4 h-4" />}
          </button>

          {/* Resend Code */}
          <button
            onClick={sendVerificationCode}
            disabled={resending}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-full transition-colors font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
            <span>
              {resending ? 'Sending...' : 'Resend Code'}
            </span>
          </button>
        </div>

        {/* Help Text */}
        <p className="text-xs text-gray-500 mt-6 text-center">
          Didn't receive the code? Check your spam folder or request a new one.
        </p>
      </div>
    </div>
  );
};

export default EmailVerificationScreen;

