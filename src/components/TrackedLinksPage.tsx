import React, { useState, useEffect } from 'react';
import { Link as LinkIcon, Plus, Copy, ExternalLink, Trash2, BarChart, QrCode, Search, RefreshCw } from 'lucide-react';
import { TrackedLink, TrackedAccount } from '../types/firestore';
import FirestoreDataService from '../services/FirestoreDataService';
import CreateLinkModal from './CreateLinkModal';
import LinkAnalyticsModal from './LinkAnalyticsModal';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';

const TrackedLinksPage: React.FC = () => {
  const { currentOrgId, currentProjectId, user } = useAuth();
  const [links, setLinks] = useState<TrackedLink[]>([]);
  const [accounts, setAccounts] = useState<Map<string, TrackedAccount>>(new Map());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<TrackedLink | null>(null);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentOrgId && currentProjectId) {
      loadLinks();
      loadAccounts();
      
      // Set up auto-refresh every 10 seconds to update click counts
      const interval = setInterval(() => {
        loadLinks(false); // Don't show loading on auto-refresh
      }, 10000);
      
      return () => clearInterval(interval);
    }
  }, [currentOrgId, currentProjectId]);

  const loadAccounts = async () => {
    if (!currentOrgId || !currentProjectId) return;
    try {
      const accountsData = await FirestoreDataService.getTrackedAccounts(currentOrgId, currentProjectId);
      const accountsMap = new Map(accountsData.map(acc => [acc.id, acc]));
      setAccounts(accountsMap);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const loadLinks = async (showRefreshIndicator = true) => {
    if (!currentOrgId || !currentProjectId) {
      return;
    }
    
    // Only show loading skeleton on initial load
    if (showRefreshIndicator && links.length === 0) {
      setLoading(true);
    } else if (showRefreshIndicator) {
      setIsRefreshing(true);
    }
    
    try {
      console.log('🔗 Loading tracked links...');
      const allLinks = await FirestoreDataService.getLinks(currentOrgId, currentProjectId);
      console.log(`✅ Loaded ${allLinks.length} links with click data:`, 
        allLinks.map(l => ({ title: l.title, clicks: l.totalClicks || 0 }))
      );
      setLinks(allLinks);
    } catch (error) {
      console.error('❌ Failed to load links:', error);
    } finally {
      if (showRefreshIndicator) setIsRefreshing(false);
      setLoading(false);
    }
  };

  const handleCreateLink = async (originalUrl: string, title: string, description?: string, tags?: string[], linkedAccountId?: string) => {
    if (!currentOrgId || !currentProjectId || !user) return;
    
    try {
      // Generate unique short code
      const shortCode = generateShortCode();
      
      await FirestoreDataService.createLink(currentOrgId, currentProjectId, user.uid, {
        shortCode,
        originalUrl,
        title,
        description,
        tags,
        linkedAccountId,
        linkedVideoId: undefined,
        lastClickedAt: undefined,
        isActive: true
      });
      
      await loadLinks();
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error('Failed to create link:', error);
      alert('Failed to create link. Please try again.');
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!currentOrgId || !currentProjectId || !window.confirm('Are you sure you want to delete this link?')) return;
    
    try {
      await FirestoreDataService.deleteLink(currentOrgId, currentProjectId, linkId);
      await loadLinks();
    } catch (error) {
      console.error('Failed to delete link:', error);
      alert('Failed to delete link. Please try again.');
    }
  };

  // Helper to generate short code
  const generateShortCode = (length: number = 6): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCopyLink = (shortCode: string) => {
    const url = `${window.location.origin}/l/${shortCode}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(shortCode);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleViewAnalytics = (link: TrackedLink) => {
    setSelectedLink(link);
    setIsAnalyticsModalOpen(true);
  };

  const filteredLinks = links.filter(link => 
    link.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    link.originalUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
    link.shortCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  if (loading) {
    return <PageLoadingSkeleton type="links" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#161616] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Tracked Links</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Create short links and track their performance
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => loadLinks(true)}
              disabled={isRefreshing}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 dark:border-gray-700"
            >
              <Plus className="w-4 h-4" />
              <span>Create Link</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search links..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#161616] rounded-lg p-4 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Links</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{links.length}</p>
            </div>
            <LinkIcon className="w-8 h-8 text-blue-500 opacity-20" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-[#161616] rounded-lg p-4 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Clicks</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatNumber(links.reduce((sum, link) => sum + (link.totalClicks || 0), 0))}
              </p>
            </div>
            <BarChart className="w-8 h-8 text-green-500 opacity-20" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-[#161616] rounded-lg p-4 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Unique Clicks</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatNumber(links.reduce((sum, link) => sum + (link.uniqueClicks || 0), 0))}
              </p>
            </div>
            <BarChart className="w-8 h-8 text-purple-500 opacity-20" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-[#161616] rounded-lg p-4 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg CTR</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {links.length > 0 
                  ? `${((links.reduce((sum, link) => sum + link.uniqueClicks, 0) / links.length) * 0.1).toFixed(1)}%`
                  : '0%'
                }
              </p>
            </div>
            <BarChart className="w-8 h-8 text-orange-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Links Table */}
      <div className="bg-white dark:bg-[#161616] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Link Details
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Short URL
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Clicks
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filteredLinks.length > 0 ? (
                filteredLinks.map((link) => {
                  const linkedAccount = link.linkedAccountId ? accounts.get(link.linkedAccountId) : null;
                  
                  return (
                    <tr key={link.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          {linkedAccount && (
                            <div className="flex-shrink-0">
                              {linkedAccount.profilePicture ? (
                                <img
                                  src={linkedAccount.profilePicture}
                                  alt={linkedAccount.username}
                                  className="w-8 h-8 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                                    {linkedAccount.username.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {link.title}
                            </p>
                            <div className="flex items-center space-x-1 mt-1">
                              {linkedAccount && (
                                <span className="text-xs text-blue-600 dark:text-blue-400 mr-2">
                                  @{linkedAccount.username}
                                </span>
                              )}
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                                {link.originalUrl}
                              </p>
                              <a
                                href={link.originalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            {link.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {link.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          /{link.shortCode}
                        </code>
                        <button
                          onClick={() => handleCopyLink(link.shortCode)}
                          className={clsx(
                            "p-1 rounded transition-colors",
                            copiedCode === link.shortCode
                              ? "text-green-600 dark:text-green-400"
                              : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          )}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatNumber(link.totalClicks || 0)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {(link.uniqueClicks || 0)} unique
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {link.createdAt.toDate().toLocaleDateString()}
                      </p>
                      {link.lastClickedAt && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Last: {link.lastClickedAt.toDate().toLocaleDateString()}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewAnalytics(link)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          title="View Analytics"
                        >
                          <BarChart className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                          title="Generate QR Code"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLink(link.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Delete Link"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <LinkIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                      <p className="text-gray-500 dark:text-gray-400">
                        {searchQuery ? 'No links found matching your search' : 'No tracked links yet'}
                      </p>
                      {!searchQuery && (
                          <button
                          onClick={() => setIsCreateModalOpen(true)}
                          className="mt-4 px-4 py-2 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 dark:border-gray-700"
                        >
                          Create Your First Link
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {isCreateModalOpen && (
        <CreateLinkModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateLink}
        />
      )}

      {isAnalyticsModalOpen && selectedLink && (
        <LinkAnalyticsModal
          isOpen={isAnalyticsModalOpen}
          onClose={() => {
            setIsAnalyticsModalOpen(false);
            setSelectedLink(null);
          }}
          link={selectedLink}
        />
      )}
    </div>
  );
};

export default TrackedLinksPage;
