import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { OrgMember } from '../types/firestore';
import CreatorLinksService from '../services/CreatorLinksService';
import { X, Save, DollarSign, User as UserIcon, Calculator } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import PaymentRuleBuilder from './PaymentRuleBuilder';
import { PaymentRule } from '../services/PaymentCalculationService';
import clsx from 'clsx';

interface EditCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  creator: OrgMember;
}

const EditCreatorModal: React.FC<EditCreatorModalProps> = ({ isOpen, onClose, onSuccess, creator }) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [isPaid, setIsPaid] = useState(true);
  const [paymentRules, setPaymentRules] = useState<PaymentRule[]>([]);

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
        setPaymentRules((profile.paymentInfo.paymentRules as PaymentRule[]) || []);
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
          paymentRules: paymentRules as any,
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
                {/* Payment Rules Builder */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-white">
                      Payment Rules
                    </label>
                    <div className="flex items-center gap-1.5 text-xs text-white/60">
                      <Calculator className="w-3.5 h-3.5" />
                      <span>Auto-calculates earnings</span>
                    </div>
                  </div>
                  
                  <PaymentRuleBuilder 
                    rules={paymentRules}
                    onChange={setPaymentRules}
                  />
                  
                  <p className="text-xs text-gray-400 mt-2">
                    Build payment rules that automatically calculate creator earnings based on video performance.
                  </p>
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

