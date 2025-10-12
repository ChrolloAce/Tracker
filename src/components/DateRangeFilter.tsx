import React, { useState, useMemo } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

export type DateFilterType = 'today' | 'yesterday' | 'last7days' | 'last14days' | 'last30days' | 'last90days' | 'mtd' | 'lastmonth' | 'ytd' | 'custom' | 'all';

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
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tempStartDate, setTempStartDate] = useState<Date | null>(customRange?.startDate || null);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(customRange?.endDate || null);
  const [isSelectingRange, setIsSelectingRange] = useState(false);

  const presetOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last7days', label: 'Last 7 days' },
    { value: 'last14days', label: 'Last 14 days' },
    { value: 'last30days', label: 'Last 30 days' },
    { value: 'mtd', label: 'Month to date' },
    { value: 'lastmonth', label: 'Last month' },
    { value: 'ytd', label: 'Year to date' },
  ] as const;

  const getFilterLabel = () => {
    const option = presetOptions.find(opt => opt.value === selectedFilter);
    if (selectedFilter === 'custom' && customRange) {
      return `${customRange.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${customRange.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    return option?.label || 'All Time';
  };

  const handlePresetSelect = (filterType: DateFilterType) => {
    onFilterChange(filterType);
    setIsOpen(false);
    setTempStartDate(null);
    setTempEndDate(null);
    setIsSelectingRange(false);
  };

  // Calendar generation
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = lastDay.getDate();
    
    const days: (Date | null)[] = [];
    
    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, prevMonthLastDay - i));
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    // Next month days to complete the grid
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }
    
    return days;
  }, [currentMonth]);

  const isDateInRange = (date: Date) => {
    if (!tempStartDate || !tempEndDate) return false;
    const start = new Date(tempStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(tempEndDate);
    end.setHours(23, 59, 59, 999);
    const check = new Date(date);
    check.setHours(12, 0, 0, 0);
    return check >= start && check <= end;
  };

  const isDateStart = (date: Date) => {
    if (!tempStartDate) return false;
    return date.toDateString() === tempStartDate.toDateString();
  };

  const isDateEnd = (date: Date) => {
    if (!tempEndDate) return false;
    return date.toDateString() === tempEndDate.toDateString();
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth();
  };

  const handleDateClick = (date: Date) => {
    if (!isSelectingRange) {
      setTempStartDate(date);
      setTempEndDate(null);
      setIsSelectingRange(true);
    } else {
      if (tempStartDate && date >= tempStartDate) {
        setTempEndDate(date);
        const range = { startDate: tempStartDate, endDate: date };
        onFilterChange('custom', range);
        setIsSelectingRange(false);
        setIsOpen(false);
      } else if (tempStartDate && date < tempStartDate) {
        // If clicked before start, reset
        setTempStartDate(date);
        setTempEndDate(null);
      }
    }
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
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
        <ChevronDown className={`w-4 h-4 text-white/50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => {
              setIsOpen(false);
              setTempStartDate(customRange?.startDate || null);
              setTempEndDate(customRange?.endDate || null);
              setIsSelectingRange(false);
            }}
          />
          
          {/* Main Dropdown */}
          <div className="absolute top-full right-0 mt-2 bg-black border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
               style={{ width: '680px' }}>
            <div className="flex">
              {/* LEFT PANEL - Presets */}
              <div className="w-56 bg-gradient-to-b from-black to-[#0A0A0A] border-r border-white/5 p-3">
                <div className="space-y-1">
                  {presetOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handlePresetSelect(option.value)}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        selectedFilter === option.value && !isSelectingRange
                          ? 'bg-white text-black shadow-lg'
                          : 'text-white/70 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* RIGHT PANEL - Calendar */}
              <div className="flex-1 bg-[#0D0D0D] p-6">
                {/* Calendar Header */}
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={prevMonth}
                    className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-white/70" />
                  </button>
                  
                  <h3 className="text-base font-semibold text-white">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h3>
                  
                  <button
                    onClick={nextMonth}
                    className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-white/70" />
                  </button>
                </div>

                {/* Calendar Grid */}
                <div className="space-y-1">
                  {/* Weekday Labels */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                      <div
                        key={day}
                        className="h-9 flex items-center justify-center text-xs font-medium text-white/40 uppercase"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Date Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((date, index) => {
                      if (!date) return <div key={index} />;
                      
                      const inRange = isDateInRange(date);
                      const isStart = isDateStart(date);
                      const isEnd = isDateEnd(date);
                      const today = isToday(date);
                      const currentMonthDate = isCurrentMonth(date);

                      return (
                        <button
                          key={index}
                          onClick={() => handleDateClick(date)}
                          disabled={!currentMonthDate}
                          className={`
                            h-9 flex items-center justify-center text-sm font-medium rounded-lg
                            transition-all duration-150 relative
                            ${!currentMonthDate ? 'text-white/20 cursor-not-allowed' : 'cursor-pointer'}
                            ${(isStart || isEnd) ? 'bg-white text-black font-semibold shadow-lg hover:bg-white/95' : 
                              inRange && !isStart && !isEnd ? 'bg-white/10 text-white/90 hover:bg-white/5' : 
                              'text-white/90 hover:bg-white/5'}
                          `}
                        >
                          {date.getDate()}
                          {today && !isStart && !isEnd && (
                            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white/50 rounded-full" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Status Text */}
                {isSelectingRange && tempStartDate && (
                  <div className="mt-4 text-xs text-white/50 text-center">
                    Select end date
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DateRangeFilter;
