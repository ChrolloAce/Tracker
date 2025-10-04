import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Building2, Check, Crown, Shield, User } from 'lucide-react';
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
        return <Crown className="w-3 h-3 text-yellow-500" />;
      case 'admin':
        return <Shield className="w-3 h-3 text-blue-500" />;
      case 'member':
        return <User className="w-3 h-3 text-gray-500" />;
    }
  };

  const currentOrg = organizations.find(o => o.id === currentOrgId);

  if (loading || !currentOrg) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-800 rounded-lg animate-pulse">
        <Building2 className="w-4 h-4 text-gray-400" />
        <div className="w-32 h-4 bg-gray-700 rounded" />
      </div>
    );
  }

  // If user only has one organization, show it without dropdown
  if (organizations.length === 1) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700">
        {currentOrg.logoUrl ? (
          <img
            src={currentOrg.logoUrl}
            alt={currentOrg.name}
            className="w-5 h-5 rounded object-cover"
          />
        ) : (
          <Building2 className="w-5 h-5 text-gray-400" />
        )}
        <span className="text-sm font-medium text-white truncate">
          {currentOrg.name}
        </span>
      </div>
    );
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'w-full flex items-center justify-between space-x-2 px-3 py-2 rounded-lg transition-colors',
          'hover:bg-gray-800',
          'border border-gray-700',
          isOpen && 'bg-gray-800'
        )}
      >
        <div className="flex items-center space-x-2 min-w-0">
          {currentOrg.logoUrl ? (
            <img
              src={currentOrg.logoUrl}
              alt={currentOrg.name}
              className="w-5 h-5 rounded object-cover flex-shrink-0"
            />
          ) : (
            <Building2 className="w-5 h-5 text-gray-400 flex-shrink-0" />
          )}
          <span className="text-sm font-medium text-white truncate">
            {currentOrg.name}
          </span>
        </div>
        <ChevronDown className={clsx(
          'w-4 h-4 text-gray-500 transition-transform flex-shrink-0',
          isOpen && 'rotate-180'
        )} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 w-full bg-gray-900 rounded-xl shadow-xl border border-gray-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">
              Switch Organization
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {organizations.length} organization{organizations.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Organization List */}
          <div className="max-h-80 overflow-y-auto">
            {organizations.map((org) => {
              const role = userRoles.get(org.id);
              return (
                <button
                  key={org.id}
                  onClick={() => handleOrgSelect(org.id)}
                  className={clsx(
                    'w-full px-4 py-3 flex items-start space-x-3 transition-colors text-left',
                    org.id === currentOrgId
                      ? 'bg-purple-900/20'
                      : 'hover:bg-gray-800'
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {org.logoUrl ? (
                      <img
                        src={org.logoUrl}
                        alt={org.name}
                        className="w-8 h-8 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-medium text-white truncate">
                        {org.name}
                      </h4>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {getRoleIcon(role)}
                        {org.id === currentOrgId && (
                          <Check className="w-4 h-4 text-purple-400" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs text-gray-400">
                        {role && (
                          <span className="capitalize">{role}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {org.memberCount} {org.memberCount === 1 ? 'member' : 'members'}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationSwitcher;

