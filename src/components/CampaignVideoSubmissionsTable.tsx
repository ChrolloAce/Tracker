import React, { useState } from 'react';
import { 
  Video, 
  Eye, 
  ThumbsUp, 
  MessageCircle, 
  Share2, 
  ExternalLink,
  Check,
  X,
  Clock,
  AlertCircle,
  Trash2,
  MessageSquare,
  Filter,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { CampaignVideoSubmission, VideoSubmissionStatus } from '../types/campaigns';
import { useAuth } from '../contexts/AuthContext';
import CampaignService from '../services/CampaignService';

interface CampaignVideoSubmissionsTableProps {
  submissions: CampaignVideoSubmission[];
  campaignId: string;
  onRefresh: () => void;
  isCreator?: boolean;
}

const CampaignVideoSubmissionsTable: React.FC<CampaignVideoSubmissionsTableProps> = ({
  submissions,
  campaignId,
  onRefresh,
  isCreator = false,
}) => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<{ id: string; action: 'reject' | 'needs_changes' } | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [filterStatus, setFilterStatus] = useState<VideoSubmissionStatus | 'all'>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const getStatusIcon = (status: VideoSubmissionStatus) => {
    switch (status) {
      case 'approved':
        return <Check className="w-4 h-4" />;
      case 'rejected':
        return <X className="w-4 h-4" />;
      case 'needs_changes':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: VideoSubmissionStatus) => {
    const config = {
      pending: { 
        bg: 'bg-amber-500/10', 
        text: 'text-amber-400', 
        border: 'border-amber-500/30',
        label: 'Pending Review'
      },
      approved: { 
        bg: 'bg-emerald-500/10', 
        text: 'text-emerald-400', 
        border: 'border-emerald-500/30',
        label: 'Approved'
      },
      rejected: { 
        bg: 'bg-red-500/10', 
        text: 'text-red-400', 
        border: 'border-red-500/30',
        label: 'Rejected'
      },
      needs_changes: { 
        bg: 'bg-orange-500/10', 
        text: 'text-orange-400', 
        border: 'border-orange-500/30',
        label: 'Needs Changes'
      },
    };

    const style = config[status];

    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}>
        {getStatusIcon(status)}
        <span>{style.label}</span>
      </div>
    );
  };

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'instagram':
        return 'text-pink-400 bg-pink-500/10';
      case 'tiktok':
        return 'text-cyan-400 bg-cyan-500/10';
      case 'youtube':
        return 'text-red-400 bg-red-500/10';
      case 'twitter':
        return 'text-blue-400 bg-blue-500/10';
      default:
        return 'text-gray-400 bg-gray-500/10';
    }
  };

  const handleUpdateStatus = async (
    submissionId: string,
    status: VideoSubmissionStatus,
    reviewNotes?: string
  ) => {
    if (!currentOrgId || !currentProjectId || !user) return;

    try {
      setProcessingId(submissionId);
      await CampaignService.updateSubmissionStatus(
        currentOrgId,
        currentProjectId,
        campaignId,
        submissionId,
        status,
        reviewNotes,
        user.uid
      );
      onRefresh();
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setProcessingId(null);
      setFeedbackModal(null);
      setFeedbackText('');
    }
  };

  const handleDelete = async (submissionId: string) => {
    if (!currentOrgId || !currentProjectId) return;
    if (!confirm('Are you sure you want to delete this submission?')) return;

    try {
      setProcessingId(submissionId);
      await CampaignService.deleteSubmission(
        currentOrgId,
        currentProjectId,
        campaignId,
        submissionId
      );
      onRefresh();
    } catch (error) {
      console.error('Failed to delete submission:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const filteredSubmissions = filterStatus === 'all' 
    ? submissions 
    : submissions.filter(s => s.status === filterStatus);

  const statusCounts = {
    all: submissions.length,
    pending: submissions.filter(s => s.status === 'pending').length,
    approved: submissions.filter(s => s.status === 'approved').length,
    rejected: submissions.filter(s => s.status === 'rejected').length,
    needs_changes: submissions.filter(s => s.status === 'needs_changes').length,
  };

  if (submissions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
          <Video className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-400 text-lg">No video submissions yet</p>
        <p className="text-gray-500 text-sm mt-2">
          {isCreator ? 'Submit your first video to get started' : 'Waiting for creator submissions'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      {!isCreator && submissions.length > 1 && (
        <div className="flex items-center justify-between mb-4">
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span>
                {filterStatus === 'all' ? 'All Submissions' : getStatusBadge(filterStatus)}
              </span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showFilterDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowFilterDropdown(false)} 
                />
                <div className="absolute top-full left-0 mt-2 w-56 bg-zinc-900 border border-white/10 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                  {(['all', 'pending', 'approved', 'rejected', 'needs_changes'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => {
                        setFilterStatus(status);
                        setShowFilterDropdown(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition-colors ${
                        filterStatus === status 
                          ? 'bg-emerald-500/10 text-emerald-400' 
                          : 'text-white hover:bg-white/5'
                      }`}
                    >
                      <span className="capitalize">{status === 'all' ? 'All Submissions' : status.replace('_', ' ')}</span>
                      <span className="text-white/40">{statusCounts[status]}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-400 rounded-full" />
              <span className="text-white/60">{statusCounts.pending} pending</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full" />
              <span className="text-white/60">{statusCounts.approved} approved</span>
            </div>
          </div>
        </div>
      )}

      {/* Submissions List */}
      {filteredSubmissions.map((submission) => (
        <div
          key={submission.id}
          className={`bg-white/5 border rounded-xl p-4 sm:p-6 transition-all ${
            submission.status === 'pending' 
              ? 'border-amber-500/30 hover:border-amber-500/50' 
              : 'border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            {/* Thumbnail */}
            <div className="flex-shrink-0">
              <div className="w-full sm:w-32 h-40 sm:h-32 bg-zinc-800 rounded-lg overflow-hidden relative group">
                {submission.thumbnail ? (
                  <img
                    src={submission.thumbnail}
                    alt="Video thumbnail"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video className="w-8 h-8 text-gray-600" />
                  </div>
                )}
                {/* Platform Badge */}
                <div className={`absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-semibold capitalize ${getPlatformColor(submission.platform)}`}>
                  {submission.platform}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-white truncate">
                      {submission.title || 'Untitled Video'}
                    </h3>
                    {getStatusBadge(submission.status)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-gray-400">
                    <span>Submitted {formatDate(submission.submittedAt)}</span>
                    {submission.ruleName && (
                      <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md text-xs">
                        {submission.ruleName}
                      </span>
                    )}
                  </div>
                </div>

                <a
                  href={submission.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Video
                </a>
              </div>

              {/* Description */}
              {submission.description && (
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">{submission.description}</p>
              )}

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
                    <Eye className="w-3.5 h-3.5" />
                    Views
                  </div>
                  <div className="text-white font-semibold">{formatNumber(submission.views)}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    Likes
                  </div>
                  <div className="text-white font-semibold">{formatNumber(submission.likes)}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
                    <MessageCircle className="w-3.5 h-3.5" />
                    Comments
                  </div>
                  <div className="text-white font-semibold">{formatNumber(submission.comments)}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
                    <Share2 className="w-3.5 h-3.5" />
                    Shares
                  </div>
                  <div className="text-white font-semibold">{formatNumber(submission.shares)}</div>
                </div>
                {submission.engagementRate > 0 && (
                  <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/20">
                    <div className="text-emerald-400/70 text-xs mb-1">Engagement</div>
                    <div className="text-emerald-400 font-semibold">{submission.engagementRate.toFixed(2)}%</div>
                  </div>
                )}
              </div>

              {/* Earnings */}
              {submission.totalEarnings > 0 && (
                <div className="flex items-center gap-2 text-sm mb-4 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                  <span className="text-gray-400">Estimated Earnings:</span>
                  <span className="text-emerald-400 font-bold text-lg">
                    ${submission.totalEarnings.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Review Notes */}
              {submission.reviewNotes && (
                <div className={`p-4 rounded-lg mb-4 ${
                  submission.status === 'rejected' 
                    ? 'bg-red-500/10 border border-red-500/20' 
                    : submission.status === 'needs_changes'
                    ? 'bg-orange-500/10 border border-orange-500/20'
                    : 'bg-blue-500/10 border border-blue-500/20'
                }`}>
                  <div className="flex items-start gap-2">
                    <MessageSquare className={`w-4 h-4 mt-0.5 ${
                      submission.status === 'rejected' 
                        ? 'text-red-400' 
                        : submission.status === 'needs_changes'
                        ? 'text-orange-400'
                        : 'text-blue-400'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-white mb-1">Reviewer Feedback</p>
                      <p className={`text-sm ${
                        submission.status === 'rejected' 
                          ? 'text-red-300' 
                          : submission.status === 'needs_changes'
                          ? 'text-orange-300'
                          : 'text-blue-300'
                      }`}>
                        {submission.reviewNotes}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Actions */}
              {!isCreator && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                  {submission.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(submission.id, 'approved')}
                        disabled={processingId === submission.id}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                      >
                        {processingId === submission.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => setFeedbackModal({ id: submission.id, action: 'needs_changes' })}
                        disabled={processingId === submission.id}
                        className="flex items-center gap-2 px-4 py-2.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-400 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                      >
                        <AlertCircle className="w-4 h-4" />
                        Request Changes
                      </button>
                      <button
                        onClick={() => setFeedbackModal({ id: submission.id, action: 'reject' })}
                        disabled={processingId === submission.id}
                        className="flex items-center gap-2 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </button>
                    </>
                  )}
                  {submission.status !== 'pending' && submission.status !== 'approved' && (
                    <button
                      onClick={() => handleUpdateStatus(submission.id, 'approved')}
                      disabled={processingId === submission.id}
                      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                    >
                      {processingId === submission.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Approve
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(submission.id)}
                    disabled={processingId === submission.id}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-gray-400 hover:text-red-400 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ml-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Feedback Modal */}
      {feedbackModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full border border-white/10 overflow-hidden">
            <div className={`p-6 border-b border-white/10 ${
              feedbackModal.action === 'reject' ? 'bg-red-500/10' : 'bg-orange-500/10'
            }`}>
              <h3 className={`text-lg font-bold flex items-center gap-2 ${
                feedbackModal.action === 'reject' ? 'text-red-400' : 'text-orange-400'
              }`}>
                {feedbackModal.action === 'reject' ? (
                  <>
                    <X className="w-5 h-5" />
                    Reject Submission
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5" />
                    Request Changes
                  </>
                )}
              </h3>
              <p className="text-sm text-white/60 mt-1">
                {feedbackModal.action === 'reject' 
                  ? 'Provide a reason for rejecting this submission.'
                  : 'Explain what changes are needed for approval.'
                }
              </p>
            </div>

            <div className="p-6">
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder={feedbackModal.action === 'reject' 
                  ? 'e.g., Video does not meet content guidelines...'
                  : 'e.g., Please add the branded hashtag to the description...'
                }
                rows={4}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
                autoFocus
              />
            </div>

            <div className="flex gap-3 p-6 border-t border-white/10">
              <button
                onClick={() => {
                  setFeedbackModal(null);
                  setFeedbackText('');
                }}
                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateStatus(
                  feedbackModal.id, 
                  feedbackModal.action === 'reject' ? 'rejected' : 'needs_changes',
                  feedbackText || (feedbackModal.action === 'reject' ? 'Video rejected' : 'Changes requested')
                )}
                disabled={processingId === feedbackModal.id}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-colors ${
                  feedbackModal.action === 'reject'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-orange-500 hover:bg-orange-600 text-white'
                }`}
              >
                {processingId === feedbackModal.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : feedbackModal.action === 'reject' ? (
                  <>
                    <X className="w-4 h-4" />
                    Reject
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    Request Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignVideoSubmissionsTable;
