import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { OrgMember, Creator } from '../types/firestore';
import OrganizationService from '../services/OrganizationService';
import CreatorLinksService from '../services/CreatorLinksService';
import { UserPlus, Video, Link as LinkIcon, DollarSign, User, X } from 'lucide-react';
import { Button } from './ui/Button';
import InviteTeamMemberModal from './InviteTeamMemberModal';
import LinkCreatorAccountsModal from './LinkCreatorAccountsModal';

/**
 * CreatorsManagementPage
 * Admin interface to manage creators, link accounts, and track payouts
 */
const CreatorsManagementPage: React.FC = () => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  const [creators, setCreators] = useState<OrgMember[]>([]);
  const [creatorProfiles, setCreatorProfiles] = useState<Map<string, Creator>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [linkingCreator, setLinkingCreator] = useState<OrgMember | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [currentOrgId, currentProjectId, user]);

  const loadData = async () => {
    if (!currentOrgId || !currentProjectId || !user) return;

    setLoading(true);
    try {
      // Load creators for THIS PROJECT
      const creatorProfilesList = await CreatorLinksService.getAllCreators(currentOrgId, currentProjectId);
      
      // Load member data for each creator
      const membersData = await OrganizationService.getOrgMembers(currentOrgId);
      const creatorMembers = membersData.filter(m => 
        creatorProfilesList.some(p => p.id === m.userId)
      );
      setCreators(creatorMembers);

      // Store creator profiles
      const creatorProfilesMap = new Map<string, Creator>();
      creatorProfilesList.forEach(profile => {
        creatorProfilesMap.set(profile.id, profile);
      });
      setCreatorProfiles(creatorProfilesMap);
    } catch (error) {
      console.error('Failed to load creators:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCreator = async (userId: string) => {
    if (!currentOrgId || !currentProjectId || !user) return;
    
    if (!window.confirm('Are you sure you want to remove this creator from this project? This will unlink all their accounts in this project.')) {
      return;
    }

    setActionLoading(userId);
    try {
      // Remove all creator links from THIS PROJECT
      await CreatorLinksService.removeAllCreatorLinks(currentOrgId, currentProjectId, userId);
      
      await loadData();
    } catch (error) {
      console.error('Failed to remove creator:', error);
      alert('Failed to remove creator from project');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading creators...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Creators</h1>
          <p className="text-gray-400 mt-1">
            Manage content creators in this project, link accounts, and track earnings
          </p>
        </div>
        <Button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2"
          title="Invite a new creator by email"
        >
          <UserPlus className="w-4 h-4" />
          Invite Creator
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <User className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{creators.length}</div>
              <div className="text-xs text-gray-400">Total Creators</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <LinkIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {Array.from(creatorProfiles.values()).reduce((sum, p) => sum + p.linkedAccountsCount, 0)}
              </div>
              <div className="text-xs text-gray-400">Linked Accounts</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                ${Array.from(creatorProfiles.values()).reduce((sum, p) => sum + p.totalEarnings, 0).toFixed(2)}
              </div>
              <div className="text-xs text-gray-400">Total Paid Out</div>
            </div>
          </div>
        </div>
      </div>

      {/* Creators List */}
      {creators.length === 0 ? (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-12 text-center">
          <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No creators yet</h3>
          <p className="text-gray-400 mb-4">
            Invite content creators to track their accounts and manage payouts
          </p>
          <Button
            onClick={() => setShowInviteModal(true)}
            className="mx-auto"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Invite Your First Creator
          </Button>
        </div>
      ) : (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">
              All Creators ({creators.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Creator
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Linked Accounts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Total Earnings
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {creators.map((creator) => {
                  const profile = creatorProfiles.get(creator.userId);
                  
                  return (
                    <tr key={creator.userId} className="hover:bg-gray-800/30">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10">
                            {creator.photoURL ? (
                              <img
                                src={creator.photoURL}
                                alt={creator.displayName || 'Creator'}
                                className="w-10 h-10 rounded-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const placeholder = e.currentTarget.parentElement?.querySelector('.placeholder-icon');
                                  if (placeholder) {
                                    (placeholder as HTMLElement).classList.remove('hidden');
                                  }
                                }}
                              />
                            ) : null}
                            <div className={`placeholder-icon w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center ${creator.photoURL ? 'hidden' : ''}`}>
                              <Video className="w-5 h-5 text-gray-400" />
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">
                              {creator.displayName || 'Unknown Creator'}
                            </div>
                            <div className="text-sm text-gray-400">{creator.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white font-medium">
                          {profile?.linkedAccountsCount || 0} accounts
                        </div>
                        {profile?.payoutsEnabled && (
                          <div className="text-xs text-green-400 mt-0.5">
                            Payouts enabled
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">
                          ${(profile?.totalEarnings || 0).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {formatDate(creator.joinedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLinkingCreator(creator)}
                            disabled={actionLoading === creator.userId}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                            title="Link Accounts"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveCreator(creator.userId)}
                            disabled={actionLoading === creator.userId}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            title="Remove Creator"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Modal - Pre-set to Creator role */}
      {showInviteModal && (
        <InviteTeamMemberModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false);
            loadData();
          }}
          defaultRole="creator"
        />
      )}

      {/* Link Creator Accounts Modal */}
      {linkingCreator && (
        <LinkCreatorAccountsModal
          creator={linkingCreator}
          onClose={() => setLinkingCreator(null)}
          onSuccess={() => {
            setLinkingCreator(null);
            loadData();
          }}
        />
      )}
    </div>
  );
};

export default CreatorsManagementPage;

