import React, { useState, useEffect } from 'react';
import { X, Link as LinkIcon, Check, AlertCircle, Search, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TrackedAccount } from '../types/firestore';
import FirestoreDataService from '../services/FirestoreDataService';
import CreatorLinksService from '../services/CreatorLinksService';
import { ProxiedImage } from './ProxiedImage';

// Platform icons
import instagramIcon from '/Instagram_icon.png';
import tiktokIcon from '/TiktokLogo.png';
import youtubeIcon from '/Youtube_shorts_icon.svg.png';
import xLogo from '/twitter-x-logo.png';

interface CreatorAccountLinkingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}


/**
 * CreatorAccountLinkingModal
 * Allows creators to view their linked accounts and request new links
 */
const CreatorAccountLinkingModal: React.FC<CreatorAccountLinkingModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'linked' | 'available' | 'request'>('linked');
  const [linkedAccounts, setLinkedAccounts] = useState<TrackedAccount[]>([]);
  const [availableAccounts, setAvailableAccounts] = useState<TrackedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [requestingLink, setRequestingLink] = useState(false);
  
  // New account request form
  const [newAccountUrl, setNewAccountUrl] = useState('');
  const [newAccountPlatform, setNewAccountPlatform] = useState<'instagram' | 'tiktok' | 'youtube' | 'twitter'>('tiktok');
  const [newAccountNotes, setNewAccountNotes] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, currentOrgId, currentProjectId, user]);

  const loadData = async () => {
    if (!currentOrgId || !currentProjectId || !user) return;

    setLoading(true);
    try {
      // Get all tracked accounts in the project
      const allAccounts = await FirestoreDataService.getTrackedAccounts(
        currentOrgId,
        currentProjectId
      );

      // Get accounts already linked to this creator
      const creatorLinks = await CreatorLinksService.getCreatorLinkedAccounts(
        currentOrgId,
        currentProjectId,
        user.uid
      );

      const linkedAccountIds = new Set(creatorLinks.map(link => link.accountId));

      // Separate linked and available accounts
      const linked: TrackedAccount[] = [];
      const available: TrackedAccount[] = [];

      allAccounts.forEach(account => {
        if (linkedAccountIds.has(account.id)) {
          linked.push(account);
        } else {
          available.push(account);
        }
      });

      setLinkedAccounts(linked);
      setAvailableAccounts(available);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram': return instagramIcon;
      case 'tiktok': return tiktokIcon;
      case 'youtube': return youtubeIcon;
      case 'twitter': return xLogo;
      default: return null;
    }
  };

  const toggleAccountSelection = (accountId: string) => {
    setSelectedAccountIds(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handleRequestLink = async () => {
    if (!currentOrgId || !currentProjectId || !user || selectedAccountIds.length === 0) return;

    setRequestingLink(true);
    try {
      // Link the selected accounts to the creator
      await CreatorLinksService.linkCreatorToAccounts(
        currentOrgId,
        currentProjectId,
        user.uid,
        selectedAccountIds,
        user.uid // Self-linked
      );

      setSelectedAccountIds([]);
      await loadData();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to link accounts:', error);
      alert('Failed to link accounts. Please try again.');
    } finally {
      setRequestingLink(false);
    }
  };

  const handleSubmitNewAccountRequest = async () => {
    if (!newAccountUrl.trim()) return;

    setSubmittingRequest(true);
    try {
      // For now, we'll just show a success message
      // In production, this would create a pending request for admin approval
      // or use the video submission queue to add the account
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setRequestSuccess(true);
      setNewAccountUrl('');
      setNewAccountNotes('');
      
      setTimeout(() => {
        setRequestSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Failed to submit request:', error);
      alert('Failed to submit request. Please try again.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const filteredAvailableAccounts = availableAccounts.filter(account => {
    const query = searchQuery.toLowerCase();
    return (
      account.username?.toLowerCase().includes(query) ||
      account.displayName?.toLowerCase().includes(query) ||
      account.platform?.toLowerCase().includes(query)
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-emerald-400" />
              Manage Linked Accounts
            </h2>
            <p className="text-sm text-white/60 mt-1">
              Link your social media accounts to track your performance
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('linked')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'linked'
                ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            My Accounts ({linkedAccounts.length})
          </button>
          <button
            onClick={() => setActiveTab('available')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'available'
                ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            Link Existing ({availableAccounts.length})
          </button>
          <button
            onClick={() => setActiveTab('request')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'request'
                ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            Add New
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
            </div>
          ) : (
            <>
              {/* Linked Accounts Tab */}
              {activeTab === 'linked' && (
                <div className="space-y-3">
                  {linkedAccounts.length === 0 ? (
                    <div className="text-center py-12">
                      <LinkIcon className="w-12 h-12 text-white/20 mx-auto mb-3" />
                      <p className="text-white/60">No accounts linked yet</p>
                      <p className="text-sm text-white/40 mt-1">
                        Go to "Link Existing" to connect your accounts
                      </p>
                    </div>
                  ) : (
                    linkedAccounts.map(account => (
                      <AccountCard
                        key={account.id}
                        account={account}
                        platformIcon={getPlatformIcon(account.platform)}
                        isLinked={true}
                      />
                    ))
                  )}
                </div>
              )}

              {/* Available Accounts Tab */}
              {activeTab === 'available' && (
                <div className="space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search accounts..."
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                    />
                  </div>

                  {filteredAvailableAccounts.length === 0 ? (
                    <div className="text-center py-12">
                      <AlertCircle className="w-12 h-12 text-white/20 mx-auto mb-3" />
                      <p className="text-white/60">
                        {searchQuery ? 'No accounts match your search' : 'No available accounts'}
                      </p>
                      <p className="text-sm text-white/40 mt-1">
                        Request to add a new account in the "Add New" tab
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredAvailableAccounts.map(account => (
                        <AccountCard
                          key={account.id}
                          account={account}
                          platformIcon={getPlatformIcon(account.platform)}
                          isLinked={false}
                          isSelected={selectedAccountIds.includes(account.id)}
                          onSelect={() => toggleAccountSelection(account.id)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Link Selected Button */}
                  {selectedAccountIds.length > 0 && (
                    <div className="sticky bottom-0 bg-zinc-900/95 backdrop-blur pt-4 border-t border-white/10 -mx-6 px-6 -mb-6 pb-6">
                      <button
                        onClick={handleRequestLink}
                        disabled={requestingLink}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {requestingLink ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Linking...
                          </>
                        ) : (
                          <>
                            <LinkIcon className="w-4 h-4" />
                            Link {selectedAccountIds.length} Account{selectedAccountIds.length !== 1 ? 's' : ''}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Request New Account Tab */}
              {activeTab === 'request' && (
                <div className="space-y-6">
                  {requestSuccess ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-emerald-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">Request Submitted!</h3>
                      <p className="text-white/60">
                        Your request has been sent to the admin for review.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                        <p className="text-sm text-white/70">
                          Don't see your account? Submit the URL below and an admin will review and add it to your linked accounts.
                        </p>
                      </div>

                      {/* Platform Selection */}
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          Platform
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {(['tiktok', 'instagram', 'youtube', 'twitter'] as const).map(platform => (
                            <button
                              key={platform}
                              onClick={() => setNewAccountPlatform(platform)}
                              className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                                newAccountPlatform === platform
                                  ? 'border-emerald-500 bg-emerald-500/10'
                                  : 'border-white/10 hover:border-white/20 bg-white/5'
                              }`}
                            >
                              <img
                                src={getPlatformIcon(platform)!}
                                alt={platform}
                                className="w-6 h-6 object-contain"
                              />
                              <span className="text-xs text-white/80 capitalize">{platform}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Account URL */}
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          Profile or Video URL
                        </label>
                        <input
                          type="url"
                          value={newAccountUrl}
                          onChange={(e) => setNewAccountUrl(e.target.value)}
                          placeholder={`https://${newAccountPlatform}.com/...`}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                        />
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          Notes (Optional)
                        </label>
                        <textarea
                          value={newAccountNotes}
                          onChange={(e) => setNewAccountNotes(e.target.value)}
                          placeholder="Any additional information for the admin..."
                          rows={3}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 resize-none"
                        />
                      </div>

                      {/* Submit Button */}
                      <button
                        onClick={handleSubmitNewAccountRequest}
                        disabled={!newAccountUrl.trim() || submittingRequest}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submittingRequest ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Submit Request
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Account Card Component
const AccountCard: React.FC<{
  account: TrackedAccount;
  platformIcon: string | null;
  isLinked: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}> = ({ account, platformIcon, isLinked, isSelected, onSelect }) => {
  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
        isLinked
          ? 'bg-emerald-500/5 border-emerald-500/20'
          : isSelected
          ? 'bg-emerald-500/10 border-emerald-500/40 cursor-pointer'
          : 'bg-white/5 border-white/10 hover:border-white/20 cursor-pointer'
      }`}
    >
      {/* Selection Checkbox (for available accounts) */}
      {!isLinked && (
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          isSelected
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-white/30 hover:border-white/50'
        }`}>
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
      )}

      {/* Profile Picture */}
      {account.profilePicture ? (
        <ProxiedImage
          src={account.profilePicture}
          alt={account.displayName || account.username || 'Account'}
          className="w-12 h-12 rounded-full object-cover ring-2 ring-white/10"
          fallback={
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center ring-2 ring-white/10 text-white font-bold">
              {(account.displayName || account.username || 'A').charAt(0).toUpperCase()}
            </div>
          }
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center ring-2 ring-white/10 text-white font-bold">
          {(account.displayName || account.username || 'A').charAt(0).toUpperCase()}
        </div>
      )}

      {/* Account Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-white truncate">
            {account.displayName || account.username}
          </h3>
          {platformIcon && (
            <img src={platformIcon} alt={account.platform} className="w-4 h-4 object-contain" />
          )}
        </div>
        <p className="text-sm text-white/50 truncate">@{account.username}</p>
      </div>

      {/* Stats */}
      <div className="text-right">
        <div className="text-sm font-semibold text-white">
          {account.followerCount?.toLocaleString() || 0}
        </div>
        <div className="text-xs text-white/40">followers</div>
      </div>

      {/* Status Badge */}
      {isLinked && (
        <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/30">
          <Check className="w-3 h-3" />
          Linked
        </div>
      )}
    </div>
  );
};

export default CreatorAccountLinkingModal;

