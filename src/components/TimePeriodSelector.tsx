import React, { useState } from 'react';
import { BarChart3, ChevronDown } from 'lucide-react';

export type TimePeriodType = 'days' | 'weeks' | 'months' | 'quarters' | 'years';

interface TimePeriodSelectorProps {
  selectedPeriod: TimePeriodType;
  onPeriodChange: (period: TimePeriodType) => void;
}

const TimePeriodSelector: React.FC<TimePeriodSelectorProps> = ({
  selectedPeriod,
  onPeriodChange
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const periodOptions = [
    { value: 'days', label: 'Daily', description: 'Show data by day' },
    { value: 'weeks', label: 'Weekly', description: 'Show data by week' },
    { value: 'months', label: 'Monthly', description: 'Show data by month' },
    { value: 'quarters', label: 'Quarterly', description: 'Show data by quarter' },
    { value: 'years', label: 'Yearly', description: 'Show data by year' },
  ];

  const getSelectedLabel = () => {
    const option = periodOptions.find(opt => opt.value === selectedPeriod);
    return option?.label || 'Weekly';
  };

  const handlePeriodSelect = (period: TimePeriodType) => {
    onPeriodChange(period);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <BarChart3 className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">
          {getSelectedLabel()}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-2">
            {periodOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handlePeriodSelect(option.value as TimePeriodType)}
                className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors ${
                  selectedPeriod === option.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-gray-500">{option.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TimePeriodSelector;
