import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

export type DateFilterType = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'last90days' | 'mtd' | 'ytd' | 'custom' | 'all';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface DateRangeFilterProps {
  selectedFilter: DateFilterType;
  customRange?: DateRange;
  onFilterChange: (filter: DateFilterType, customRange?: DateRange) => void;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  selectedFilter,
  customRange,
  onFilterChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(
    customRange?.startDate?.toISOString().split('T')[0] || ''
  );
  const [customEndDate, setCustomEndDate] = useState(
    customRange?.endDate?.toISOString().split('T')[0] || ''
  );

  const filterOptions = [
    { value: 'all', label: 'All Time', description: 'Show all videos' },
    { value: 'today', label: 'Today', description: 'Today only' },
    { value: 'yesterday', label: 'Yesterday', description: 'Yesterday only' },
    { value: 'last7days', label: 'Last 7 Days', description: 'Past week' },
    { value: 'last30days', label: 'Last 30 Days', description: 'Past month' },
    { value: 'last90days', label: 'Last 90 Days', description: 'Past quarter' },
    { value: 'mtd', label: 'Month to Date', description: 'This month' },
    { value: 'ytd', label: 'Year to Date', description: 'This year' },
    { value: 'custom', label: 'Custom Range', description: 'Select dates' },
  ];

  const getFilterLabel = () => {
    const option = filterOptions.find(opt => opt.value === selectedFilter);
    if (selectedFilter === 'custom' && customRange) {
      return `${customRange.startDate.toLocaleDateString()} - ${customRange.endDate.toLocaleDateString()}`;
    }
    return option?.label || 'All Time';
  };

  const handleFilterSelect = (filterType: DateFilterType) => {
    if (filterType !== 'custom') {
      onFilterChange(filterType);
      setIsOpen(false);
    }
  };

  const handleCustomRangeApply = () => {
    if (customStartDate && customEndDate) {
      const startDate = new Date(customStartDate);
      const endDate = new Date(customEndDate);
      endDate.setHours(23, 59, 59, 999); // End of day
      
      onFilterChange('custom', { startDate, endDate });
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 hover:border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 transition-all backdrop-blur-sm"
      >
        <Calendar className="w-4 h-4 text-white/50" />
        <span className="text-sm font-medium text-white/90">
          {getFilterLabel()}
        </span>
        <ChevronDown className={`w-4 h-4 text-white/50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-gradient-to-br from-[#121212] to-[#151515] border border-white/10 rounded-lg shadow-2xl z-50 backdrop-blur-xl">
          <div className="p-2">
            {filterOptions.map((option) => (
              <div key={option.value}>
                {option.value !== 'custom' ? (
                  <button
                    onClick={() => handleFilterSelect(option.value as DateFilterType)}
                    className={`w-full text-left px-3 py-2 rounded-md hover:bg-white/5 transition-colors ${
                      selectedFilter === option.value ? 'bg-white/10 text-white' : 'text-white/90'
                    }`}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-white/50">{option.description}</div>
                  </button>
                ) : (
                  <div className="px-3 py-2">
                    <div className="font-medium text-white/90 mb-2">{option.label}</div>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-white/50 mb-1">Start Date</label>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-white/10 bg-white/5 text-white rounded focus:outline-none focus:ring-1 focus:ring-white/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-white/50 mb-1">End Date</label>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-white/10 bg-white/5 text-white rounded focus:outline-none focus:ring-1 focus:ring-white/20"
                        />
                      </div>
                      <button
                        onClick={handleCustomRangeApply}
                        disabled={!customStartDate || !customEndDate}
                        className="w-full px-3 py-1 text-sm bg-white/90 text-gray-900 rounded hover:bg-white disabled:bg-white/20 disabled:cursor-not-allowed transition-colors"
                      >
                        Apply Custom Range
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangeFilter;
