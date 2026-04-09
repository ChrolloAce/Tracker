import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { OrgMember, Creator } from '../types/firestore';
import CreatorLinksService from '../services/CreatorLinksService';
import OrganizationService from '../services/OrganizationService';
import { X, Save, User as UserIcon, Mail, Phone, FileText, AlertCircle } from 'lucide-react';

interface EditCreatorProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  creator: OrgMember;
  profile?: Creator;
}

const EditCreatorProfileModal: React.FC<EditCreatorProfileModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  creator,
  profile,
}) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, creator.userId]);

  const loadData = async () => {
    if (!currentOrgId || !currentProjectId) return;

    try {
      setLoading(true);
      // Use passed profile or fetch it
      let creatorProfile = profile;
      if (!creatorProfile) {
        creatorProfile = await CreatorLinksService.getCreatorProfile(
          currentOrgId,
          currentProjectId,
          creator.userId
        ) || undefined;
      }

      setName(creatorProfile?.displayName || creator.displayName || '');
      setEmail(creatorProfile?.email || creator.email || '');
      setPhone(creatorProfile?.phone || '');
      setNotes(creatorProfile?.notes || '');
    } catch (err) {
      console.error('Failed to load creator data:', err);
      setError('Failed to load creator information');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrgId || !currentProjectId) {
      setError('Missing organization or project context');
      return;
    }

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    // Validate email if provided
    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError('Please enter a valid email address');
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);

      // Update creator profile in project creators subcollection
      await CreatorLinksService.updateCreatorProfile(
        currentOrgId,
        currentProjectId,
        creator.userId,
        {
          displayName: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
        }
      );

      // Also update the org member document so the table shows the new data
      try {
        await OrganizationService.updateMember(currentOrgId, creator.userId, {
          displayName: name.trim(),
          email: email.trim() || undefined,
        });
      } catch {
        // Member doc may not exist for creators added without invite — that's fine
      }

      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Failed to update creator:', error);
      setError(error.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-secondary rounded-2xl border border-border w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-content rounded-xl flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-content-inverse" />
            </div>
            <h2 className="text-xl font-semibold text-content">Edit Creator Profile</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-content-muted hover:text-content hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-border-strong border-t-content"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-400">{error}</div>
                </div>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-content mb-2">
                Name <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-muted" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Creator's full name"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-surface-secondary border border-border rounded-xl text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-transparent transition-colors"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-content mb-2">
                Email <span className="text-content-muted font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="creator@example.com"
                  className="w-full pl-10 pr-4 py-3 bg-surface-secondary border border-border rounded-xl text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-transparent transition-colors"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-content mb-2">
                Phone <span className="text-content-muted font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-muted" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full pl-10 pr-4 py-3 bg-surface-secondary border border-border rounded-xl text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-transparent transition-colors"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-content mb-2">
                Notes <span className="text-content-muted font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-5 h-5 text-content-muted" />
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes about this creator..."
                  rows={3}
                  className="w-full pl-10 pr-4 py-3 bg-surface-secondary border border-border rounded-xl text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-transparent transition-colors resize-none"
                />
              </div>
            </div>
          </form>
        )}

        {/* Actions */}
        <div className="flex gap-3 px-6 py-5 border-t border-border">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-surface-secondary hover:bg-surface-active text-content font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={saving || loading || !name.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 font-semibold rounded-xl transition-colors disabled:cursor-not-allowed bg-content hover:bg-content/90 text-content-inverse disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-content-inverse/30 border-t-content-inverse rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EditCreatorProfileModal;
