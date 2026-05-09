import { useEffect, useMemo, useState } from 'react';
import { X, Plus, Check, Minus } from 'lucide-react';
import { CreatorLabel, Creator } from '../../types/firestore';
import CreatorLabelService from '../../services/CreatorLabelService';
import { LABEL_COLOR_OPTIONS, getLabelColorClass } from './CreatorLabelBadges';

interface Props {
  orgId: string;
  projectId: string;
  userId: string;
  /** Creator IDs to apply changes to. */
  creatorIds: string[];
  /** Project labels, supplied by the parent. */
  labels: CreatorLabel[];
  /** Creator profile docs (for reading current labelIds — drives the
   *  pre-checked / indeterminate initial state). */
  creatorProfiles: Map<string, Creator>;
  onClose: () => void;
  onSaved: () => void;
}

type State = 'on' | 'off' | 'mixed';

/**
 * Bulk label assignment modal — tri-state add/remove.
 *
 * For each project label we compute initial coverage across the selected
 * creators:
 *   - All have it → state 'on' (filled checkbox)
 *   - Some have it → state 'mixed' (— bar, indeterminate)
 *   - None have it → state 'off' (empty)
 *
 * Click cycle: mixed → on → off → on. So a single click on a partially-
 * applied label promotes it to "on every selected creator"; a second click
 * demotes to "off every selected creator". This makes both add and remove
 * possible without a separate mode toggle.
 *
 * On save we diff the chosen state against the initial coverage and only
 * write the deltas — `addLabelToCreator` for missing assignments, and
 * `removeLabelFromCreator` for the labels the admin flipped to off.
 */
