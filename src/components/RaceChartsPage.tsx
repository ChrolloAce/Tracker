import React, { useState, useEffect } from 'react';
import { TrendingUp, Trophy, Target } from 'lucide-react';
import BarChartRace from './BarChartRace';
import { VideoSubmission } from '../types';
import { TrackedAccount, AccountVideo } from '../types/accounts';
import { useAuth } from '../contexts/AuthContext';
import { AccountTrackingServiceFirebase } from '../services/AccountTrackingServiceFirebase';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import { clsx } from 'clsx';

const RaceChartsPage: React.FC = () => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  const [submissions, setSubmissions] = useState<VideoSubmission[]>([]);
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'platforms' | 'accounts'>('platforms');
  const [selectedMetric, setSelectedMetric] = useState<'views' | 'engagement' | 'videos'>('views');

  useEffect(() => {
    const loadData = async () => {
      if (!currentOrgId || !currentProjectId) return;
      
      setLoading(true);
      try {
        // Load accounts
        const accountsList = await AccountTrackingServiceFirebase.getTrackedAccounts(
          currentOrgId,
          currentProjectId
        );
        setAccounts(accountsList);

        // Load all videos from all accounts
        const allVideos: VideoSubmission[] = [];
        
        for (const account of accountsList) {
          const videos = await AccountTrackingServiceFirebase.getAccountVideos(
            currentOrgId,
            currentProjectId,
            account.id
          );
          
          // Convert AccountVideo to VideoSubmission format
          videos.forEach((video: AccountVideo) => {
            allVideos.push({
              id: video.id,
              url: video.url,
              platform: account.platform,
              thumbnail: video.thumbnail || '',
              title: video.caption || '',
              uploader: account.displayName || account.username,
              uploaderHandle: account.username,
              status: 'approved',
              views: video.views || 0,
              likes: video.likes || 0,
              comments: video.comments || 0,
              shares: video.shares || 0,
              dateSubmitted: new Date(),
              uploadDate: video.uploadDate || new Date(),
              snapshots: [] // AccountVideo doesn't have snapshots
            });
          });
        }

        setSubmissions(allVideos);
      } catch (error) {
        console.error('Failed to load race chart data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentOrgId, currentProjectId]);

  if (loading) {
    return <PageLoadingSkeleton type="dashboard" />;
  }

  if (!user || !currentOrgId) {
    return <PageLoadingSkeleton type="dashboard" />;
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-500" />
            Competition Dashboard
          </h1>
          <p className="text-gray-400 mt-2">
            Watch platforms and accounts compete in real-time
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="bg-zinc-900/40 backdrop-blur border border-white/10 rounded-xl p-2 inline-flex gap-2">
        <button
          onClick={() => setActiveTab('platforms')}
          className={clsx(
            'px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center gap-2',
            activeTab === 'platforms'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          )}
        >
          <TrendingUp className="w-5 h-5" />
          Platforms Race
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={clsx(
            'px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center gap-2',
            activeTab === 'accounts'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          )}
        >
          <Target className="w-5 h-5" />
          Accounts Race
        </button>
      </div>

      {/* Metric Selector */}
      <div className="bg-zinc-900/40 backdrop-blur border border-white/10 rounded-xl p-4">
        <label className="text-sm font-medium text-gray-400 mb-3 block">
          Racing Metric
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => setSelectedMetric('views')}
            className={clsx(
              'px-4 py-2 rounded-lg font-medium transition-all duration-200',
              selectedMetric === 'views'
                ? 'bg-emerald-600 text-white'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            )}
          >
            Total Views
          </button>
          <button
            onClick={() => setSelectedMetric('engagement')}
            className={clsx(
              'px-4 py-2 rounded-lg font-medium transition-all duration-200',
              selectedMetric === 'engagement'
                ? 'bg-pink-600 text-white'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            )}
          >
            Total Engagement
          </button>
          <button
            onClick={() => setSelectedMetric('videos')}
            className={clsx(
              'px-4 py-2 rounded-lg font-medium transition-all duration-200',
              selectedMetric === 'videos'
                ? 'bg-violet-600 text-white'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            )}
          >
            Video Count
          </button>
        </div>
      </div>

      {/* Race Chart */}
      <div className="min-h-[800px]">
        {submissions.length === 0 ? (
          <div className="bg-zinc-900/60 backdrop-blur border border-white/10 rounded-2xl p-12 text-center">
            <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Data Available</h3>
            <p className="text-gray-400">
              Add some tracked accounts to see the competition!
            </p>
          </div>
        ) : (
          <BarChartRace
            submissions={submissions}
            accounts={accounts}
            mode={activeTab}
            metric={selectedMetric}
          />
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-500/10 to-transparent backdrop-blur border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="font-semibold text-white">Time Travel</h3>
          </div>
          <p className="text-sm text-gray-400">
            Watch how rankings changed over the last 12 months
          </p>
        </div>

        <div className="bg-gradient-to-br from-pink-500/10 to-transparent backdrop-blur border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-pink-400" />
            </div>
            <h3 className="font-semibold text-white">Live Competition</h3>
          </div>
          <p className="text-sm text-gray-400">
            See real-time rankings and performance metrics
          </p>
        </div>

        <div className="bg-gradient-to-br from-violet-500/10 to-transparent backdrop-blur border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-violet-400" />
            </div>
            <h3 className="font-semibold text-white">Top Performers</h3>
          </div>
          <p className="text-sm text-gray-400">
            Identify your best platforms and creators
          </p>
        </div>
      </div>
    </div>
  );
};

export default RaceChartsPage;

