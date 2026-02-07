import React from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { 
  MoreVertical, 
  ChevronDown, 
  Link as LinkIcon, 
  Download, 
  Trash2,
  Users 
} from 'lucide-react';
import { DateFilterType } from '../DateRangeFilter';

interface AccountsHeaderProps {
  dateFilter: DateFilterType;
  selectedCount: number;
  showActionsMenu: boolean;
  setShowActionsMenu: (show: boolean) => void;
  actionsMenuRef: React.RefObject<HTMLButtonElement>;
  
  // Handlers
  onCopyLinks: () => void;
  onExport: () => void;
  onDelete: () => void;
  onAssignCreator?: () => void;
}

export const AccountsHeader: React.FC<AccountsHeaderProps> = ({
  dateFilter,
  selectedCount,
  showActionsMenu,
  setShowActionsMenu,
  actionsMenuRef,
  onCopyLinks,
  onExport,
  onDelete,
  onAssignCreator
}) => {
  return (
    <div className="relative px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 border-b border-white/5 z-10" style={{ backgroundColor: 'rgba(18, 18, 20, 0.6)' }}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
            {dateFilter === 'all' 
              ? 'Account stats - All Time' 
              : dateFilter === 'today'
              ? 'Account stats - Today'
              : dateFilter === 'yesterday'
              ? 'Account stats - Yesterday'
              : dateFilter === 'last7days'
              ? 'Account stats - Last 7 days'
              : dateFilter === 'last14days'
              ? 'Account stats - Last 14 days'
              : dateFilter === 'last30days'
              ? 'Account stats - Last 30 days'
              : dateFilter === 'last90days'
              ? 'Account stats - Last 90 days'
              : dateFilter === 'mtd'
              ? 'Account stats - Month to Date'
              : dateFilter === 'lastmonth'
              ? 'Account stats - Last Month'
              : dateFilter === 'ytd'
              ? 'Account stats - Year to Date'
              : 'Account stats'
            }
          </h2>
        </div>
        
        <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
          {/* Actions Dropdown */}
          <div className="relative">
            <button
              ref={actionsMenuRef}
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              disabled={selectedCount === 0}
              className={clsx(
                "flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 text-sm border rounded-lg transition-colors",
                selectedCount > 0
                  ? "text-white bg-white/10 border-white/20 hover:bg-white/15"
                  : "text-gray-500 border-white/5 cursor-not-allowed opacity-50"
              )}
            >
              <MoreVertical className="w-4 h-4" />
              <span className="hidden sm:inline">
                {selectedCount > 0 ? `Actions (${selectedCount})` : 'Actions'}
              </span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {/* Actions Dropdown Menu (Portal) */}
            {showActionsMenu && selectedCount > 0 && actionsMenuRef.current && createPortal(
              <>
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 z-[9998]" 
                  onClick={() => setShowActionsMenu(false)}
                />
                
                {/* Dropdown Menu */}
                <div 
                  className="fixed w-48 bg-[#1A1A1A] border border-gray-800 rounded-lg shadow-xl z-[9999] overflow-hidden"
                  style={{
                    top: `${actionsMenuRef.current.getBoundingClientRect().bottom + 8}px`,
                    left: `${actionsMenuRef.current.getBoundingClientRect().right - 192}px`
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopyLinks();
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-white/10 flex items-center space-x-3 transition-colors"
                  >
                    <LinkIcon className="w-4 h-4" />
                    <span>Copy Links</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onExport();
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-white/10 flex items-center space-x-3 transition-colors border-t border-gray-800"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export to CSV</span>
                  </button>
                  {onAssignCreator && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowActionsMenu(false);
                        onAssignCreator();
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-white/10 flex items-center space-x-3 transition-colors border-t border-gray-800"
                    >
                      <Users className="w-4 h-4" />
                      <span>Assign to Creator</span>
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      console.log('🔴 ACCOUNTS DELETE BUTTON CLICK EVENT FIRED');
                      e.stopPropagation();
                      e.preventDefault();
                      onDelete();
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center space-x-3 transition-colors border-t border-gray-800"
                    type="button"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Selected</span>
                  </button>
                </div>
              </>,
              document.body
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
