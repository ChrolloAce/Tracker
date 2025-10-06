import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import TrackingJobService, { TrackingJob } from '../services/TrackingJobService';
import { Loader, CheckCircle2, XCircle, RefreshCw, X, Clock } from 'lucide-react';
import { PlatformIcon } from './ui/PlatformIcon';

interface TrackingJobsPanelProps {
  onJobCompleted?: (accountId: string) => void;
}

/**
 * TrackingJobsPanel
 * Shows real-time status of background tracking jobs
 */
const TrackingJobsPanel: React.FC<TrackingJobsPanelProps> = ({ onJobCompleted }) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [jobs, setJobs] = useState<TrackingJob[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (!currentOrgId || !currentProjectId) return;

    // Watch for job updates in real-time
    const unsubscribe = TrackingJobService.watchProjectJobs(
      currentOrgId,
      currentProjectId,
      (updatedJobs) => {
        setJobs(updatedJobs);
        
        // Check for newly completed jobs
        updatedJobs.forEach(job => {
          if (job.status === 'completed' && job.accountId) {
            onJobCompleted?.(job.accountId);
          }
        });
      },
      (error) => {
        console.error('Error watching jobs:', error);
      }
    );

    return () => unsubscribe();
  }, [currentOrgId, currentProjectId, onJobCompleted]);

  // Filter to show only active jobs (pending, processing) and recent completed/failed
  const activeJobs = jobs.filter(job => 
    job.status === 'pending' || 
    job.status === 'processing' ||
    (job.completedAt && Date.now() - job.completedAt.toMillis() < 5 * 60 * 1000) // Last 5 minutes
  );

  if (activeJobs.length === 0) return null;

  const handleRetry = async (jobId: string) => {
    try {
      await TrackingJobService.retryJob(jobId);
    } catch (error) {
      console.error('Failed to retry job:', error);
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      await TrackingJobService.cancelJob(jobId);
    } catch (error) {
      console.error('Failed to cancel job:', error);
    }
  };

  const getStatusIcon = (status: TrackingJob['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'processing':
        return <Loader className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
    }
  };

  const getStatusColor = (status: TrackingJob['status']) => {
    switch (status) {
      case 'pending':
        return 'border-yellow-500/20 bg-yellow-500/5';
      case 'processing':
        return 'border-blue-500/20 bg-blue-500/5';
      case 'completed':
        return 'border-green-500/20 bg-green-500/5';
      case 'failed':
        return 'border-red-500/20 bg-red-500/5';
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96">
      <div className="rounded-xl bg-zinc-900 border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div 
          className="flex items-center justify-between px-4 py-3 bg-zinc-800/50 border-b border-white/10 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <Loader className="w-4 h-4 text-blue-400 animate-spin" />
            <span className="text-sm font-semibold text-white">
              Tracking Jobs ({activeJobs.length})
            </span>
          </div>
          <button
            className="text-gray-400 hover:text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Jobs List */}
        {isExpanded && (
          <div className="max-h-96 overflow-y-auto">
            {activeJobs.map(job => (
              <div
                key={job.id}
                className={`p-4 border-b border-white/5 ${getStatusColor(job.status)}`}
              >
                <div className="flex items-start gap-3">
                  {/* Status Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getStatusIcon(job.status)}
                  </div>

                  {/* Job Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <PlatformIcon platform={job.platform} size="sm" />
                      <span className="text-sm font-semibold text-white truncate">
                        @{job.username}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        job.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                        job.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {job.status}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 mb-2">
                      {job.message}
                    </p>

                    {/* Progress Bar */}
                    {(job.status === 'processing' || job.status === 'pending') && (
                      <div className="w-full bg-gray-700 rounded-full h-1.5 mb-2">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    )}

                    {/* Error Message */}
                    {job.status === 'failed' && job.error && (
                      <div className="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1 mb-2">
                        {job.error}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {job.status === 'failed' && (
                        <button
                          onClick={() => handleRetry(job.id)}
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Retry
                        </button>
                      )}
                      {(job.status === 'pending' || job.status === 'processing') && (
                        <button
                          onClick={() => handleCancel(job.id)}
                          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                        >
                          <X className="w-3 h-3" />
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackingJobsPanel;
