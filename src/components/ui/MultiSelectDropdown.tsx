import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { PlatformIcon } from './PlatformIcon';

type Platform = 'instagram' | 'tiktok' | 'youtube' | 'twitter';

interface Option {
  id: string;
  label: string;
  avatar?: string;
  platform?: Platform;
  groupId?: string;
  count?: number;
}

interface Group {
  id: string;
  label: string;
  avatar?: string;
  count?: number;
}

interface MultiSelectDropdownProps {
  options: Option[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
  maxDisplayCount?: number;
  groups?: Group[];
  /** Sort posters (count > 0) high → low; non-posters fall to a dimmed section. */
  sortByCount?: boolean;
  /** Section off rows whose count is 0/undefined and dim them. Requires sortByCount. */
  dimNonPosters?: boolean;
  /** Render group headers as collapsible row-style entries (chevron, default collapsed). */
  collapsibleGroups?: boolean;
  /** 'creators-posted' = stacked top-3 avatars + "N creators posted" text in the trigger. */
  triggerVariant?: 'default' | 'creators-posted';
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  options,
  selectedIds,
  onChange,
  placeholder = 'Select items...',
  maxDisplayCount = 2,
  groups,
  sortByCount = false,
  dimNonPosters = false,
  collapsibleGroups = false,
  triggerVariant = 'default',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [failedAvatars, setFailedAvatars] = useState<Set<string>>(new Set());
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const markAvatarFailed = (key: string) => {
    setFailedAvatars(prev => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };
  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  };
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Build grouping structure. Falls back to a flat list when `groups` is not provided.
  const { ungrouped, groupedSections } = useMemo(() => {
    if (!groups || groups.length === 0) {
      return { ungrouped: options, groupedSections: [] as Array<{ group: Group; items: Option[] }> };
    }
    const validGroupIds = new Set(groups.map(g => g.id));
    const groupBuckets = new Map<string, Option[]>();
    groups.forEach(g => groupBuckets.set(g.id, []));
    const looseItems: Option[] = [];
    for (const opt of options) {
      if (opt.groupId && validGroupIds.has(opt.groupId)) {
        groupBuckets.get(opt.groupId)!.push(opt);
      } else {
        looseItems.push(opt);
      }
    }
    const sections = groups
      .map(g => ({ group: g, items: groupBuckets.get(g.id) || [] }))
      .filter(s => s.items.length > 0);
    return { ungrouped: looseItems, groupedSections: sections };
  }, [options, groups]);

  // Sort and split into "active" (count > 0) and "inactive" buckets when requested.
  const { activeUngrouped, inactiveUngrouped, activeSections, inactiveSections } = useMemo(() => {
    if (!sortByCount) {
      return {
        activeUngrouped: ungrouped,
        inactiveUngrouped: [] as Option[],
        activeSections: groupedSections,
        inactiveSections: [] as typeof groupedSections,
      };
    }
    const byCountDesc = <T extends { count?: number; label: string }>(a: T, b: T) =>
      (b.count || 0) - (a.count || 0) || a.label.localeCompare(b.label);

    const sortedUngrouped = [...ungrouped].sort(byCountDesc);
    const sortedSections = [...groupedSections].sort((a, b) => byCountDesc(a.group, b.group));
    if (!dimNonPosters) {
      return {
        activeUngrouped: sortedUngrouped,
        inactiveUngrouped: [] as Option[],
        activeSections: sortedSections,
        inactiveSections: [] as typeof sortedSections,
      };
    }
    return {
      activeUngrouped: sortedUngrouped.filter(o => (o.count || 0) > 0),
      inactiveUngrouped: sortedUngrouped.filter(o => (o.count || 0) === 0),
      activeSections: sortedSections.filter(s => (s.group.count || 0) > 0),
      inactiveSections: sortedSections.filter(s => (s.group.count || 0) === 0),
    };
  }, [ungrouped, groupedSections, sortByCount, dimNonPosters]);

  const totalGroupsAndUngrouped = groupedSections.length + ungrouped.length;
  const activeCount = activeSections.length + activeUngrouped.length;

  const selectedOptions = options.filter(opt => selectedIds.includes(opt.id));
  const displayText = selectedIds.length === 0
    ? placeholder
    : selectedIds.length === options.length
    ? `All Accounts (${options.length})`
    : selectedIds.length <= maxDisplayCount
    ? selectedOptions.map(opt => opt.label).join(', ')
    : `${selectedIds.length} accounts selected`;

  // ── Row renderers ────────────────────────────────────────────────

  const renderAvatar = (
    key: string,
    avatar: string | undefined,
    label: string,
    sizeClass: string,
    initialClass: string,
    dim: boolean,
  ) => {
    if (avatar && !failedAvatars.has(key)) {
      return (
        <img
          src={avatar}
          alt={label}
          className={clsx(sizeClass, "rounded-full object-cover flex-shrink-0", dim && "opacity-50")}
          onError={() => markAvatarFailed(key)}
        />
      );
    }
    return (
      <div className={clsx(sizeClass, "rounded-full bg-surface-active flex items-center justify-center flex-shrink-0", dim && "opacity-50")}>
        <span className={clsx(initialClass, "font-bold text-content-muted")}>
          {label.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  };

  const renderRow = (option: Option, indent: boolean, dim: boolean) => {
    const isSelected = selectedIds.includes(option.id);
    return (
      <button
        key={option.id}
        onClick={() => handleToggleOption(option.id)}
        className={clsx(
          "w-full px-4 py-2.5 flex items-center space-x-3 hover:bg-surface-hover transition-colors",
          isSelected && "bg-surface-active",
          indent && "pl-8",
          dim && "opacity-60"
        )}
      >
        <div className={clsx(
          "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
          isSelected ? "bg-content border-content" : "border-border-hover"
        )}>
          {isSelected && <Check className="w-3 h-3 text-surface" />}
        </div>

        {renderAvatar(`opt:${option.id}`, option.avatar, option.label, "w-8 h-8", "text-xs", dim)}

        <span className="text-sm font-medium truncate flex-1 text-left text-content">
          {option.label}
        </span>

        {typeof option.count === 'number' && (
          <span className="text-xs font-medium tabular-nums text-content-muted flex-shrink-0">
            {option.count}
          </span>
        )}

        {option.platform && (
          <PlatformIcon platform={option.platform} size="sm" className="flex-shrink-0 ml-2" />
        )}
      </button>
    );
  };

  const handleToggleGroup = (groupId: string) => {
    const groupItems = groupedSections.find(s => s.group.id === groupId)?.items || [];
    const groupIds = groupItems.map(o => o.id);
    const allSelected = groupIds.length > 0 && groupIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      onChange(selectedIds.filter(id => !groupIds.includes(id)));
    } else {
      const merged = new Set(selectedIds);
      groupIds.forEach(id => merged.add(id));
      onChange(Array.from(merged));
    }
  };

  // Renders a creator-style row (collapsible variant): row-shaped header with
  // chevron, click row toggles selection of all items in the group, click
  // chevron toggles expansion.
  const renderCollapsibleGroupHeader = (
    group: Group,
    items: Option[],
    expanded: boolean,
    dim: boolean,
  ) => {
    const groupIds = items.map(o => o.id);
    const allSelected = groupIds.length > 0 && groupIds.every(id => selectedIds.includes(id));
    const someSelected = !allSelected && groupIds.some(id => selectedIds.includes(id));
    return (
      <div
        key={`grp:${group.id}`}
        role="button"
        tabIndex={0}
        onClick={() => handleToggleGroup(group.id)}
        className={clsx(
          "w-full px-4 py-2.5 flex items-center space-x-3 hover:bg-surface-hover transition-colors cursor-pointer",
          (allSelected || someSelected) && "bg-surface-active",
          dim && "opacity-60"
        )}
      >
        <div className={clsx(
          "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
          allSelected ? "bg-content border-content" : someSelected ? "bg-content/40 border-content" : "border-border-hover"
        )}>
          {allSelected && <Check className="w-3 h-3 text-surface" />}
          {someSelected && <div className="w-2 h-2 bg-surface rounded-sm" />}
        </div>

        {renderAvatar(`grp:${group.id}`, group.avatar, group.label, "w-8 h-8", "text-xs", dim)}

        <span className="text-sm font-medium truncate flex-1 text-left text-content">
          {group.label}
        </span>

        {typeof group.count === 'number' && (
          <span className="text-xs font-medium tabular-nums text-content-muted flex-shrink-0">
            {group.count}
          </span>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleGroupExpanded(group.id);
          }}
          className="flex-shrink-0 p-0.5 rounded hover:bg-surface-active transition-colors"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <ChevronRight className={clsx(
            "w-4 h-4 text-content-muted transition-transform",
            expanded && "rotate-90"
          )} />
        </button>
      </div>
    );
  };

  // The classic ALL-CAPS group header (used when collapsibleGroups=false).
  const renderClassicGroupHeader = (group: Group, items: Option[]) => {
    const groupIds = items.map(o => o.id);
    const allSelected = groupIds.length > 0 && groupIds.every(id => selectedIds.includes(id));
    const someSelected = !allSelected && groupIds.some(id => selectedIds.includes(id));
    return (
      <div className="px-4 py-2 flex items-center space-x-3 bg-surface-hover/60 border-y border-border">
        {renderAvatar(`grp:${group.id}`, group.avatar, group.label, "w-6 h-6", "text-[10px]", false)}
        <span className="text-xs font-semibold uppercase tracking-wide text-content-muted truncate flex-1">
          {group.label}
          <span className="ml-1 normal-case font-normal opacity-60">({items.length})</span>
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggleGroup(group.id);
          }}
          className={clsx(
            "text-[11px] font-medium transition-colors flex-shrink-0",
            allSelected ? "text-red-400 hover:text-red-300" : "text-content hover:text-content"
          )}
        >
          {allSelected ? 'Deselect all' : someSelected ? 'Select rest' : 'Select all'}
        </button>
      </div>
    );
  };

