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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="relative w-full max-w-lg bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">
                Link Clicks
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatDate(date)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Links List */}
          <div className="px-4 py-3 max-h-[50vh] overflow-y-auto">
            {linkClickGroups.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-500">No clicks recorded</p>
              </div>
            ) : (
              <div className="space-y-1.5">
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
                      className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      {/* Creator Profile Picture or Link Icon */}
                      <div className="flex-shrink-0">
                        {linkedAccount?.profilePicture ? (
                          <img
                            src={linkedAccount.profilePicture}
                            alt={linkedAccount.username}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                            <LinkIcon className="w-4 h-4 text-gray-500" />
                          </div>
                        )}
                      </div>

                      {/* Link Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">
                          {link?.title || `/${linkCode}`}
                        </p>
                        {linkedAccount && (
                          <p className="text-xs text-gray-500 truncate">
                            @{linkedAccount.username}
                          </p>
                        )}
                      </div>

                      {/* Click Count */}
                      <div className="flex-shrink-0">
                        <p className="text-sm font-semibold text-white">
                          {totalClicks}
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
    </div>
  );
};

export default DayClicksModal;

