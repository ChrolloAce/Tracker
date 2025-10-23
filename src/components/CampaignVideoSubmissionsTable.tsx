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
  Trash2
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

  const getStatusIcon = (status: VideoSubmissionStatus) => {
    switch (status) {
      case 'approved':
        return <Check className="w-4 h-4 text-emerald-400" />;
      case 'rejected':
        return <X className="w-4 h-4 text-red-400" />;
      case 'needs_changes':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: VideoSubmissionStatus) => {
    const styles = {
      pending: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
      approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      rejected: 'bg-red-500/10 text-red-400 border-red-500/30',
      needs_changes: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    };

    return (
      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
        {getStatusIcon(status)}
        <span className="capitalize">{status.replace('_', ' ')}</span>
      </div>
    );
  };

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'instagram':
        return 'text-pink-400';
      case 'tiktok':
        return 'text-cyan-400';
      case 'youtube':
        return 'text-red-400';
      case 'twitter':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
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
      {submissions.map((submission) => (
        <div
          key={submission.id}
          className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/[0.07] transition-all"
        >
          <div className="flex gap-6">
            {/* Thumbnail */}
            <div className="flex-shrink-0">
              <div className="w-32 h-32 bg-zinc-800 rounded-lg overflow-hidden">
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
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white truncate">
                      {submission.title || 'Untitled Video'}
                    </h3>
                    {getStatusBadge(submission.status)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className={`capitalize font-medium ${getPlatformColor(submission.platform)}`}>
                      {submission.platform}
                    </span>
                    <span>•</span>
                    <span>Submitted {formatDate(submission.submittedAt)}</span>
                    {submission.ruleName && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-400">Rule: {submission.ruleName}</span>
                      </>
                    )}
                  </div>
                </div>

                <a
                  href={submission.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  View
                </a>
              </div>

              {/* Description */}
              {submission.description && (
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">{submission.description}</p>
              )}

              {/* Metrics */}
              <div className="flex items-center gap-6 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Eye className="w-4 h-4 text-gray-400" />
                  <span className="text-white font-medium">{formatNumber(submission.views)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <ThumbsUp className="w-4 h-4 text-gray-400" />
                  <span className="text-white font-medium">{formatNumber(submission.likes)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MessageCircle className="w-4 h-4 text-gray-400" />
                  <span className="text-white font-medium">{formatNumber(submission.comments)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Share2 className="w-4 h-4 text-gray-400" />
                  <span className="text-white font-medium">{formatNumber(submission.shares)}</span>
                </div>
                {submission.engagementRate > 0 && (
                  <div className="text-sm">
                    <span className="text-gray-400">ER: </span>
                    <span className="text-emerald-400 font-medium">
                      {submission.engagementRate.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Earnings */}
              {submission.totalEarnings > 0 && (
                <div className="flex items-center gap-2 text-sm mb-4">
                  <span className="text-gray-400">Earnings:</span>
                  <span className="text-emerald-400 font-semibold">
                    ${submission.totalEarnings.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Review Notes */}
              {submission.reviewNotes && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-4">
                  <p className="text-sm text-blue-300">
                    <strong>Review Notes:</strong> {submission.reviewNotes}
                  </p>
                </div>
              )}

              {/* Admin Actions */}
              {!isCreator && (
                <div className="flex gap-2">
                  {submission.status !== 'approved' && (
                    <button
                      onClick={() => handleUpdateStatus(submission.id, 'approved')}
                      disabled={processingId === submission.id}
                      className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                    >
                      Approve
                    </button>
                  )}
                  {submission.status !== 'rejected' && (
                    <button
                      onClick={() => handleUpdateStatus(submission.id, 'rejected', 'Video does not meet requirements')}
                      disabled={processingId === submission.id}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                    >
                      Reject
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(submission.id)}
                    disabled={processingId === submission.id}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-red-400 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ml-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CampaignVideoSubmissionsTable;