export function BulkLabelModal({
  orgId,
  projectId,
  userId,
  creatorIds,
  labels: initialLabels,
  creatorProfiles,
  onClose,
  onSaved,
}: Props) {
  const [labels, setLabels] = useState<CreatorLabel[]>(initialLabels);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('orange');

  useEffect(() => { setLabels(initialLabels); }, [initialLabels]);

  // creatorId → Set of labelIds currently on that profile. Memoized so re-
  // renders during interaction don't re-walk the maps.
  const initialAssignments = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const cid of creatorIds) {
      const ids = creatorProfiles.get(cid)?.labelIds || [];
      map.set(cid, new Set(ids));
    }
    return map;
  }, [creatorIds, creatorProfiles]);

  // Initial state per labelId (on/mixed/off) + current state the user is
  // editing toward. Apply diffs against `initialState` on save.
  const initialState = useMemo(() => {
    const total = creatorIds.length;
    const map = new Map<string, State>();
    for (const label of labels) {
      let count = 0;
      for (const cid of creatorIds) {
        if (initialAssignments.get(cid)?.has(label.id)) count++;
      }
      map.set(label.id, count === 0 ? 'off' : count === total ? 'on' : 'mixed');
    }
    return map;
  }, [labels, creatorIds, initialAssignments]);

  const [state, setState] = useState<Map<string, State>>(initialState);
  // Re-seed when the initial state changes (label list grew, or modal re-opened
  // with a different selection). Using a stringified key keeps the Map identity
  // out of the dep array.
  const seedKey = useMemo(
    () => labels.map(l => `${l.id}:${initialState.get(l.id)}`).join(','),
    [labels, initialState],
  );
  useEffect(() => { setState(new Map(initialState)); }, [seedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const cycle = (id: string) => {
    setState(prev => {
      const next = new Map(prev);
      const cur = prev.get(id) || 'off';
      // mixed → on, on → off, off → on. Two-step toggle for the unambiguous
      // states; the indeterminate state always promotes to on.
      next.set(id, cur === 'on' ? 'off' : 'on');
      return next;
    });
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const id = await CreatorLabelService.createLabel(orgId, projectId, userId, {
        name,
        color: newColor,
      });
      // Optimistic insert + auto-select to "on" so it lands on every selected
      // creator when the admin hits Save.
      setLabels(prev => [
        ...prev,
        {
          id, orgId, projectId, name, color: newColor,
          createdAt: undefined as any, createdBy: userId,
        } as CreatorLabel,
      ]);
      setState(prev => new Map(prev).set(id, 'on'));
      setNewName('');
    } catch (e: any) {
      console.error('Failed to create label', e);
      const msg = e?.code || e?.message || String(e);
      alert(`Failed to create label: ${msg}`);
    } finally {
      setCreating(false);
    }
  };

  // Compute the diff that "Apply" will write. Labels left in their initial
  // state (or in 'mixed' that the admin didn't touch) are no-ops.
  const diff = useMemo(() => {
    const additions: Array<{ creatorId: string; labelId: string }> = [];
    const removals: Array<{ creatorId: string; labelId: string }> = [];
    for (const label of labels) {
      const cur = state.get(label.id);
      const init = initialState.get(label.id);
      if (cur === init) continue;
      if (cur === 'on') {
        for (const cid of creatorIds) {
          if (!initialAssignments.get(cid)?.has(label.id)) {
            additions.push({ creatorId: cid, labelId: label.id });
          }
        }
      } else if (cur === 'off') {
        for (const cid of creatorIds) {
          if (initialAssignments.get(cid)?.has(label.id)) {
            removals.push({ creatorId: cid, labelId: label.id });
          }
        }
      }
    }
    return { additions, removals };
  }, [labels, state, initialState, creatorIds, initialAssignments]);

  const handleApply = async () => {
    if (diff.additions.length === 0 && diff.removals.length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await Promise.all([
        ...diff.additions.map(({ creatorId, labelId }) =>
          CreatorLabelService.addLabelToCreator(orgId, projectId, creatorId, labelId)),
        ...diff.removals.map(({ creatorId, labelId }) =>
          CreatorLabelService.removeLabelFromCreator(orgId, projectId, creatorId, labelId)),
      ]);
      onSaved();
      onClose();
    } catch (e: any) {
      console.error('Failed to apply label changes', e);
      const msg = e?.code || e?.message || String(e);
      alert(`Failed to apply changes: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const count = creatorIds.length;
  const dirty = diff.additions.length > 0 || diff.removals.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-content">Label {count} creator{count === 1 ? '' : 's'}</h2>
            <p className="text-xs text-content-muted">Check to add · uncheck to remove · — means mixed</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-content hover:bg-surface-hover"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[45vh] overflow-y-auto space-y-1.5">
          {labels.length === 0 ? (
            <div className="text-sm text-content-muted py-4 text-center">
              No labels yet. Create one below.
            </div>
          ) : (
            labels.map(label => {
              const cur = state.get(label.id) || 'off';
              const init = initialState.get(label.id) || 'off';
              const changed = cur !== init;
              return (
                <button
                  key={label.id}
                  onClick={() => cycle(label.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    changed ? 'bg-surface-hover' : 'hover:bg-surface-hover'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                      cur === 'on'
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : cur === 'mixed'
                          ? 'bg-orange-500/40 border-orange-500 text-white'
                          : 'border-border bg-surface-secondary'
                    }`}
                  >
                    {cur === 'on' && <Check className="w-3.5 h-3.5" />}
                    {cur === 'mixed' && <Minus className="w-3.5 h-3.5" />}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${getLabelColorClass(label.color)}`}
                  >
                    {label.name}
                  </span>
                  {label.isDefault && (
                    <span className="text-[10px] uppercase tracking-wider text-content-muted">default</span>
                  )}
                  {changed && (
                    <span className="ml-auto text-[10px] uppercase tracking-wider text-orange-500 font-bold">
                      {cur === 'on' ? '+ add' : '− remove'}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="px-5 py-4 border-t border-border-subtle bg-surface-secondary space-y-3">
          <div className="text-xs font-semibold text-content-muted uppercase tracking-wider">Create new label</div>
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              placeholder="Label name"
              className="flex-1 px-3 py-1.5 rounded-lg bg-surface border border-border text-sm text-content placeholder:text-content-muted focus:outline-none focus:border-border-strong"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {LABEL_COLOR_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setNewColor(opt.value)}
                className={`w-6 h-6 rounded-full ${opt.swatch} ring-2 transition ${
                  newColor === opt.value ? 'ring-content' : 'ring-transparent hover:ring-border-strong'
                }`}
                title={opt.value}
              />
            ))}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border-subtle flex items-center justify-between gap-2">
          <div className="text-[11px] text-content-muted">
            {dirty
              ? `${diff.additions.length} add${diff.additions.length === 1 ? '' : 's'}, ${diff.removals.length} remove${diff.removals.length === 1 ? '' : 's'}`
              : 'No changes'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-sm text-content-muted hover:text-content"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={saving || !dirty}
              className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-bold shadow-[0_3px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] active:shadow-[0_0_0_0_#c2410c] active:translate-y-0.5 transition-all"
            >
              {saving ? 'Saving…' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BulkLabelModal;
