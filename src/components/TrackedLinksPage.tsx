import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Settings, RefreshCw, ExternalLink } from 'lucide-react';
import { DateFilterType } from './DateRangeFilter';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import LinkClicksService, { LinkClick } from '../services/LinkClicksService';
import { TrackedLink } from '../types/firestore';
import FirestoreDataService from '../services/FirestoreDataService';

export interface TrackedLinksPageRef {
  openCreateModal: () => void;
  refreshData?: () => Promise<void>;
}

interface TrackedLinksPageProps {
  searchQuery: string;
  linkClicks?: LinkClick[];
  dateFilter?: DateFilterType;
  customDateRange?: { start: Date; end: Date };
  organizationId?: string;
  projectId?: string;
}

const TrackedLinksPage = forwardRef<TrackedLinksPageRef, TrackedLinksPageProps>(
  ({ searchQuery, linkClicks = [], dateFilter = 'all', customDateRange, organizationId, projectId }, ref) => {
    const { currentOrgId, currentProjectId } = useAuth();
    const [links, setLinks] = useState<TrackedLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<'today' | 'all-time'>('today');
    const [interval, setInterval] = useState<'hourly' | 'monthly'>('hourly');
    const [refreshing, setRefreshing] = useState(false);
    const [visitors, setVisitors] = useState(0);
    const [revenue, setRevenue] = useState(0);
    const [bounceRate, setBounceRate] = useState(0);
    const [avgSessionTime, setAvgSessionTime] = useState(0);
    const [activeVisitors, setActiveVisitors] = useState(0);

    const orgId = organizationId || currentOrgId;
    const projId = projectId || currentProjectId;

    useImperativeHandle(ref, () => ({
      openCreateModal: () => {
        // Not used in this new design
      },
      refreshData: async () => {
        await loadData();
      }
    }));

    useEffect(() => {
      loadData();
    }, [orgId, projId, timeframe]);

    const loadData = async () => {
      if (!orgId || !projId) return;

      setLoading(true);
      try {
        const [linksData, clicksData] = await Promise.all([
          FirestoreDataService.getTrackedLinks(orgId, projId),
          LinkClicksService.getProjectLinkClicks(orgId, projId)
        ]);

        setLinks(linksData);
        calculateMetrics(linksData, clicksData);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    const calculateMetrics = (linksData: TrackedLink[], clicksData: LinkClick[]) => {
      // Calculate basic metrics
      const totalClicks = clicksData.length;
      setVisitors(totalClicks);

      // Mock calculations for demo
      setRevenue(0);
      setBounceRate(76);
      setAvgSessionTime(269); // in seconds (4m 29s)
      setActiveVisitors(Math.floor(Math.random() * 10));
    };

    const handleRefresh = async () => {
      setRefreshing(true);
      await loadData();
      setRefreshing(false);
    };

    // Mock data for charts
    const trafficData = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}am`,
      visitors: i < 18 ? 0 : Math.floor(Math.random() * 20)
    }));

    const topPages = [
      { path: '/settings', visitors: 1 },
      { path: '/', visitors: 1 },
      { path: '/login', visitors: 1 }
    ];

    const countries = [
      { name: 'United States', visitors: 31, flag: '🇺🇸' },
      { name: 'Israel', visitors: 2, flag: '🇮🇱' },
      { name: 'United Kingdom', visitors: 1, flag: '🇬🇧' }
    ];

    if (loading) {
      return <PageLoadingSkeleton type="links" />;
    }

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-black/40 rounded-lg border border-white/10">
              <ExternalLink className="w-4 h-4 text-gray-400" />
              <span className="text-white font-medium">www.viewtrack.app</span>
            </div>
            <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
              <Settings className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Timeframe Selector */}
            <div className="flex items-center bg-black/40 rounded-lg border border-white/10 p-1">
              <button
                onClick={() => setTimeframe('today')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeframe === 'today'
                    ? 'bg-white text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setTimeframe('all-time')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeframe === 'all-time'
                    ? 'bg-white text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                All time
              </button>
            </div>

            {/* Interval Selector */}
            <div className="flex items-center bg-black/40 rounded-lg border border-white/10 p-1">
              <button
                onClick={() => setInterval('hourly')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  interval === 'hourly'
                    ? 'bg-white text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Hourly
              </button>
              <button
                onClick={() => setInterval('monthly')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  interval === 'monthly'
                    ? 'bg-white text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* KPI Metrics */}
        <div className="grid grid-cols-7 gap-4">
          {/* Visitors */}
          <div className="bg-black/40 rounded-lg border border-white/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-sm text-gray-400">Visitors</span>
            </div>
            <div className="text-3xl font-bold text-white">{visitors}</div>
            <div className="text-xs text-gray-500 mt-1">0.0%</div>
          </div>

          {/* Revenue */}
          <div className="bg-black/40 rounded-lg border border-white/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <span className="text-sm text-gray-400">Revenue</span>
            </div>
            <div className="text-3xl font-bold text-white">${revenue}</div>
            <div className="text-xs text-red-500 mt-1">-100.0% ↓</div>
          </div>

          {/* Conversion Rate */}
          <div className="bg-black/40 rounded-lg border border-white/10 p-4">
            <div className="text-sm text-gray-400 mb-2">Conversion rate</div>
            <div className="text-3xl font-bold text-white">-</div>
            <div className="text-xs text-gray-500 mt-1">0.0%</div>
          </div>

          {/* Revenue/Visitor */}
          <div className="bg-black/40 rounded-lg border border-white/10 p-4">
            <div className="text-sm text-gray-400 mb-2">Revenue/visitor</div>
            <div className="text-3xl font-bold text-white">-</div>
            <div className="text-xs text-gray-500 mt-1">0.0%</div>
          </div>

          {/* Bounce Rate */}
          <div className="bg-black/40 rounded-lg border border-white/10 p-4">
            <div className="text-sm text-gray-400 mb-2">Bounce rate</div>
            <div className="text-3xl font-bold text-white">{bounceRate}%</div>
            <div className="text-xs text-gray-500 mt-1">0.0%</div>
          </div>

          {/* Session Time */}
          <div className="bg-black/40 rounded-lg border border-white/10 p-4">
            <div className="text-sm text-gray-400 mb-2">Session time</div>
            <div className="text-3xl font-bold text-white">
              {Math.floor(avgSessionTime / 60)}m {avgSessionTime % 60}s
            </div>
            <div className="text-xs text-gray-500 mt-1">0.0%</div>
          </div>

          {/* Visitors Now */}
          <div className="bg-black/40 rounded-lg border border-white/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-gray-400">Visitors now</span>
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            </div>
            <div className="text-3xl font-bold text-white">{activeVisitors}</div>
            <div className="text-xs text-gray-500 mt-1">-</div>
          </div>
        </div>

        {/* Traffic Trend Chart */}
        <div className="bg-black/40 rounded-lg border border-white/10 p-6">
          <div className="h-80 flex items-end gap-1">
            {trafficData.map((data, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-gradient-to-t from-blue-500/50 to-blue-500 rounded-t"
                  style={{ height: `${(data.visitors / 20) * 100}%`, minHeight: '2px' }}
                ></div>
                {index % 3 === 0 && (
                  <span className="text-xs text-gray-500">{data.hour}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-3 gap-6">
          {/* Traffic Source Donut Chart */}
          <div className="bg-black/40 rounded-lg border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Channel</h3>
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <div className="text-4xl mb-2">📊</div>
                <div className="text-sm text-gray-400">Direct: 100%</div>
              </div>
            </div>
          </div>

          {/* Page Traffic Table */}
          <div className="bg-black/40 rounded-lg border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Page</h3>
              <button className="text-sm text-gray-400 hover:text-white">Hostname</button>
            </div>
            <div className="space-y-3">
              {topPages.map((page, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-sm text-gray-300">{page.path}</span>
                  <span className="text-sm font-medium text-white">{page.visitors}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Geographic Distribution */}
          <div className="bg-black/40 rounded-lg border border-white/10 p-6">
            <div className="flex items-center gap-4 mb-4">
              <button className="text-sm font-semibold text-white border-b-2 border-white pb-1">
                Country
              </button>
              <button className="text-sm text-gray-400 hover:text-white">Region</button>
              <button className="text-sm text-gray-400 hover:text-white">City</button>
            </div>
            <div className="space-y-3">
              {countries.map((country, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{country.flag}</span>
                    <span className="text-sm text-gray-300">{country.name}</span>
                  </div>
                  <span className="text-sm font-medium text-white">{country.visitors}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

TrackedLinksPage.displayName = 'TrackedLinksPage';

export default TrackedLinksPage;
