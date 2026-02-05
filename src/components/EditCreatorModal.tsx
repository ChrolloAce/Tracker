import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { OrgMember } from '../types/firestore';
import CreatorLinksService from '../services/CreatorLinksService';
import ProjectService from '../services/ProjectService';
import { Project } from '../types/projects';
import { X, Save, DollarSign, User as UserIcon, Calculator, Folder, Check } from 'lucide-react';
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
  
  // Project assignment state
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [assignedProjectIds, setAssignedProjectIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadCreatorData();
    }
  }, [isOpen, creator.userId, currentOrgId, currentProjectId]);

  const loadCreatorData = async () => {
    if (!currentOrgId || !currentProjectId) return;

    try {
      setLoading(true);
      
      // Load creator profile
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
      
      // Load all projects for assignment
      const projects = await ProjectService.getProjects(currentOrgId, false);
      setAllProjects(projects);
      
      // Load creator's assigned projects
      const creatorProjectIds = await ProjectService.getCreatorProjectIds(currentOrgId, creator.userId);
      setAssignedProjectIds(creatorProjectIds);
    } catch (error) {
      console.error('Failed to load creator data:', error);
      setError('Failed to load creator information');
    } finally {
      setLoading(false);
    }
  };
  
  const toggleProjectAssignment = (projectId: string) => {
    setAssignedProjectIds(prev => 
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
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
    
    // Ensure at least one project is assigned
    if (assignedProjectIds.length === 0) {
      setError('Please assign at least one project to this creator');
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
      
      // Save project assignments
      await ProjectService.assignCreatorToProjects(
        currentOrgId,
        creator.userId,
        assignedProjectIds
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
            {/* Project Assignment */}
            <div>
              <label className="block text-sm font-medium text-white mb-3">
                Assigned Projects
              </label>
              <p className="text-xs text-gray-400 mb-3">
                Select which projects this creator can access
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto bg-gray-800/50 rounded-lg p-3">
                {allProjects.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No projects available</p>
                ) : (
                  allProjects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => toggleProjectAssignment(project.id)}
                      className={clsx(
                        "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                        assignedProjectIds.includes(project.id)
                          ? 'bg-white/10 border-white/30'
                          : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/50'
                      )}
                    >
                      <div className={clsx(
                        "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                        assignedProjectIds.includes(project.id)
                          ? 'bg-white border-white'
                          : 'border-gray-500'
                      )}>
                        {assignedProjectIds.includes(project.id) && (
                          <Check className="w-3 h-3 text-black" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {project.imageUrl ? (
                          <img src={project.imageUrl} alt="" className="w-5 h-5 rounded object-cover" />
                        ) : project.icon ? (
                          <span className="text-sm">{project.icon}</span>
                        ) : (
                          <Folder className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-sm text-white truncate">{project.name}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
              {assignedProjectIds.length === 0 && (
                <p className="text-xs text-amber-400 mt-2">⚠️ Creator won't see any projects until assigned</p>
              )}
            </div>
            
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