  const renderSection = (
    section: { group: Group; items: Option[] },
    dim: boolean,
  ) => {
    if (collapsibleGroups) {
      const expanded = expandedGroupIds.has(section.group.id);
      return (
        <div key={section.group.id}>
          {renderCollapsibleGroupHeader(section.group, section.items, expanded, dim)}
          {expanded && section.items.map(opt => renderRow(opt, true, dim))}
        </div>
      );
    }
    return (
      <div key={section.group.id} className="mt-1">
        {renderClassicGroupHeader(section.group, section.items)}
        {section.items.map(opt => renderRow(opt, true, false))}
      </div>
    );
  };

  // ── Trigger ──────────────────────────────────────────────────────

  const renderTrigger = () => {
    if (triggerVariant === 'creators-posted') {
      // Top-3 active groups by count for the avatar stack.
      const top3 = activeSections.slice(0, 3).map(s => s.group);
      return (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 bg-surface-hover border border-border hover:border-border-hover rounded-lg text-sm font-medium text-content focus:outline-none focus:ring-2 focus:ring-border-hover transition-all min-w-[180px] backdrop-blur-sm"
        >
          {top3.length > 0 && (
            <div className="flex -space-x-2 flex-shrink-0">
              {top3.map((g, i) => (
                <div
                  key={g.id}
                  className="ring-2 ring-surface-hover rounded-full"
                  style={{ zIndex: 3 - i }}
                >
                  {renderAvatar(`trig:${g.id}`, g.avatar, g.label, "w-6 h-6", "text-[10px]", false)}
                </div>
              ))}
            </div>
          )}
          <span className="text-sm text-content truncate">
            {activeCount > 0
              ? `${activeCount} ${activeCount === 1 ? 'creator' : 'creators'} posted`
              : 'No posts this period'}
          </span>
          {selectedIds.length > 0 && selectedIds.length < options.length && (
            <span className="flex items-center justify-center min-w-5 h-5 px-1.5 bg-surface-active text-content text-[10px] font-bold rounded-full flex-shrink-0">
              {selectedIds.length}
            </span>
          )}
          <ChevronDown className={clsx(
            "w-4 h-4 text-content-muted transition-transform flex-shrink-0 ml-auto",
            isOpen && "transform rotate-180"
          )} />
        </button>
      );
    }
    return (
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-surface-hover border border-border hover:border-border-hover rounded-lg text-sm font-medium text-content focus:outline-none focus:ring-2 focus:ring-border-hover transition-all min-w-[180px] backdrop-blur-sm"
      >
        <span className="flex-1 text-left truncate">{displayText}</span>
        <div className="flex items-center space-x-1">
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-center w-5 h-5 bg-surface-active text-content text-xs font-bold rounded-full">
              {selectedIds.length}
            </div>
          )}
          <ChevronDown className={clsx(
            "w-4 h-4 text-content-muted transition-transform",
            isOpen && "transform rotate-180"
          )} />
        </div>
      </button>
    );
  };

  // ── Render ───────────────────────────────────────────────────────

  const headerLabel = triggerVariant === 'creators-posted' ? 'All creators' : 'Select Accounts';
  const headerCount = triggerVariant === 'creators-posted' ? totalGroupsAndUngrouped : null;

  return (
    <div className="relative" ref={dropdownRef}>
      {renderTrigger()}

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border rounded-lg shadow-2xl z-50 max-h-96 overflow-hidden flex flex-col backdrop-blur-xl">
          {/* Header */}
          <div className="p-3 border-b border-border flex items-center justify-between bg-surface-hover">
            <span className="text-sm font-semibold text-content">
              {headerLabel}
              {headerCount !== null && (
                <span className="ml-2 text-content-muted font-normal">{headerCount}</span>
              )}
            </span>
            <div className="flex items-center space-x-2">
              {selectedIds.length > 0 && selectedIds.length < options.length && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
                >
                  Clear All
                </button>
              )}
              {/* Hide when state is empty — dashboard treats empty as "all shown",
                  so "Select All" would be a confusing no-op. Show "Deselect All"
                  only when an explicit full-selection is in place. */}
              {selectedIds.length > 0 && selectedIds.length < options.length && (
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-content hover:text-content font-medium transition-colors"
                >
                  Select All
                </button>
              )}
              {selectedIds.length === options.length && options.length > 0 && (
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
                >
                  Deselect All
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1">
            {options.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-content-muted">No accounts available</p>
              </div>
            ) : (
              <div className="py-2">
                {/* Active (posters) */}
                {activeUngrouped.map(opt => renderRow(opt, false, false))}
                {activeSections.map(section => renderSection(section, false))}

                {/* Divider + dimmed non-posters */}
                {dimNonPosters && (inactiveUngrouped.length + inactiveSections.length) > 0 && (
                  <>
                    <div className="px-4 py-2 mt-2 border-t border-border">
                      <span className="text-[10px] uppercase tracking-wide text-content-muted font-semibold">
                        Didn't post this period
                      </span>
                    </div>
                    {inactiveUngrouped.map(opt => renderRow(opt, false, true))}
                    {inactiveSections.map(section => renderSection(section, true))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {selectedIds.length > 0 && (
            <div className="p-3 border-t border-border bg-surface-hover">
              <div className="text-xs text-content-muted">
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
