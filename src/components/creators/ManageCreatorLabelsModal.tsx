import { useEffect, useState } from 'react';
import { X, Plus, Check, Trash2 } from 'lucide-react';
import { CreatorLabel, OrgMember } from '../../types/firestore';
import CreatorLabelService from '../../services/CreatorLabelService';
import { LABEL_COLOR_OPTIONS, getLabelColorClass } from './CreatorLabelBadges';

interface Props {
  orgId: string;
  projectId: string;
  userId: string;
  creator: OrgMember;
  /** Current labelIds on the creator profile so we can pre-check the boxes. */
  initialLabelIds: string[];
  onClose: () => void;
  /** Called after a successful save so the parent can refresh data. */
  onSaved: () => void;
}

/**
 * Per-creator label assignment modal.
 *
 * Lists every label in the project as a checkbox row. Admins can also create
 * a new label inline (name + color swatch picker) without leaving the modal —
 * that label is immediately available to assign. Save writes the full labelIds
 * array back to the creator's profile in one update.
 */
export function ManageCreatorLabelsModal({
  orgId,
  projectId,
  userId,
  creator,
  initialLabelIds,
  onClose,
  onSaved,
}: Props) {
  const [labels, setLabels] = useState<CreatorLabel[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialLabelIds));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('orange');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const list = await CreatorLabelService.listLabels(orgId, projectId, userId);
      if (!cancelled) {
        setLabels(list);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId, projectId, userId]);

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
      const fresh = await CreatorLabelService.listLabels(orgId, projectId);
      setLabels(fresh);
      setSelected(prev => new Set(prev).add(id));
      setNewName('');
    } catch (e: any) {
      console.error('Failed to create label', e);
      const msg = e?.code || e?.message || String(e);
      alert(`Failed to create label: ${msg}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteLabel = async (label: CreatorLabel) => {
    if (!confirm(`Delete the "${label.name}" label?\n\nIt will be removed from every creator that has it assigned.`)) return;
    try {
      await CreatorLabelService.deleteLabel(orgId, projectId, label.id);
      const fresh = await CreatorLabelService.listLabels(orgId, projectId);
      setLabels(fresh);
      setSelected(prev => {
        const next = new Set(prev);
        next.delete(label.id);
        return next;
      });
    } catch (e) {
      console.error('Failed to delete label', e);
      alert('Failed to delete label.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await CreatorLabelService.setCreatorLabels(
        orgId,
        projectId,
        creator.userId,
        Array.from(selected),
      );
      onSaved();
      onClose();
    } catch (e) {
      console.error('Failed to save labels', e);
      alert('Failed to save labels.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-content">Labels</h2>
            <p className="text-xs text-content-muted truncate">{creator.displayName || creator.email}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-content hover:bg-surface-hover"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[55vh] overflow-y-auto space-y-2">
          {loading ? (
            <div className="text-sm text-content-muted py-6 text-center">Loading labels…</div>
          ) : labels.length === 0 ? (
            <div className="text-sm text-content-muted py-4 text-center">
              No labels yet. Create one below.
            </div>
          ) : (
            labels.map(label => {
              const isOn = selected.has(label.id);
              return (
                <div
                  key={label.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-surface-hover group"
                >
                  <button
                    onClick={() => toggle(label.id)}
                    className="flex items-center gap-3 flex-1 min-w-0"
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
                  <button
                    onClick={() => handleDeleteLabel(label)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-content-muted hover:text-red-400 hover:bg-red-500/10 transition"
                    title="Delete label"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-bold shadow-[0_3px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] active:shadow-[0_0_0_0_#c2410c] active:translate-y-0.5 transition-all"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ManageCreatorLabelsModal;
