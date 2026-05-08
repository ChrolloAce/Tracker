import { useEffect, useState } from 'react';
import { X, Check } from 'lucide-react';
import { OrgMember } from '../../types/firestore';
import { Project } from '../../types/projects';
import ProjectService from '../../services/ProjectService';

interface Props {
  orgId: string;
  creator: OrgMember;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Per-creator project assignment modal.
 *
 * Lets the admin pick which projects this creator appears in. Source of truth
 * is `members/{creatorId}.creatorProjectIds` — `ProjectService.assignCreatorToProjects`
 * writes the full array in one update.
 *
 * Important: this modal does NOT create or delete the per-project `creators/{id}`
 * documents — those are created lazily when the creator is first linked to an
 * account in that project. Removing a project from the list just means the
 * creator stops appearing in that project's creator picker.
 */
export function AssignCreatorProjectsModal({ orgId, creator, onClose, onSaved }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(creator.creatorProjectIds || []));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await ProjectService.getProjects(orgId, false);
        if (!cancelled) {
          setProjects(list);
          const current = await ProjectService.getCreatorProjectIds(orgId, creator.userId);
          if (!cancelled) setSelected(new Set(current));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId, creator.userId]);

  const toggle = (projectId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await ProjectService.assignCreatorToProjects(orgId, creator.userId, Array.from(selected));
      onSaved();
      onClose();
    } catch (e) {
      console.error('Failed to assign projects', e);
      alert('Failed to update project assignments.');
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
            <h2 className="text-base font-semibold text-content">Assign to projects</h2>
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

        <div className="px-5 py-4 max-h-[55vh] overflow-y-auto space-y-1">
          {loading ? (
            <div className="text-sm text-content-muted py-6 text-center">Loading projects…</div>
          ) : projects.length === 0 ? (
            <div className="text-sm text-content-muted py-4 text-center">No projects in this organization yet.</div>
          ) : (
            projects.map(project => {
              const isOn = selected.has(project.id);
              return (
                <button
                  key={project.id}
                  onClick={() => toggle(project.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-hover text-left"
                >
                  <span
                    className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                      isOn ? 'bg-orange-500 border-orange-500 text-white' : 'border-border bg-surface-secondary'
                    }`}
                  >
                    {isOn && <Check className="w-3.5 h-3.5" />}
                  </span>
                  {project.color && (
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                  )}
                  <span className="text-sm font-medium text-content truncate">{project.name}</span>
                  {project.icon && (
                    <span className="ml-auto text-xs text-content-muted">{project.icon}</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="px-5 py-3 border-t border-border-subtle flex items-center justify-between">
          <p className="text-xs text-content-muted">
            {selected.size} project{selected.size === 1 ? '' : 's'} selected
          </p>
          <div className="flex items-center gap-2">
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
    </div>
  );
}

export default AssignCreatorProjectsModal;
