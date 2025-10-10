import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Building2, Check, Crown, Shield, User, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import OrganizationService from '../services/OrganizationService';
import { Organization, Role } from '../types/firestore';
import { clsx } from 'clsx';

const OrganizationSwitcher: React.FC = () => {
  const { user, currentOrgId, switchOrganization } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [userRoles, setUserRoles] = useState<Map<string, Role>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadOrganizations();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadOrganizations = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const orgsData = await OrganizationService.getUserOrganizations(user.uid);
      setOrganizations(orgsData);

      // Load roles for each organization
      const roles = new Map<string, Role>();
      for (const org of orgsData) {
        const role = await OrganizationService.getUserRole(org.id, user.uid);
        if (role) {
          roles.set(org.id, role);
        }
      }
      setUserRoles(roles);
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOrgSelect = async (orgId: string) => {
    if (!user) return;
    
    try {
      console.log('🔄 Switching to organization:', orgId);
      // Save to Firestore as default org
      await OrganizationService.setDefaultOrg(user.uid, orgId);
      
      // Update local state
      switchOrganization(orgId);
      setIsOpen(false);
      
      // Reload the page to refresh all data for the new organization
      window.location.reload();
    } catch (error) {
      console.error('Failed to switch organization:', error);
      alert('Failed to switch organization. Please try again.');
    }
  };

  const getRoleIcon = (role: Role | undefined) => {
    if (!role) return null;
    switch (role) {
      case 'owner':
        return <Crown className="w-3 h-3 text-yellow-400" />;
      case 'admin':
        return <Shield className="w-3 h-3 text-white/90" />;
      case 'member':
        return <User className="w-3 h-3 text-white/50" />;
    }
  };

  const currentOrg = organizations.find(o => o.id === currentOrgId);

  if (loading || !currentOrg) {
    return (
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg animate-pulse">
          <div className="w-32 h-4 bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Organization Button at Bottom */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            'w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all',
            'hover:bg-white/5 bg-white/5 border border-white/10 hover:border-white/20 backdrop-blur-sm'
          )}
        >
          <span className="text-sm font-medium text-white/90 truncate">
            {currentOrg.name}
          </span>
          <ChevronDown className="w-4 h-4 text-white/50 flex-shrink-0" />
        </button>
      </div>

      {/* Modal for Switching Organizations */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="bg-gradient-to-br from-[#121212] to-[#151515] rounded-xl shadow-2xl border border-white/10 w-full max-w-md backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 bg-white/5">
              <h3 className="text-lg font-semibold text-white/90">
                Switch Organization
              </h3>
              <p className="text-sm text-white/60 mt-1">
                {organizations.length} organization{organizations.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Organization List */}
            <div className="max-h-96 overflow-y-auto p-2">
              {organizations.map((org) => {
                const role = userRoles.get(org.id);
                return (
                  <button
                    key={org.id}
                    onClick={() => handleOrgSelect(org.id)}
                    className={clsx(
                      'w-full px-4 py-3 flex items-start space-x-3 rounded-lg transition-colors text-left mb-1',
                      org.id === currentOrgId
                        ? 'bg-white/10'
                        : 'hover:bg-white/5'
                    )}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {org.logoUrl ? (
                        <img
                          src={org.logoUrl}
                          alt={org.name}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/10">
                          <Building2 className="w-6 h-6 text-white/70" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-medium text-white/90 truncate">
                          {org.name}
                        </h4>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {getRoleIcon(role)}
                          {org.id === currentOrgId && (
                            <Check className="w-4 h-4 text-white/90" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-white/50">
                          {role && (
                            <span className="capitalize">{role}</span>
                          )}
                        </p>
                        <p className="text-xs text-white/40">
                          {org.memberCount} {org.memberCount === 1 ? 'member' : 'members'}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Create New Organization Button */}
            <div className="px-4 py-3 border-t border-white/10 bg-white/5">
              <button
                onClick={() => {
                  setIsOpen(false);
                  window.location.href = '/create-organization';
                }}
                className="w-full px-4 py-2.5 bg-white/90 hover:bg-white text-gray-900 rounded-lg transition-all flex items-center justify-center gap-2 font-medium"
              >
                <Plus className="w-4 h-4" />
                Create New Organization
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OrganizationSwitcher;

