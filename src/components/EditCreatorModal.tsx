import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { OrgMember, Creator } from '../types/firestore';
import CreatorLinksService from '../services/CreatorLinksService';
import { X, Save, DollarSign, User as UserIcon, Copy, Lightbulb } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import clsx from 'clsx';

interface EditCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  creator: OrgMember;
}

const PAYMENT_TEMPLATES = [
  {
    title: 'Upfront + Milestone',
    example: '$500 upfront for 10 videos, then $50 per video after that'
  },
  {
    title: 'Tiered Views',
    example: '$30 per video under 10k views, $50 per video for 10k-100k views, $100 per video over 100k views'
  },
  {
    title: 'Hybrid Performance',
    example: '$200 base per video + $10 CPM for views over 50k'
  },
  {
    title: 'Revenue Share',
    example: '20% of ad revenue + $5 per tracked link click'
  },
  {
    title: 'Multi-Stage Bonus',
    example: '$300 upfront for 10 videos, bonus $500 when reaching 100k total views, additional $1k at 1M views'
  },
  {
    title: 'Custom Schedule',
    example: '$1000/month retainer for 8 videos minimum, plus $75 for each additional video'
  }
];

const EditCreatorModal: React.FC<EditCreatorModalProps> = ({ isOpen, onClose, onSuccess, creator }) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [isPaid, setIsPaid] = useState(true);
  const [paymentStructure, setPaymentStructure] = useState('');
  const [paymentSchedule, setPaymentSchedule] = useState<'weekly' | 'bi-weekly' | 'monthly' | 'custom'>('monthly');
  const [customSchedule, setCustomSchedule] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCreatorData();
    }
  }, [isOpen, creator.userId, currentOrgId, currentProjectId]);

  const loadCreatorData = async () => {
    if (!currentOrgId || !currentProjectId) return;

    try {
      setLoading(true);
      const profile = await CreatorLinksService.getCreatorProfile(
        currentOrgId,
        currentProjectId,
        creator.userId
      );

      // Load existing payment data if available
      if (profile?.paymentInfo) {
        setIsPaid(profile.paymentInfo.isPaid !== false);
        setPaymentStructure(profile.paymentInfo.structure || '');
        setPaymentSchedule(profile.paymentInfo.schedule || 'monthly');
        setCustomSchedule(profile.paymentInfo.customSchedule || '');
        setAdditionalNotes(profile.paymentInfo.notes || '');
      }
    } catch (error) {
      console.error('Failed to load creator data:', error);
      setError('Failed to load creator information');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setShowTemplates(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!currentOrgId || !currentProjectId) {
      setError('Missing organization or project context');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Save payment information to creator profile
      await CreatorLinksService.updateCreatorPaymentInfo(
        currentOrgId,
        currentProjectId,
        creator.userId,
        {
          isPaid,
          structure: paymentStructure,
          schedule: paymentSchedule,
          customSchedule: paymentSchedule === 'custom' ? customSchedule : '',
          notes: additionalNotes,
          updatedAt: new Date()
        }
      );

      handleClose();
      onSuccess();
    } catch (error: any) {
      console.error('Failed to update creator:', error);
      setError(error.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyTemplate = (example: string) => {
    setPaymentStructure(example);
    setShowTemplates(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-white">Edit Creator</h2>
            <p className="text-sm text-gray-400 mt-1">{creator.displayName || creator.email}</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-700 border-t-white"></div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Payment Status */}
            <div>
              <label className="block text-sm font-medium text-white mb-3">
                Payment Status
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setIsPaid(true)}
                  className={clsx(
                    "p-4 rounded-lg border-2 transition-all",
                    isPaid
                      ? 'bg-white/10 border-white/50'
                      : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/50'
                  )}
                >
                  <DollarSign className={clsx("w-6 h-6 mx-auto mb-2", isPaid ? 'text-white' : 'text-gray-400')} />
                  <div className="text-sm font-medium text-white">Paid Creator</div>
                  <div className="text-xs text-gray-400 mt-1">Receives payments</div>
                </button>

                <button
                  onClick={() => setIsPaid(false)}
                  className={clsx(
                    "p-4 rounded-lg border-2 transition-all",
                    !isPaid
                      ? 'bg-white/10 border-white/50'
                      : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/50'
                  )}
                >
                  <UserIcon className={clsx("w-6 h-6 mx-auto mb-2", !isPaid ? 'text-white' : 'text-gray-400')} />
                  <div className="text-sm font-medium text-white">Unpaid Creator</div>
                  <div className="text-xs text-gray-400 mt-1">No payments</div>
                </button>
              </div>
            </div>

            {isPaid && (
              <>
                {/* Payment Structure - Freeform Text Area */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-white">
                      Payment Structure *
                    </label>
                    <button
                      onClick={() => setShowTemplates(!showTemplates)}
                      className="flex items-center gap-1 text-xs text-white/70 hover:text-white transition-colors"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      {showTemplates ? 'Hide' : 'Show'} Examples
                    </button>
                  </div>

                  {/* Template Examples */}
                  {showTemplates && (
                    <div className="mb-3 bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                      <p className="text-xs font-medium text-white/80 mb-2">Click to use a template:</p>
                      {PAYMENT_TEMPLATES.map((template, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleCopyTemplate(template.example)}
                          className="w-full text-left p-2 rounded bg-gray-700/50 hover:bg-gray-700 transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="text-xs font-medium text-white/90 mb-1">{template.title}</div>
                              <div className="text-xs text-gray-400">{template.example}</div>
                            </div>
                            <Copy className="w-3.5 h-3.5 text-gray-500 group-hover:text-white flex-shrink-0 mt-0.5" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <textarea
                    value={paymentStructure}
                    onChange={(e) => setPaymentStructure(e.target.value)}
                    placeholder="E.g., $500 upfront for 10 videos, then $50 per video + $10 CPM for views over 50k, bonus $1000 when reaching 100k total views"
                    rows={5}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 resize-none text-sm leading-relaxed"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    Describe your complete payment structure in plain English. Be as specific as possible.
                  </p>
                </div>

                {/* Payment Schedule */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Payment Schedule
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['weekly', 'bi-weekly', 'monthly', 'custom'].map((schedule) => (
                      <button
                        key={schedule}
                        onClick={() => setPaymentSchedule(schedule as typeof paymentSchedule)}
                        className={clsx(
                          "px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium capitalize",
                          paymentSchedule === schedule
                            ? 'bg-white/10 border-white text-white'
                            : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:bg-gray-700/50'
                        )}
                      >
                        {schedule === 'bi-weekly' ? 'Bi-Weekly' : schedule}
                      </button>
                    ))}
                  </div>
                  {paymentSchedule === 'custom' && (
                    <input
                      type="text"
                      value={customSchedule}
                      onChange={(e) => setCustomSchedule(e.target.value)}
                      placeholder="E.g., Every 15 days, On the 1st and 15th of each month"
                      className="mt-2 w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                    />
                  )}
                </div>

                {/* Additional Notes */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Any special terms, bonus structures, or other details..."
                    rows={3}
                    className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 resize-none text-sm"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-700">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={saving}
            className="text-gray-400 hover:text-white"
          >
            Cancel
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={saving || loading}
            className="bg-white hover:bg-gray-200 text-black font-semibold"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default EditCreatorModal;

