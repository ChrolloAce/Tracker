import { useEffect, useState } from 'react';
import { X, Plus, Check } from 'lucide-react';
import { CreatorLabel } from '../../types/firestore';
import CreatorLabelService from '../../services/CreatorLabelService';
import { LABEL_COLOR_OPTIONS, getLabelColorClass } from './CreatorLabelBadges';

interface Props {
  orgId: string;
  projectId: string;
  userId: string;
  /** Creator IDs to apply the labels to. */
  creatorIds: string[];
  /** Project labels, supplied by the parent (already loaded for the page).
   *  Avoids a redundant Firestore read on open and keeps the modal usable
   *  even if a permission glitch hits the listLabels endpoint. */
  labels: CreatorLabel[];
  onClose: () => void;
  /** Called after a successful save so the parent can refresh data. */
  onSaved: () => void;
}

/**
 * Bulk label assignment modal.
 *
 * Pick one-or-many labels, choose between two write modes, and apply them in
 * one click to every selected creator. Default mode is additive (arrayUnion)
 * so existing creator labels are preserved; the toggle flips to replace mode
 * (overwrite) for cases where the admin wants the selected set to be the
 * canonical labels for the group.
 *
 * Inline label creation is included so admins don't have to bounce out to a
 * different screen to add a tag they want to apply right now.
 */
export function BulkLabelModal({
  orgId,
  projectId,
  userId,
  creatorIds,
  labels: initialLabels,
  onClose,
  onSaved,
}: Props) {
  const [labels, setLabels] = useState<CreatorLabel[]>(initialLabels);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('orange');
  // 'add' = arrayUnion per creator (preserves existing). 'replace' = overwrite
  // each creator's labelIds with the selected set. Default is 'add' because
  // that's almost always what someone running a bulk action wants.
  const [mode, setMode] = useState<'add' | 'replace'>('add');

  // Keep in sync if the parent reloads labels (e.g. after creating one inline
  // we trigger an upstream refresh and the new list streams back down).
  useEffect(() => { setLabels(initialLabels); }, [initialLabels]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
      // Optimistic insert — don't refetch; the parent reloads on save anyway.
      setLabels(prev => [
        ...prev,
        {
          id,
          orgId,
          projectId,
          name,
          color: newColor,
          createdAt: undefined as any,
          createdBy: userId,
        } as CreatorLabel,
      ]);
      setSelected(prev => new Set(prev).add(id));
      setNewName('');
    } catch (e) {
      console.error('Failed to create label', e);
      alert('Failed to create label.');
    } finally {
      setCreating(false);
    }
  };

  const handleApply = async () => {
    if (selected.size === 0 || creatorIds.length === 0) return;
    setSaving(true);
    try {
      const labelIds = Array.from(selected);
      if (mode === 'replace') {
        // Each creator gets exactly the selected set.
        await Promise.all(
          creatorIds.map(cid =>
            CreatorLabelService.setCreatorLabels(orgId, projectId, cid, labelIds),
          ),
        );
      } else {
        // Additive — arrayUnion via addLabelToCreator. Cheaper to fan-out per
        // (creator, label) than to read existing then merge in a single set.
        const tasks: Promise<void>[] = [];
        for (const cid of creatorIds) {
          for (const lid of labelIds) {
            tasks.push(CreatorLabelService.addLabelToCreator(orgId, projectId, cid, lid));
          }
        }
        await Promise.all(tasks);
      }
      onSaved();
      onClose();
    } catch (e) {
      console.error('Failed to bulk-label creators', e);
      alert('Failed to apply labels. Some creators may not have been updated.');
    } finally {
      setSaving(false);
    }
  };

  const count = creatorIds.length;
  const applyDisabled = saving || selected.size === 0 || count === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-content">Label {count} creator{count === 1 ? '' : 's'}</h2>
            <p className="text-xs text-content-muted">Pick one or more labels to apply</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-content hover:bg-surface-hover"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="px-5 pt-4">
          <div className="inline-flex items-center bg-surface-secondary rounded-lg p-0.5 border border-border-subtle">
            <button
              onClick={() => setMode('add')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                mode === 'add' ? 'bg-surface text-content shadow-sm' : 'text-content-muted hover:text-content'
              }`}
            >
              Add to existing
            </button>
            <button
              onClick={() => setMode('replace')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                mode === 'replace' ? 'bg-surface text-content shadow-sm' : 'text-content-muted hover:text-content'
              }`}
            >
              Replace
            </button>
          </div>
          <p className="text-[11px] text-content-muted mt-2">
            {mode === 'add'
              ? 'Adds the chosen labels to each selected creator. Existing labels are kept.'
              : 'Overwrites each selected creator’s labels with exactly this set.'}
          </p>
        </div>

        <div className="px-5 py-4 max-h-[45vh] overflow-y-auto space-y-2">
          {labels.length === 0 ? (
            <div className="text-sm text-content-muted py-4 text-center">
              No labels yet. Create one below.
            </div>
          ) : (
            labels.map(label => {
              const isOn = selected.has(label.id);
              return (
                <button
                  key={label.id}
                  onClick={() => toggle(label.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-hover text-left"
                >
                  <span
                    className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                      isOn ? 'bg-orange-500 border-orange-500 text-white' : 'border-border bg-surface-secondary'
                    }`}
                  >
                    {isOn && <Check className="w-3.5 h-3.5" />}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${getLabelColorClass(label.color)}`}
                  >
                    {label.name}
                  </span>
                  {label.isDefault && (
                    <span className="text-[10px] uppercase tracking-wider text-content-muted">default</span>
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

        <div className="px-5 py-3 border-t border-border-subtle flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm text-content-muted hover:text-content"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={applyDisabled}
            className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-bold shadow-[0_3px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] active:shadow-[0_0_0_0_#c2410c] active:translate-y-0.5 transition-all"
          >
            {saving
              ? 'Applying…'
              : `Apply to ${count} creator${count === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BulkLabelModal;
