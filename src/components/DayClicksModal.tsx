import React, { useMemo } from 'react';
import { X, Calendar, MousePointer, Link as LinkIcon } from 'lucide-react';
import { LinkClick } from '../services/LinkClicksService';
import { TrackedLink, TrackedAccount } from '../types/firestore';

interface DayClicksModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  clicks: LinkClick[];
  links: TrackedLink[];
  accounts: Map<string, TrackedAccount>;
  onLinkClick: (link: TrackedLink) => void;
}

const DayClicksModal: React.FC<DayClicksModalProps> = ({
  isOpen,
  onClose,
  date,
  clicks,
  links,
  accounts,
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Background overlay */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="relative w-full max-w-3xl bg-[#141414] rounded-xl border border-white/5 shadow-2xl">
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">
                {formatDate(date)}
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                {totalClicks} total clicks • {totalUniqueClicks} unique
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Links List */}
          <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
            {linkClickGroups.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-xs text-gray-500">No clicks</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {linkClickGroups.map(({ linkCode, link, totalClicks }) => {
                  const linkedAccount = link?.linkedAccountId ? accounts.get(link.linkedAccountId) : null;
                  
                  return (
                    <div
                      key={linkCode}
                      onClick={() => {
                        if (link) {
                          onLinkClick(link);
                        }
                      }}
                      className="flex items-center gap-3 p-4 rounded-lg bg-white/3 hover:bg-white/8 transition-all cursor-pointer border border-white/5 hover:border-white/10"
                    >
                      {/* Creator Profile Picture or Link Icon */}
                      <div className="flex-shrink-0">
                        {linkedAccount?.profilePicture ? (
                          <img
                            src={linkedAccount.profilePicture}
                            alt={linkedAccount.username}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                            <LinkIcon className="w-5 h-5 text-gray-500" />
                          </div>
                        )}
                      </div>

                      {/* Link Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate mb-1">
                          {link?.title || `/${linkCode}`}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          /{linkCode}
                        </p>
                      </div>

                      {/* Click Count */}
                      <div className="flex-shrink-0 text-right">
                        <p className="text-2xl font-bold text-white">
                          {totalClicks}
                        </p>
                        <p className="text-xs text-gray-500">
                          {totalClicks === 1 ? 'click' : 'clicks'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
  );
};

export default DayClicksModal;

