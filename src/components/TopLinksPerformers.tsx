import React, { useState, useMemo } from 'react';
import { ChevronDown, Info, Link as LinkIcon, Users, Globe } from 'lucide-react';
import { TrackedLink, TrackedAccount } from '../types/firestore';
import { LinkClick } from '../services/LinkClicksService';
import { DateFilterType } from './DateRangeFilter';

interface TopLinksPerformersProps {
  links: TrackedLink[];
  linkClicks: LinkClick[];
  accounts: Map<string, TrackedAccount>;
  dateFilter: DateFilterType;
  customDateRange?: { startDate: Date; endDate: Date };
  onLinkClick?: (link: TrackedLink) => void;
}

type SectionType = 'clicks' | 'unique' | 'referrers';

const TopLinksPerformers: React.FC<TopLinksPerformersProps> = ({ 
  links, 
  linkClicks, 
  accounts, 
  dateFilter, 
  customDateRange, 
  onLinkClick 
}) => {
  const [activeSection, setActiveSection] = useState<SectionType>('clicks');
  const [topCount, setTopCount] = useState(5);
  const [showInfo, setShowInfo] = useState(false);

  // Filter clicks based on date range
  const filteredClicks = useMemo(() => {
    const now = new Date();
    let dateRangeStart: Date | null = null;
    let dateRangeEnd: Date = new Date();
    
    if (dateFilter === 'today') {
      dateRangeStart = new Date(now);
      dateRangeStart.setHours(0, 0, 0, 0);
      dateRangeEnd.setHours(23, 59, 59, 999);
    } else if (dateFilter === 'last7days') {
      dateRangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === 'last30days') {
      dateRangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === 'last90days') {
      dateRangeStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === 'custom' && customDateRange) {
      dateRangeStart = new Date(customDateRange.startDate);
      dateRangeStart.setHours(0, 0, 0, 0);
      dateRangeEnd = new Date(customDateRange.endDate);
      dateRangeEnd.setHours(23, 59, 59, 999);
    } else if (dateFilter === 'all') {
      // For 'all', include all clicks
      return linkClicks;
    }
    
    // Filter clicks within date range
    return linkClicks.filter(click => {
      if (!dateRangeStart) return true;
      const clickDate = new Date(click.timestamp);
      return clickDate >= dateRangeStart && clickDate <= dateRangeEnd;
    });
  }, [linkClicks, dateFilter, customDateRange]);

  // Calculate top links by total clicks
  const topLinksByClicks = useMemo(() => {
    const linkClickCounts = new Map<string, number>();
    
    filteredClicks.forEach(click => {
      const shortCode = click.shortCode;
      if (shortCode) {
        linkClickCounts.set(shortCode, (linkClickCounts.get(shortCode) || 0) + 1);
      }
    });

    return links
      .map(link => ({
        link,
        clicks: linkClickCounts.get(link.shortCode) || 0,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, topCount);
  }, [links, filteredClicks, topCount]);

  // Calculate top links by unique clicks
  const topLinksByUniqueClicks = useMemo(() => {
    const linkUniqueClicks = new Map<string, Set<string>>();
    
    filteredClicks.forEach(click => {
      const shortCode = click.shortCode;
      if (shortCode) {
        if (!linkUniqueClicks.has(shortCode)) {
          linkUniqueClicks.set(shortCode, new Set());
        }
        linkUniqueClicks.get(shortCode)!.add(`${click.userAgent}-${click.deviceType}`);
      }
    });

    return links
      .map(link => ({
        link,
        uniqueClicks: linkUniqueClicks.get(link.shortCode)?.size || 0,
      }))
      .sort((a, b) => b.uniqueClicks - a.uniqueClicks)
      .slice(0, topCount);
  }, [links, filteredClicks, topCount]);

  // Calculate top referrers
  const topReferrers = useMemo(() => {
    const referrerCounts = new Map<string, number>();
    
    filteredClicks.forEach(click => {
      const referrer = click.referrerDomain || click.referrer || 'Direct';
      referrerCounts.set(referrer, (referrerCounts.get(referrer) || 0) + 1);
    });

    return Array.from(referrerCounts.entries())
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topCount);
  }, [filteredClicks, topCount]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const getSectionData = () => {
    switch (activeSection) {
      case 'clicks':
        return {
          title: 'Top Clicks',
          description: 'Links with the most total clicks',
          data: topLinksByClicks,
          maxValue: topLinksByClicks[0]?.clicks || 1,
          icon: LinkIcon,
        };
      case 'unique':
        return {
          title: 'Top Unique Clicks',
          description: 'Links with the most unique visitors',
          data: topLinksByUniqueClicks,
          maxValue: topLinksByUniqueClicks[0]?.uniqueClicks || 1,
          icon: Users,
        };
      case 'referrers':
        return {
          title: 'Top Referrers',
          description: 'Sources driving the most traffic',
          data: topReferrers,
          maxValue: topReferrers[0]?.count || 1,
          icon: Globe,
        };
    }
  };

  const sectionData = getSectionData();

  return (
    <div className="space-y-6">
      {/* Top Links by Clicks */}
      <div className="relative rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg hover:shadow-xl transition-all duration-300 p-6 overflow-hidden">
        {/* Depth Gradient Overlay */}
        <div 
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)',
          }}
        />
        
        {/* Content Layer */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <sectionData.icon className="w-5 h-5 text-white" />
              <h2 className="text-lg font-semibold text-white">{sectionData.title}</h2>
              <div className="relative">
                <button
                  onMouseEnter={() => setShowInfo(true)}
                  onMouseLeave={() => setShowInfo(false)}
                  className="text-gray-500 hover:text-gray-400 transition-colors"
                >
                  <Info className="w-4 h-4" style={{ opacity: 0.5 }} />
                </button>
                
                {/* Info Tooltip */}
                {showInfo && (
                  <div 
                    className="absolute left-0 top-full mt-2 w-64 p-3 rounded-lg border shadow-xl z-50"
                    style={{
                      backgroundColor: 'rgba(26, 26, 26, 0.98)',
                      borderColor: 'rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    <p className="text-xs text-gray-300 leading-relaxed">
                      {sectionData.description}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Section Selector */}
              <div className="relative">
                <select
                  value={activeSection}
                  onChange={(e) => setActiveSection(e.target.value as SectionType)}
                  className="appearance-none bg-white/10 text-white rounded-lg px-3 py-1.5 pr-8 text-sm font-medium border border-white/10 hover:bg-white/15 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all cursor-pointer"
                >
                  <option value="clicks" className="bg-gray-900">Total Clicks</option>
                  <option value="unique" className="bg-gray-900">Unique Clicks</option>
                  <option value="referrers" className="bg-gray-900">Referrers</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
              </div>
              {/* Count Selector */}
              <div className="relative">
                <select
                  value={topCount}
                  onChange={(e) => setTopCount(Number(e.target.value))}
                  className="appearance-none bg-white/10 text-white rounded-lg px-3 py-1.5 pr-8 text-sm font-medium border border-white/10 hover:bg-white/15 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all cursor-pointer"
                >
                  <option value={3} className="bg-gray-900">3</option>
                  <option value={5} className="bg-gray-900">5</option>
                  <option value={10} className="bg-gray-900">10</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Race Bars */}
          <div className="space-y-3">
            {activeSection === 'referrers' ? (
              // Referrers display
              topReferrers.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No referrer data available
                </div>
              ) : (
                topReferrers.map((item, index) => {
                  const percentage = sectionData.maxValue > 0 ? (item.count / sectionData.maxValue) * 100 : 0;
                  
                  return (
                    <div 
                      key={item.referrer} 
                      className="group relative"
                      style={{
                        animation: `raceSlideIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.12}s both`
                      }}
                    >
                      {/* Bar Container */}
                      <div className="relative h-10 flex items-center">
                        {/* Icon (Spearhead) */}
                        <div className="absolute left-0 z-10 flex-shrink-0">
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-gray-800/50 backdrop-blur-sm flex items-center justify-center">
                            <Globe className="w-5 h-5 text-gray-400" />
                          </div>
                        </div>

                        {/* Animated Bar */}
                        <div className="ml-14 flex-1 relative flex items-center">
                          <div className="h-10 rounded-lg overflow-hidden flex-1">
                            <div 
                              className="race-bar h-full relative transition-all duration-300 ease-out rounded-lg"
                              style={{
                                width: `${percentage}%`,
                                minWidth: '8%',
                                background: 'linear-gradient(to right, #52525B, #3F3F46)'
                              }}
                            >
                            </div>
                          </div>
                          {/* Metric Value - Always on Right */}
                          <div className="ml-4 min-w-[100px] text-right">
                            <span className="text-lg font-semibold text-white tabular-nums tracking-tight" style={{ fontFamily: 'Inter, SF Pro Display, system-ui, sans-serif' }}>
                              {formatNumber(item.count)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              // Links display (for clicks and unique clicks)
              (activeSection === 'clicks' ? topLinksByClicks : topLinksByUniqueClicks).length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No link data available
                </div>
              ) : (
                (activeSection === 'clicks' ? topLinksByClicks : topLinksByUniqueClicks).map((item, index) => {
                  const value = activeSection === 'clicks' ? item.clicks : (item as any).uniqueClicks;
                  const percentage = sectionData.maxValue > 0 ? (value / sectionData.maxValue) * 100 : 0;
                  const link = item.link;
                  const linkedAccount = link.linkedAccountId ? accounts.get(link.linkedAccountId) : null;
                  
                  return (
                    <div 
                      key={link.id} 
                      className="group relative cursor-pointer"
                      style={{
                        animation: `raceSlideIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.12}s both`
                      }}
                      onClick={() => onLinkClick?.(link)}
                    >
                      {/* Bar Container */}
                      <div className="relative h-10 flex items-center">
                        {/* Profile Image or Link Icon (Spearhead) */}
                        <div className="absolute left-0 z-10 flex-shrink-0">
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-gray-800/50 backdrop-blur-sm">
                            {linkedAccount?.profilePicture ? (
                              <img
                                src={linkedAccount.profilePicture}
                                alt={linkedAccount.username}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <LinkIcon className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Animated Bar */}
                        <div className="ml-14 flex-1 relative flex items-center">
                          <div className="h-10 rounded-lg overflow-hidden flex-1">
                            <div 
                              className="race-bar h-full relative transition-all duration-300 ease-out rounded-lg"
                              style={{
                                width: `${percentage}%`,
                                minWidth: '8%',
                                background: 'linear-gradient(to right, #52525B, #3F3F46)'
                              }}
                            >
                            </div>
                          </div>
                          {/* Metric Value - Always on Right */}
                          <div className="ml-4 min-w-[100px] text-right">
                            <span className="text-lg font-semibold text-white tabular-nums tracking-tight" style={{ fontFamily: 'Inter, SF Pro Display, system-ui, sans-serif' }}>
                              {formatNumber(value)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>
      </div>

      {/* Add CSS animation */}
      <style>{`
        @keyframes raceSlideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default TopLinksPerformers;

