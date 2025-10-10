import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { clsx } from 'clsx';

interface Option {
  id: string;
  label: string;
  avatar?: string;
}

interface MultiSelectDropdownProps {
  options: Option[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
  maxDisplayCount?: number;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  options,
  selectedIds,
  onChange,
  placeholder = 'Select items...',
  maxDisplayCount = 2
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleOption = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(opt => opt.id));
    }
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const selectedOptions = options.filter(opt => selectedIds.includes(opt.id));
  const displayText = selectedIds.length === 0 
    ? placeholder
    : selectedIds.length === options.length
    ? `All Accounts (${options.length})`
    : selectedIds.length <= maxDisplayCount
    ? selectedOptions.map(opt => opt.label).join(', ')
    : `${selectedIds.length} accounts selected`;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-white/5 border border-white/10 hover:border-white/20 rounded-lg text-sm font-medium text-white/90 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all min-w-[180px] backdrop-blur-sm"
      >
        <span className="flex-1 text-left truncate">{displayText}</span>
        <div className="flex items-center space-x-1">
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-center w-5 h-5 bg-white/20 text-white text-xs font-bold rounded-full">
              {selectedIds.length}
            </div>
          )}
          <ChevronDown className={clsx(
            "w-4 h-4 text-white/50 transition-transform",
            isOpen && "transform rotate-180"
          )} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-white/10 rounded-lg shadow-2xl z-50 max-h-96 overflow-hidden flex flex-col backdrop-blur-xl">
          {/* Header */}
          <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/5">
            <span className="text-sm font-semibold text-white/90">
              Select Accounts
            </span>
            <div className="flex items-center space-x-2">
              {selectedIds.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={handleSelectAll}
                className="text-xs text-white/90 hover:text-white font-medium transition-colors"
              >
                {selectedIds.length === options.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1">
            {options.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-white/40">No accounts available</p>
              </div>
            ) : (
              <div className="py-2">
                {options.map((option) => {
                  const isSelected = selectedIds.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleToggleOption(option.id)}
                      className={clsx(
                        "w-full px-4 py-2.5 flex items-center space-x-3 hover:bg-white/5 transition-colors",
                        isSelected && "bg-white/10"
                      )}
                    >
                      {/* Checkbox */}
                      <div className={clsx(
                        "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                        isSelected 
                          ? "bg-white/90 border-white/90" 
                          : "border-white/20"
                      )}>
                        {isSelected && <Check className="w-3 h-3 text-gray-900" />}
                      </div>

                      {/* Avatar */}
                      {option.avatar ? (
                        <img
                          src={option.avatar}
                          alt={option.label}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-white/70">
                            {option.label.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}

                      {/* Label */}
                      <span className={clsx(
                        "text-sm font-medium truncate flex-1 text-left",
                        isSelected 
                          ? "text-white" 
                          : "text-white/90"
                      )}>
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {selectedIds.length > 0 && (
            <div className="p-3 border-t border-white/10 bg-white/5">
              <div className="text-xs text-white/60">
                {selectedIds.length} of {options.length} accounts selected
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;

