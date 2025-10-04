import React, { useState } from 'react';
import { X, Shield, Eye, Edit, Trash2, Plus, RotateCcw, Copy } from 'lucide-react';
import { OrgMember } from '../types/firestore';
import { TeamMemberPermissions, DEFAULT_PERMISSIONS, PERMISSION_PRESETS } from '../types/permissions';
import PermissionsService from '../services/PermissionsService';
import { Button } from './ui/Button';

interface EditMemberPermissionsModalProps {
  member: OrgMember;
  onClose: () => void;
  onSave: (permissions: TeamMemberPermissions) => Promise<void>;
  onResetToDefault: () => Promise<void>;
}

const EditMemberPermissionsModal: React.FC<EditMemberPermissionsModalProps> = ({
  member,
  onClose,
  onSave,
  onResetToDefault,
}) => {
  const [permissions, setPermissions] = useState<TeamMemberPermissions>(() =>
    PermissionsService.getPermissions(member)
  );
  const [saving, setSaving] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  const hasCustomPermissions = !!member.permissions;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(permissions);
      onClose();
    } catch (error) {
      console.error('Failed to save permissions:', error);
      alert('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!window.confirm('Reset to default permissions for their role? This will remove all custom permissions.')) {
      return;
    }

    setSaving(true);
    try {
      await onResetToDefault();
      setPermissions(DEFAULT_PERMISSIONS[member.role]);
      onClose();
    } catch (error) {
      console.error('Failed to reset permissions:', error);
      alert('Failed to reset permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPreset = (presetPermissions: TeamMemberPermissions) => {
    setPermissions(presetPermissions);
    setShowPresets(false);
  };

  const togglePermission = (
    category: keyof TeamMemberPermissions,
    key: string
  ) => {
    setPermissions(prev => ({
      ...prev,
      [category]: {
        ...(prev[category] as any),
        [key]: !(prev[category] as any)[key],
      },
    }));
  };

  const PermissionToggle: React.FC<{
    label: string;
    checked: boolean;
    onChange: () => void;
    icon?: React.ReactNode;
  }> = ({ label, checked, onChange, icon }) => (
    <label className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/30 rounded-lg cursor-pointer transition-colors group">
      <div className="flex items-center gap-3">
        {icon && <span className="text-gray-400 group-hover:text-gray-300">{icon}</span>}
        <span className="text-sm text-gray-300 group-hover:text-white">{label}</span>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onChange();
        }}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
          checked ? 'bg-purple-600' : 'bg-gray-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );

  const PermissionSection: React.FC<{
    title: string;
    description: string;
    icon: React.ReactNode;
    children: React.ReactNode;
  }> = ({ title, description, icon, children }) => (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-700 bg-gray-800/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-900/30 flex items-center justify-center text-purple-400">
            {icon}
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{description}</p>
          </div>
        </div>
      </div>
      <div className="p-3 space-y-1">{children}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-800 flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800 bg-gradient-to-r from-purple-900/20 to-pink-900/20">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Edit Permissions</h2>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-sm text-gray-300">
                  {member.displayName || member.email}
                </p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-900/30 text-purple-300 border border-purple-500/30">
                  <Shield className="w-3 h-3" />
                  {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                </span>
                {hasCustomPermissions && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-900/30 text-blue-300 border border-blue-500/30">
                    <Edit className="w-3 h-3" />
                    Custom
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPresets(!showPresets)}
              className="flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Apply Preset
            </Button>
            {hasCustomPermissions && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetToDefault}
                className="flex items-center gap-2 text-gray-400 hover:text-white"
              >
                <RotateCcw className="w-4 h-4" />
                Reset to Default
              </Button>
            )}
          </div>

          {/* Presets Dropdown */}
          {showPresets && (
            <div className="mt-3 p-3 bg-gray-800/80 rounded-lg border border-gray-700 space-y-2">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">
                Quick Presets
              </p>
              {PERMISSION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset.permissions)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-700/50 transition-colors"
                >
                  <div className="font-medium text-sm text-white">{preset.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{preset.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Analytics Permissions */}
          <PermissionSection
            title="Analytics Access"
            description="Control which analytics metrics this member can view"
            icon={<Eye className="w-5 h-5" />}
          >
            <PermissionToggle
              label="Views"
              checked={permissions.analytics.views}
              onChange={() => togglePermission('analytics', 'views')}
              icon={<Eye className="w-4 h-4" />}
            />
            <PermissionToggle
              label="Likes"
              checked={permissions.analytics.likes}
              onChange={() => togglePermission('analytics', 'likes')}
            />
            <PermissionToggle
              label="Comments"
              checked={permissions.analytics.comments}
              onChange={() => togglePermission('analytics', 'comments')}
            />
            <PermissionToggle
              label="Shares"
              checked={permissions.analytics.shares}
              onChange={() => togglePermission('analytics', 'shares')}
            />
            <PermissionToggle
              label="Engagement Rate"
              checked={permissions.analytics.engagement}
              onChange={() => togglePermission('analytics', 'engagement')}
            />
            <PermissionToggle
              label="Link Clicks"
              checked={permissions.analytics.linkClicks}
              onChange={() => togglePermission('analytics', 'linkClicks')}
            />
            <PermissionToggle
              label="Revenue 💰"
              checked={permissions.analytics.revenue}
              onChange={() => togglePermission('analytics', 'revenue')}
            />
          </PermissionSection>

          {/* Tab Visibility */}
          <PermissionSection
            title="Tab Access"
            description="Control which tabs are visible in the sidebar"
            icon={<Shield className="w-5 h-5" />}
          >
            <PermissionToggle
              label="Dashboard"
              checked={permissions.tabs.dashboard}
              onChange={() => togglePermission('tabs', 'dashboard')}
            />
            <PermissionToggle
              label="Tracked Accounts"
              checked={permissions.tabs.trackedAccounts}
              onChange={() => togglePermission('tabs', 'trackedAccounts')}
            />
            <PermissionToggle
              label="Tracked Links"
              checked={permissions.tabs.trackedLinks}
              onChange={() => togglePermission('tabs', 'trackedLinks')}
            />
            <PermissionToggle
              label="Rules"
              checked={permissions.tabs.rules}
              onChange={() => togglePermission('tabs', 'rules')}
            />
            <PermissionToggle
              label="Contracts"
              checked={permissions.tabs.contracts}
              onChange={() => togglePermission('tabs', 'contracts')}
            />
            <PermissionToggle
              label="Team"
              checked={permissions.tabs.team}
              onChange={() => togglePermission('tabs', 'team')}
            />
            <PermissionToggle
              label="Creators"
              checked={permissions.tabs.creators}
              onChange={() => togglePermission('tabs', 'creators')}
            />
            <PermissionToggle
              label="Settings"
              checked={permissions.tabs.settings}
              onChange={() => togglePermission('tabs', 'settings')}
            />
          </PermissionSection>

          {/* Project Permissions */}
          <PermissionSection
            title="Project Management"
            description="Control project creation and management"
            icon={<Edit className="w-5 h-5" />}
          >
            <PermissionToggle
              label="View Projects"
              checked={permissions.projects.view}
              onChange={() => togglePermission('projects', 'view')}
              icon={<Eye className="w-4 h-4" />}
            />
            <PermissionToggle
              label="Create Projects"
              checked={permissions.projects.create}
              onChange={() => togglePermission('projects', 'create')}
              icon={<Plus className="w-4 h-4" />}
            />
            <PermissionToggle
              label="Edit Projects"
              checked={permissions.projects.edit}
              onChange={() => togglePermission('projects', 'edit')}
              icon={<Edit className="w-4 h-4" />}
            />
            <PermissionToggle
              label="Delete Projects"
              checked={permissions.projects.delete}
              onChange={() => togglePermission('projects', 'delete')}
              icon={<Trash2 className="w-4 h-4" />}
            />
          </PermissionSection>

          {/* Account Permissions */}
          <PermissionSection
            title="Tracked Accounts"
            description="Control account tracking and management"
            icon={<Shield className="w-5 h-5" />}
          >
            <PermissionToggle
              label="View Accounts"
              checked={permissions.accounts.view}
              onChange={() => togglePermission('accounts', 'view')}
              icon={<Eye className="w-4 h-4" />}
            />
            <PermissionToggle
              label="Add Accounts"
              checked={permissions.accounts.add}
              onChange={() => togglePermission('accounts', 'add')}
              icon={<Plus className="w-4 h-4" />}
            />
            <PermissionToggle
              label="Edit Accounts"
              checked={permissions.accounts.edit}
              onChange={() => togglePermission('accounts', 'edit')}
              icon={<Edit className="w-4 h-4" />}
            />
            <PermissionToggle
              label="Delete Accounts"
              checked={permissions.accounts.delete}
              onChange={() => togglePermission('accounts', 'delete')}
              icon={<Trash2 className="w-4 h-4" />}
            />
            <PermissionToggle
              label="Sync Accounts"
              checked={permissions.accounts.sync}
              onChange={() => togglePermission('accounts', 'sync')}
            />
          </PermissionSection>

          {/* Team Permissions */}
          <PermissionSection
            title="Team Management"
            description="Control team member management"
            icon={<Shield className="w-5 h-5" />}
          >
            <PermissionToggle
              label="View Team"
              checked={permissions.team.view}
              onChange={() => togglePermission('team', 'view')}
              icon={<Eye className="w-4 h-4" />}
            />
            <PermissionToggle
              label="Invite Members"
              checked={permissions.team.invite}
              onChange={() => togglePermission('team', 'invite')}
              icon={<Plus className="w-4 h-4" />}
            />
            <PermissionToggle
              label="Edit Roles"
              checked={permissions.team.editRoles}
              onChange={() => togglePermission('team', 'editRoles')}
              icon={<Edit className="w-4 h-4" />}
            />
            <PermissionToggle
              label="Edit Permissions"
              checked={permissions.team.editPermissions}
              onChange={() => togglePermission('team', 'editPermissions')}
              icon={<Shield className="w-4 h-4" />}
            />
            <PermissionToggle
              label="Remove Members"
              checked={permissions.team.remove}
              onChange={() => togglePermission('team', 'remove')}
              icon={<Trash2 className="w-4 h-4" />}
            />
          </PermissionSection>

          {/* Contracts Permissions */}
          <PermissionSection
            title="Contracts"
            description="Control contract access and management"
            icon={<Shield className="w-5 h-5" />}
          >
            <PermissionToggle
              label="View Contracts"
              checked={permissions.contracts.view}
              onChange={() => togglePermission('contracts', 'view')}
              icon={<Eye className="w-4 h-4" />}
            />
            <PermissionToggle
              label="Create Contracts"
              checked={permissions.contracts.create}
              onChange={() => togglePermission('contracts', 'create')}
              icon={<Plus className="w-4 h-4" />}
            />
            <PermissionToggle
              label="Edit Contracts"
              checked={permissions.contracts.edit}
              onChange={() => togglePermission('contracts', 'edit')}
              icon={<Edit className="w-4 h-4" />}
            />
            <PermissionToggle
              label="Delete Contracts"
              checked={permissions.contracts.delete}
              onChange={() => togglePermission('contracts', 'delete')}
              icon={<Trash2 className="w-4 h-4" />}
            />
          </PermissionSection>

          {/* Rules Permissions */}
          <PermissionSection
            title="Rules & Automation"
            description="Control automation rules access"
            icon={<Shield className="w-5 h-5" />}
          >
            <PermissionToggle
              label="View Rules"
              checked={permissions.rules.view}
              onChange={() => togglePermission('rules', 'view')}
              icon={<Eye className="w-4 h-4" />}
            />
            <PermissionToggle
              label="Create Rules"
              checked={permissions.rules.create}
              onChange={() => togglePermission('rules', 'create')}
              icon={<Plus className="w-4 h-4" />}
            />
            <PermissionToggle
              label="Edit Rules"
              checked={permissions.rules.edit}
              onChange={() => togglePermission('rules', 'edit')}
              icon={<Edit className="w-4 h-4" />}
            />
            <PermissionToggle
              label="Delete Rules"
              checked={permissions.rules.delete}
              onChange={() => togglePermission('rules', 'delete')}
              icon={<Trash2 className="w-4 h-4" />}
            />
          </PermissionSection>

          {/* Links Permissions */}
          <PermissionSection
            title="Tracked Links"
            description="Control link tracking and management"
            icon={<Shield className="w-5 h-5" />}
          >
            <PermissionToggle
              label="View Links"
              checked={permissions.links.view}
              onChange={() => togglePermission('links', 'view')}
              icon={<Eye className="w-4 h-4" />}
            />
            <PermissionToggle
              label="Create Links"
              checked={permissions.links.create}
              onChange={() => togglePermission('links', 'create')}
              icon={<Plus className="w-4 h-4" />}
            />
            <PermissionToggle
              label="Edit Links"
              checked={permissions.links.edit}
              onChange={() => togglePermission('links', 'edit')}
              icon={<Edit className="w-4 h-4" />}
            />
            <PermissionToggle
              label="Delete Links"
              checked={permissions.links.delete}
              onChange={() => togglePermission('links', 'delete')}
              icon={<Trash2 className="w-4 h-4" />}
            />
          </PermissionSection>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 bg-gray-900 flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Changes will take effect immediately after saving
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Permissions'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditMemberPermissionsModal;

