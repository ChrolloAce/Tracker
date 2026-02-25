import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types/firestore';
import TeamInvitationService from '../services/TeamInvitationService';
import OrganizationService from '../services/OrganizationService';
import UsageTrackingService from '../services/UsageTrackingService';
import AdminService from '../services/AdminService';
import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { X, Mail, UserPlus, AlertCircle, Crown } from 'lucide-react';

interface InviteTeamMemberModalProps {
  onClose: () => void;
  onSuccess: () => void;
  defaultRole?: Role;
  projectId?: string; // Optional: For adding creators to specific project
}

const InviteTeamMemberModal: React.FC<InviteTeamMemberModalProps> = ({ 
  onClose, 
  onSuccess,
  defaultRole = 'member',
  projectId
}) => {
  const { user, currentOrgId } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(defaultRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAtLimit, setIsAtLimit] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{ current: number; limit: number; active: number; pending: number } | null>(null);
  const [checkingLimit, setCheckingLimit] = useState(true);

  // Check team seat limit when modal opens (client-side with Firestore)
  useEffect(() => {
    const checkLimit = async () => {
      if (!currentOrgId || !user) {
        console.log('❌ Missing orgId or user, skipping limit check');
        return;
      }

      try {
        setCheckingLimit(true);
        console.log('🔍 [CLIENT] Checking team seat limit for org:', currentOrgId);
        
        // Admin / super admin bypass — never limit them
        const shouldBypass = await AdminService.shouldBypassLimits(user.uid);
        if (shouldBypass) {
          console.log('🔓 Admin user — bypassing team seat limit');
          setIsAtLimit(false);
          setLimitInfo({ current: 0, limit: -1, active: 0, pending: 0 });
          setCheckingLimit(false);
          return;
        }
        
        // Get organization's plan limits
        const limits = await UsageTrackingService.getLimits(currentOrgId);
        const seatLimit = limits.teamSeats;
        
        // Count active members
        const membersRef = collection(db, 'organizations', currentOrgId, 'members');
        const activeMembersQuery = query(membersRef, where('status', '==', 'active'));
        const activeMembersSnap = await getDocs(activeMembersQuery);
        const activeMembersCount = activeMembersSnap.size;
        
        // Count pending invitations
        const invitationsRef = collection(db, 'organizations', currentOrgId, 'teamInvitations');
        const pendingInvitesQuery = query(invitationsRef, where('status', '==', 'pending'));
        const pendingInvitesSnap = await getDocs(pendingInvitesQuery);
        const pendingInvitesCount = pendingInvitesSnap.size;
        
        const currentSeatsUsed = activeMembersCount + pendingInvitesCount;
        const isAtLimitValue = seatLimit !== -1 && currentSeatsUsed >= seatLimit;
        
        setLimitInfo({
          current: currentSeatsUsed,
          limit: seatLimit,
          active: activeMembersCount,
          pending: pendingInvitesCount
        });
        
        console.log(`👥 [CLIENT] Team seats: ${currentSeatsUsed}/${seatLimit} (${activeMembersCount} active + ${pendingInvitesCount} pending)`);
        console.log(`🚦 [CLIENT] At limit? ${isAtLimitValue}`);
        
        setIsAtLimit(isAtLimitValue);
      } catch (error) {
        console.error('❌ [CLIENT] Failed to check team limit:', error);
      } finally {
        setCheckingLimit(false);
        console.log('✅ [CLIENT] Limit check complete');
      }
    };

    checkLimit();
  }, [currentOrgId, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentOrgId) return;

    setError(null);
    setLoading(true);

    try {
      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      // Check if at limit (should be disabled, but as a fallback)
      if (isAtLimit && limitInfo) {
        throw new Error(
          `You've reached your team member limit (${limitInfo.limit} seats). You currently have ${limitInfo.active} active members and ${limitInfo.pending} pending invitations. Upgrade your plan to invite more members.`
        );
      }

      // Get organization details
      const org = await OrganizationService.getOrganization(currentOrgId);
      if (!org) {
        throw new Error('Organization not found');
      }

      // Send invitation (with optional projectId for creators)
      await TeamInvitationService.createInvitation(
        currentOrgId,
        email,
        role,
        user.uid,
        user.displayName || 'Unknown',
        user.email || '',
        org.name,
        projectId // Pass projectId if inviting a creator to a specific project
      );

      onSuccess();
    } catch (error: any) {
      console.error('Failed to send invitation:', error);
      setError(error.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-200 dark:border-white/10 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white dark:text-black" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Invite Team Member</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Team Limit Warning */}
          {!checkingLimit && isAtLimit && limitInfo && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">
                    Team Member Limit Reached
                  </div>
                  <div className="text-xs text-red-600/80 dark:text-red-400/80">
                    You're using {limitInfo.current}/{limitInfo.limit} seats 
                    ({limitInfo.active} active {limitInfo.active === 1 ? 'member' : 'members'} + {limitInfo.pending} pending {limitInfo.pending === 1 ? 'invitation' : 'invitations'})
                  </div>
                </div>
              </div>
              <a
                href="/settings?tab=billing"
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-white text-black hover:bg-gray-100 dark:hover:bg-gray-100 text-sm font-semibold rounded-lg transition-all"
              >
                <Crown className="w-4 h-4" />
                Upgrade Plan
              </a>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
              </div>
            </div>
          )}

          {/* Email Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                required
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 focus:border-transparent transition-colors"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              We'll send an invitation link to this email address
            </p>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 focus:border-transparent transition-colors"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <div className="mt-3 space-y-2 bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/10">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-900 dark:text-white">Member:</span> Can view and manage content
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-900 dark:text-white">Admin:</span> Can manage content and team members
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-900 dark:text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !email || isAtLimit || checkingLimit}
              className={`flex-1 px-4 py-3 font-semibold rounded-xl transition-colors disabled:cursor-not-allowed ${
                isAtLimit 
                  ? 'bg-red-500 dark:bg-red-500 text-white opacity-75 cursor-not-allowed' 
                  : 'bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-black disabled:opacity-50'
              }`}
            >
              {checkingLimit ? 'Checking...' : loading ? 'Sending...' : isAtLimit ? 'Limit Reached' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteTeamMemberModal;

