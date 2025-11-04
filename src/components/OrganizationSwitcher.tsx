import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Building2, Check, Plus, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import OrganizationService from '../services/OrganizationService';
import { Organization, Role } from '../types/firestore';
import { clsx } from 'clsx';
import { useDemoContext } from '../pages/DemoPage';

const OrganizationSwitcher: React.FC = () => {
  const { user, currentOrgId, switchOrganization } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [userRoles, setUserRoles] = useState<Map<string, Role>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false); // Track if we've loaded already
  
  // Check if in demo mode
  let demoContext;
  try {
    demoContext = useDemoContext();
  } catch {
    demoContext = { isDemoMode: false, demoOrgId: '', demoProjectId: '' };
  }
  const isDemoMode = demoContext.isDemoMode;

  // ONLY load organizations once, not on every render!
  useEffect(() => {
    console.log('🔍 OrganizationSwitcher useEffect:', { 
      userId: user?.uid,
      hasLoaded: hasLoadedRef.current, 
      organizationsLength: organizations.length,
      willLoad: !hasLoadedRef.current && !!user
    });
    
    if (hasLoadedRef.current) {
      console.log('✅ Organizations already loaded, skipping');
      return; // Already loaded
    }
    
    if (user) {
      console.log('🔄 Loading organizations for user:', user.uid);
      loadOrganizations();
      hasLoadedRef.current = true;
    }
  }, [user?.uid]); // Only when user ID changes (login/logout)

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
      // Only show loading on true initial load
      if (organizations.length === 0) {
        setLoading(true);
      }
      
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
      
      // Only set loading to false after we have data
      if (loading) {
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
      setLoading(false);
    }
  };

  const handleOrgSelect = async (orgId: string) => {
    if (!user) return;
    
    try {
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Always prefer to show current org if we have it, even during background refresh
  const currentOrg = organizations.find(o => o.id === currentOrgId);

  // Demo mode - show locked demo org
  if (isDemoMode) {
    return (
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className={clsx(
          'flex items-center justify-between px-3 py-2 rounded-lg',
          'bg-white/5 border border-white/10 cursor-not-allowed opacity-75'
        )}>
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-white/50" />
            <span className="text-sm font-medium text-white/70">Demo Organization</span>
          </div>
          <Lock className="w-3 h-3 text-white/40" />
        </div>
      </div>
    );
  }

  // If we have a current org, ALWAYS show it (never show loading skeleton)
  if (currentOrg) {
    return (
      <div className="p-4 border-t border-white/10" ref={dropdownRef}>
        {/* Organization Button */}
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
          <ChevronDown className={clsx(
            "w-4 h-4 text-white/50 flex-shrink-0 transition-transform",
            isOpen && "rotate-180"
          )} />
        </button>

        {/* Dropdown for Switching Organizations */}
        {isOpen && (
          <div className="mt-2 bg-white/5 border border-white/10 rounded-lg overflow-hidden backdrop-blur-sm shadow-xl">
            {/* Organization List - Scrollable */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {organizations.map((org) => {
                const role = userRoles.get(org.id);
                return (
                  <button
                    key={org.id}
                    onClick={() => handleOrgSelect(org.id)}
                    className={clsx(
                      'w-full px-3 py-2.5 flex items-center gap-2.5 rounded-lg transition-colors text-left',
                      org.id === currentOrgId
                        ? 'bg-white/10'
                        : 'hover:bg-white/5'
                    )}
                  >
                    {org.logoUrl ? (
                      <img
                        src={org.logoUrl}
                        alt={org.name}
                        className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10 flex-shrink-0">
                        <Building2 className="w-4 h-4 text-white/70" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white/90 truncate">
                        {org.name}
                      </h4>
                      <p className="text-xs text-white/50">
                        {role && <span className="capitalize">{role}</span>}
                        {role && org.memberCount > 0 && <span> • </span>}
                        {org.memberCount} {org.memberCount === 1 ? 'member' : 'members'}
                      </p>
                    </div>

                    {org.id === currentOrgId && (
                      <Check className="w-4 h-4 text-white/70 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Create New Organization Button */}
            <div className="p-2 border-t border-white/10">
              <button
                onClick={() => {
                  setIsOpen(false);
                  window.location.href = '/create-organization';
                }}
                className="w-full px-3 py-2 bg-white/90 hover:bg-white text-gray-900 rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Create New Organization
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Only show loading skeleton if we truly have no data
  if (loading) {
    return (
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg animate-pulse">
          <div className="w-32 h-4 bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  // No org found and not loading
  return (
    <div className="p-4 border-t border-white/10">
      <div className="flex items-center justify-between px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg">
        <div className="flex items-center space-x-2">
          <Building2 className="w-4 h-4 text-white/50" />
          <span className="text-sm font-medium text-white/70">No Organization</span>
        </div>
      </div>
    </div>
  );
};

export default OrganizationSwitcher;

