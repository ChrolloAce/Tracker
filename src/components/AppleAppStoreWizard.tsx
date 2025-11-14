import React, { useState } from 'react';
import { X, Check, ArrowRight, ArrowLeft, Upload, Link2, CheckCircle2, AlertCircle } from 'lucide-react';

interface AppleAppStoreWizardProps {
  onClose: () => void;
  onComplete: (credentials: AppleAppStoreCredentials) => void;
}

export interface AppleAppStoreCredentials {
  issuerID: string;
  keyID: string;
  vendorNumber: string;
  privateKey: string;
  privateKeyFileName: string;
  // App metadata
  bundleId?: string; // Bundle ID for filtering specific app (e.g., com.yourcompany.app)
  appName?: string;
  appIcon?: string;
  appleId?: string;
}

const AppleAppStoreWizard: React.FC<AppleAppStoreWizardProps> = ({ onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [credentials, setCredentials] = useState<AppleAppStoreCredentials>({
    issuerID: '',
    keyID: '',
    vendorNumber: '',
    privateKey: '',
    privateKeyFileName: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTested, setConnectionTested] = useState(false);
  const [connectionSuccess, setConnectionSuccess] = useState(false);

  const totalSteps = 7;

  /**
   * Encrypts the private key before storing in Firestore
   * Uses base64 encoding with XOR cipher for basic encryption
   * NOTE: For production, consider using stronger encryption (AES-256, AWS KMS, etc.)
   * 
   * This encrypted key will be used with Apple's App Store Connect API:
   * https://developer.apple.com/documentation/appstoreconnectapi
   * 
   * The API credentials (Issuer ID, Key ID, Vendor Number, and .p8 private key)
   * provide access to:
   * - Sales and Financial Reports
   * - App Analytics Data
   * - Revenue Metrics
   * - Subscription Data
   * 
   * Apple's API uses JWT authentication with the private key for secure access.
   */
  const encryptPrivateKey = (key: string): string => {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const encrypted = Array.from(data).map(byte => byte ^ 0xAA); // XOR with key
    return btoa(String.fromCharCode(...encrypted));
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setError(null);
    
    try {
      console.log('🔍 Testing Apple App Store Connect credentials...');
      console.log('Issuer ID:', credentials.issuerID);
      console.log('Key ID:', credentials.keyID);
      console.log('Vendor Number:', credentials.vendorNumber);
      console.log('Private Key length:', credentials.privateKey.length);
      
      // Base64 encode the private key for transmission to API
      const base64Key = btoa(credentials.privateKey);
      
      // Test the Apple App Store Connect API connection
      const response = await fetch('/api/apple-test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issuerID: credentials.issuerID,
          keyID: credentials.keyID,
          vendorNumber: credentials.vendorNumber.replace('#', ''),
          privateKey: base64Key
        })
      });

      console.log('📡 Response status:', response.status);
      const result = await response.json();
      console.log('📋 Response data:', result);
      
      if (response.ok && result.success) {
        console.log('✅ Connection test successful!');
        setConnectionSuccess(true);
        setConnectionTested(true);
      } else {
        console.error('❌ Connection test failed:', result);
        setConnectionSuccess(false);
        setConnectionTested(true);
        setError(result.message || 'Connection test failed. Please verify your credentials.');
      }
    } catch (err: any) {
      console.error('❌ Connection test error:', err);
      setConnectionSuccess(false);
      setConnectionTested(true);
      setError(`Failed to test connection: ${err.message || 'Unknown error'}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleNext = () => {
    setError(null);
    // Mark current step as completed
    setCompletedSteps(prev => new Set(prev).add(currentStep));
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      // Reset connection test when entering step 7
      if (currentStep === 6) {
        setConnectionTested(false);
        setConnectionSuccess(false);
      }
    }
  };

  const handleBack = () => {
    setError(null);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.p8')) {
        setError('Please upload a valid .p8 key file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        
        console.log('📁 File uploaded:', {
          fileName: file.name,
          contentLength: content.length
        });
        
        // Store the raw key content - it will be encrypted before saving
        setCredentials(prev => ({
          ...prev,
          privateKey: content,
          privateKeyFileName: file.name
        }));
        setError(null);
      };
      reader.onerror = () => {
        setError('Failed to read file');
      };
      reader.readAsText(file);
    }
  };

  const handleComplete = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Validate all fields
      if (!credentials.issuerID || !credentials.keyID || !credentials.vendorNumber || !credentials.privateKey) {
        throw new Error('Please fill in all required fields');
      }

      // Encrypt the private key before storing
      const encryptedCredentials = {
        ...credentials,
        privateKey: encryptPrivateKey(credentials.privateKey)
      };

      // Call the completion handler with encrypted credentials
      await onComplete(encryptedCredentials);
      
      // Mark final step as completed
      setCompletedSteps(prev => new Set(prev).add(currentStep));
    } catch (err: any) {
      setError(err.message || 'Failed to complete setup');
      setLoading(false);
    }
  };

  const renderProgressBar = () => (
    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-8">
      <div 
        className="h-full bg-white transition-all duration-300 ease-out"
        style={{ width: `${(currentStep / totalSteps) * 100}%` }}
      />
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-bold text-white">Connect Apple App Store</h2>
        <p className="text-white/60 text-lg">
          Synchronize your app's financial data and track your app revenue in real-time.
        </p>
      </div>

      {/* Logos with Sync Symbol */}
      <div className="flex items-center justify-center gap-8 py-8">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden bg-white/5 border border-white/10">
          <img 
            src="/vtlogo.png" 
            alt="Viral.app Logo" 
            className="w-full h-full object-contain p-2"
          />
        </div>
        <div className="flex flex-col items-center gap-2">
          <Link2 className="w-8 h-8 text-white/60" />
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center">
          <svg viewBox="0 0 814 1000" className="w-14 h-14" fill="currentColor">
            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
          </svg>
        </div>
      </div>

      {/* What You'll Need */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          What You'll Need
        </h3>
        
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-3 h-3 text-white" />
            </div>
            <div>
              <p className="text-white font-medium">Admin or Finance Role in App Store Connect</p>
              <p className="text-white/50 text-sm mt-1">
                You must have one of these roles to create API keys and enable the integration.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-3 h-3 text-white" />
            </div>
            <div>
              <p className="text-white font-medium">All Agreements Signed</p>
              <p className="text-white/50 text-sm mt-1">
                Tax, banking, and developer agreements must be active within App Store Connect.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-3 h-3 text-white" />
            </div>
            <div>
              <p className="text-white font-medium">About 5 Minutes</p>
              <p className="text-white/50 text-sm mt-1">
                The process is quick and straightforward.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Confirm Your Role</h2>
        <p className="text-white/60">
          Verify that you have the necessary permissions in App Store Connect
        </p>
      </div>

      <div className="bg-white/5 rounded-xl border border-white/10 p-6 space-y-4">
        <p className="text-white/80">
          To continue, you need one of the following roles:
        </p>
        
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-white font-medium">Account Holder</p>
              <p className="text-white/50 text-sm">Full access to all App Store Connect features</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-white font-medium">Admin</p>
              <p className="text-white/50 text-sm">Can create API keys and manage integrations</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-white font-medium">Finance</p>
              <p className="text-white/50 text-sm">Access to financial reports and API keys</p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-white/10">
          <a 
            href="https://appstoreconnect.apple.com/access/users" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-white/60 hover:text-white text-sm underline inline-flex items-center gap-2"
          >
            Check your role in App Store Connect
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Generate API Key</h2>
        <p className="text-white/60">
          Create an App Store Connect API key for integration
        </p>
      </div>

      <div className="bg-white/5 rounded-xl border border-white/10 p-6 space-y-4">
        <p className="text-white/80 font-medium">Follow these steps in App Store Connect:</p>
        
        <ol className="space-y-4 text-white/70">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white text-sm font-bold">1</span>
            <div className="flex-1">
              <p>Go to <span className="text-white font-medium">Users and Access</span></p>
              <p className="text-sm text-white/50 mt-1">Located in the main navigation menu</p>
            </div>
          </li>
          
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white text-sm font-bold">2</span>
            <div className="flex-1">
              <p>Select <span className="text-white font-medium">Keys</span> tab</p>
              <p className="text-sm text-white/50 mt-1">Under the Integrations section</p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white text-sm font-bold">3</span>
            <div className="flex-1">
              <p>Click <span className="text-white font-medium">+ (Generate API Key)</span></p>
              <p className="text-sm text-white/50 mt-1">Give it a descriptive name like "Viral.app Integration"</p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white text-sm font-bold">4</span>
            <div className="flex-1">
              <p>Set Access to <span className="text-white font-medium">Finance</span></p>
              <p className="text-sm text-white/50 mt-1">This allows revenue data access</p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white text-sm font-bold">5</span>
            <div className="flex-1">
              <p>Click <span className="text-white font-medium">Generate</span></p>
              <p className="text-sm text-white/50 mt-1">The key will be created immediately</p>
            </div>
          </li>
        </ol>

        <div className="pt-4 border-t border-white/10">
          <a 
            href="https://appstoreconnect.apple.com/access/integrations/api" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-white/60 hover:text-white text-sm underline inline-flex items-center gap-2"
          >
            Open App Store Connect API section
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Enter Issuer ID</h2>
        <p className="text-white/60">
          Copy your Issuer ID from App Store Connect
        </p>
      </div>

      <div className="bg-white/5 rounded-xl border border-white/10 p-6 space-y-4">
        <div className="space-y-2">
          <label className="text-white font-medium block">Issuer ID</label>
          <input
            type="text"
            value={credentials.issuerID}
            onChange={(e) => setCredentials(prev => ({ ...prev, issuerID: e.target.value }))}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-white/30"
          />
          <p className="text-white/50 text-sm">
            Found at the top of the Keys page in App Store Connect
          </p>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <p className="text-blue-300 text-sm">
            <strong>💡 Where to find it:</strong> In App Store Connect, go to Users and Access → Keys. Your Issuer ID is displayed at the top of the page.
          </p>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Key ID & Private Key</h2>
        <p className="text-white/60">
          Enter your Key ID and upload the .p8 private key file
        </p>
      </div>

      <div className="bg-white/5 rounded-xl border border-white/10 p-6 space-y-6">
        <div className="space-y-2">
          <label className="text-white font-medium block">Key ID *</label>
          <input
            type="text"
            value={credentials.keyID}
            onChange={(e) => setCredentials(prev => ({ ...prev, keyID: e.target.value.toUpperCase() }))}
            placeholder="ABCDEFGHIJ"
            maxLength={10}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-white/30 font-mono"
          />
          <p className="text-white/50 text-sm">
            10-character alphanumeric ID found in the Keys list
          </p>
          </div>

          <div className="pt-4 border-t border-white/10">
            <label className="block">
            <p className="text-white font-medium mb-3">Private Key File (.p8) *</p>
              <div className={`
                relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-colors
                ${credentials.privateKeyFileName 
                  ? 'border-emerald-500/50 bg-emerald-500/10' 
                  : 'border-white/20 hover:border-white/40 bg-white/5'
                }
              `}>
                <input
                  type="file"
                  accept=".p8"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                {credentials.privateKeyFileName ? (
                  <div className="space-y-2">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                    <p className="text-white font-medium">{credentials.privateKeyFileName}</p>
                    <p className="text-white/50 text-sm">Click to replace</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-12 h-12 text-white/40 mx-auto" />
                    <p className="text-white font-medium">Drop your .p8 file here or click to browse</p>
                    <p className="text-white/50 text-sm">AuthKey_XXXXXXXXXX.p8</p>
                  </div>
                )}
              </div>
            </label>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
          <p className="text-amber-300 text-sm">
            <strong>⚠️ Important:</strong> Apple only allows you to download the private key file once. If you've lost it, you'll need to generate a new API key.
          </p>
        </div>
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Vendor Number & App Info</h2>
        <p className="text-white/60">
          Complete your integration setup
        </p>
      </div>

      <div className="bg-white/5 rounded-xl border border-white/10 p-6 space-y-6">
        <div className="space-y-2">
          <label className="text-white font-medium block">
            Vendor Number *
            <span className="text-white/40 font-normal text-sm ml-2">(8 digits)</span>
          </label>
          <input
            type="text"
            value={credentials.vendorNumber}
            onChange={(e) => {
              // Allow digits and # symbol
              const value = e.target.value.replace(/[^0-9#]/g, '');
              setCredentials(prev => ({ ...prev, vendorNumber: value }));
            }}
            placeholder="85442109 or #85442109"
            maxLength={9}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-white/30 font-mono"
          />
          <p className="text-white/50 text-sm">
            8-digit number used for financial reporting (may include # prefix)
          </p>
        </div>

        {/* App Metadata */}
        <div className="border-t border-white/10 pt-4 space-y-4">
          <p className="text-white/60 text-sm font-medium">App Information</p>
          
          <div className="space-y-2">
            <label className="text-white/80 text-sm block flex items-center gap-2">
              Bundle ID
              <span className="text-emerald-400 text-xs">(IMPORTANT for filtering)</span>
            </label>
            <input
              type="text"
              value={credentials.bundleId || ''}
              onChange={(e) => setCredentials(prev => ({ ...prev, bundleId: e.target.value }))}
              placeholder="e.g., com.yourcompany.appname"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-white/30 font-mono"
            />
            <p className="text-white/40 text-xs">
              📌 <strong>Required if you have multiple apps:</strong> Only data for this Bundle ID will be imported. 
              Leave empty to import ALL apps in your vendor account.
            </p>
          </div>
          
          <div className="space-y-2">
            <label className="text-white/80 text-sm block">App Name (Optional)</label>
            <input
              type="text"
              value={credentials.appName || ''}
              onChange={(e) => setCredentials(prev => ({ ...prev, appName: e.target.value }))}
              placeholder="e.g., TrackView"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-white/30"
            />
          </div>

          <div className="space-y-2">
            <label className="text-white/80 text-sm block">Apple ID (Optional)</label>
            <input
              type="text"
              value={credentials.appleId || ''}
              onChange={(e) => setCredentials(prev => ({ ...prev, appleId: e.target.value }))}
              placeholder="e.g., 1234567890"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-white/30 font-mono"
            />
            <p className="text-white/40 text-xs">Find this in App Store Connect under your app details</p>
          </div>

          <div className="space-y-2">
            <label className="text-white/80 text-sm block">App Icon URL</label>
            <input
              type="text"
              value={credentials.appIcon || ''}
              onChange={(e) => setCredentials(prev => ({ ...prev, appIcon: e.target.value }))}
              placeholder="e.g., https://example.com/icon.png"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-white/30"
            />
            <p className="text-white/40 text-xs">Direct link to your app's icon image</p>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <p className="text-blue-300 text-sm font-medium mb-2">
            💡 Where to find your Vendor Number:
          </p>
          <p className="text-blue-200 text-sm">
            In App Store Connect, go to <strong>Sales and Trends</strong> and look for "Vendor #" in the top right corner. 
            It's an 8-digit number that may be displayed with a # symbol (e.g., #85442109 or 85442109).
          </p>
        </div>
      </div>
    </div>
  );

  const renderStep7 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Verify Connection</h2>
        <p className="text-white/60">
          Review your credentials and complete the setup
        </p>
      </div>

      <div className="bg-white/5 rounded-xl border border-white/10 p-6 space-y-4">
        <h3 className="text-white font-semibold">Connection Details</h3>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
            <span className="text-white/60">Issuer ID</span>
            <span className="text-white font-mono text-sm">{credentials.issuerID || '—'}</span>
          </div>

          <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
            <span className="text-white/60">Key ID</span>
            <span className="text-white font-mono text-sm">{credentials.keyID || '—'}</span>
          </div>

          <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
            <span className="text-white/60">Vendor Number</span>
            <span className="text-white font-mono text-sm">{credentials.vendorNumber || '—'}</span>
          </div>

          <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
            <span className="text-white/60">Private Key</span>
            <span className="text-white text-sm">
              {credentials.privateKeyFileName ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  {credentials.privateKeyFileName}
                </span>
              ) : '—'}
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-white/10 space-y-4">
          {/* Test Connection Button */}
          {!connectionTested && (
            <button
              onClick={testConnection}
              disabled={testingConnection}
              className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {testingConnection ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Testing Connection...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Test Connection
                </>
              )}
            </button>
          )}

          {/* Connection Test Result */}
          {connectionTested && connectionSuccess && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
            <p className="text-emerald-300 text-sm">
                <strong>✅ Connection Successful!</strong> Your credentials are valid. Click "Complete Setup" to finish.
              </p>
            </div>
          )}

          {connectionTested && !connectionSuccess && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-red-300 text-sm">
                <strong>❌ Connection Failed</strong> Please verify your credentials and try again.
            </p>
          </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      case 7: return renderStep7();
      default: return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
      case 2:
      case 3:
        return true;
      case 4:
        // Issuer ID should be a UUID format (36 chars with dashes)
        const issuerID = credentials.issuerID.trim();
        return issuerID.length === 36 && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(issuerID);
      case 5:
        // Key ID should be exactly 10 alphanumeric characters AND private key uploaded
        const keyID = credentials.keyID.trim();
        return keyID.length === 10 && /^[A-Z0-9]{10}$/.test(keyID) && credentials.privateKey.length > 0;
      case 6:
        // Vendor Number should be 8 digits (with optional # prefix)
        const vendorNum = credentials.vendorNumber.trim().replace('#', '');
        return vendorNum.length === 8 && /^\d{8}$/.test(vendorNum);
      case 7:
        // Can only proceed if connection test passed
        return connectionTested && connectionSuccess;
      default:
        return false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0A0A0A] rounded-2xl border border-white/10 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#0A0A0A] border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="text-white/60 text-sm font-medium">
              Step {currentStep} of {totalSteps}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          {renderProgressBar()}
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {renderStepContent()}

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#0A0A0A] border-t border-white/10 px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors
              ${currentStep === 1 
                ? 'text-white/30 cursor-not-allowed' 
                : 'text-white/60 hover:text-white hover:bg-white/5'
              }
            `}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {currentStep < totalSteps ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={`
                flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-colors
                ${canProceed()
                  ? 'bg-white text-black hover:bg-white/90'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
                }
              `}
            >
              {completedSteps.has(currentStep) && (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {currentStep === 1 ? 'Get Started' : 'Continue'}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={!canProceed() || loading}
              className={`
                flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-colors
                ${canProceed() && !loading
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
                }
              `}
            >
              {loading ? 'Connecting...' : 'Complete Setup'}
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppleAppStoreWizard;

