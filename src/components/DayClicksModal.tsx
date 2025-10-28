import React, { useMemo } from 'react';
import { X, Calendar, MousePointer, ExternalLink } from 'lucide-react';
import { LinkClick } from '../services/LinkClicksService';
import { TrackedLink } from '../types/firestore';

interface DayClicksModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  clicks: LinkClick[];
  links: TrackedLink[];
  onLinkClick: (link: TrackedLink) => void;
}

const DayClicksModal: React.FC<DayClicksModalProps> = ({
  isOpen,
  onClose,
  date,
  clicks,
  links,
  onLinkClick
}) => {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Group clicks by link
  const linkClickGroups = useMemo(() => {
    const groups = new Map<string, { link: TrackedLink | null; clicks: LinkClick[]; totalClicks: number; uniqueClicks: number }>();
    
    clicks.forEach(click => {
      const shortCode = click.shortCode; // Use shortCode, not linkCode
      if (!shortCode) return;
      
      if (!groups.has(shortCode)) {
        const link = links.find(l => l.shortCode === shortCode);
        groups.set(shortCode, {
          link: link || null,
          clicks: [],
          totalClicks: 0,
          uniqueClicks: 0
        });
      }
      
      const group = groups.get(shortCode)!;
      group.clicks.push(click);
      group.totalClicks++;
    });
    
    // Calculate unique clicks for each group
    groups.forEach((group) => {
      const uniqueUsers = new Set(group.clicks.map(c => `${c.userAgent}-${c.deviceType}`));
      group.uniqueClicks = uniqueUsers.size;
    });
    
    // Sort by total clicks descending
    return Array.from(groups.entries())
      .sort((a, b) => b[1].totalClicks - a[1].totalClicks)
      .map(([shortCode, data]) => ({ linkCode: shortCode, ...data }));
  }, [clicks, links]);

  const totalClicks = clicks.length;
  const totalUniqueClicks = useMemo(() => {
    const uniqueUsers = new Set(clicks.map(c => `${c.userAgent}-${c.deviceType}`));
    return uniqueUsers.size;
  }, [clicks]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-900/80 backdrop-blur-sm" 
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle transition-all transform bg-zinc-900 shadow-2xl rounded-2xl border border-white/10 relative">
          {/* Header */}
          <div className="px-6 py-5 border-b border-white/10 bg-zinc-900/60">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Link Clicks
                  </h3>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {formatDate(date)}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Stats */}
            <div className="flex gap-4 mt-4">
              <div className="flex-1 p-3 rounded-lg bg-white/5 border border-white/5">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Total Clicks</p>
                <p className="text-2xl font-bold text-white mt-1">{totalClicks}</p>
              </div>
              <div className="flex-1 p-3 rounded-lg bg-white/5 border border-white/5">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Unique Clicks</p>
                <p className="text-2xl font-bold text-white mt-1">{totalUniqueClicks}</p>
              </div>
              <div className="flex-1 p-3 rounded-lg bg-white/5 border border-white/5">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Links Clicked</p>
                <p className="text-2xl font-bold text-white mt-1">{linkClickGroups.length}</p>
              </div>
            </div>
          </div>

          {/* Links List */}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {linkClickGroups.length === 0 ? (
              <div className="py-12 text-center">
                <MousePointer className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No clicks recorded for this day</p>
              </div>
            ) : (
              <div className="space-y-3">
                {linkClickGroups.map(({ linkCode, link, totalClicks, uniqueClicks }) => (
                  <div
                    key={linkCode}
                    onClick={() => {
                      if (link) {
                        onLinkClick(link);
                      }
                    }}
                    className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        {/* Link Code */}
                        <div className="flex items-center gap-2 mb-2">
                          <code className="text-sm font-mono font-semibold text-white">
                            /{linkCode}
                          </code>
                          {link && (
                            <ExternalLink className="w-3.5 h-3.5 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>

                        {/* Link Details */}
                        {link && (
                          <div className="space-y-1">
                            <p className="text-sm text-white truncate">
                              {link.title}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {link.originalUrl}
                            </p>
                          </div>
                        )}

                        {!link && (
                          <p className="text-xs text-gray-500">
                            Link not found
                          </p>
                        )}
                      </div>

                      {/* Click Stats */}
                      <div className="flex items-center gap-6 ml-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-white">
                            {totalClicks}
                          </p>
                          <p className="text-xs text-gray-500">
                            {totalClicks === 1 ? 'click' : 'clicks'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-gray-400">
                            {uniqueClicks}
                          </p>
                          <p className="text-xs text-gray-500">
                            unique
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/10 bg-zinc-900/60">
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayClicksModal;

