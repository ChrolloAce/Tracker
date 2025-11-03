import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, FolderOpen, Plus, Check, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ProjectService from '../services/ProjectService';
import CreatorLinksService from '../services/CreatorLinksService';
import { ProjectWithStats } from '../types/projects';
import { clsx } from 'clsx';
import EditProjectModal from './EditProjectModal';
import { useDemoContext } from '../pages/DemoPage';

interface ProjectSwitcherProps {
  onCreateProject?: () => void;
}

const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({ onCreateProject }) => {
  const { currentOrgId, currentProjectId, switchProject, user, userRole } = useAuth();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithStats | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef<string | null>(null); // Track which org we've loaded
  
  // Check if in demo mode
  let demoContext;
  try {
    demoContext = useDemoContext();
  } catch {
    demoContext = { isDemoMode: false, demoOrgId: '', demoProjectId: '' };
  }
  const isDemoMode = demoContext.isDemoMode;

  // ONLY load projects once per org, not on every render!
  useEffect(() => {
    console.log('🔍 ProjectSwitcher useEffect:', { 
      currentOrgId, 
      hasLoaded: hasLoadedRef.current, 
      projectsLength: projects.length,
      willLoad: hasLoadedRef.current !== currentOrgId && !!currentOrgId
    });
    
    if (hasLoadedRef.current === currentOrgId) {
      console.log('✅ Projects already loaded for this org, skipping');
      return; // Already loaded for this org
    }
    
    if (currentOrgId) {
      console.log('🔄 Loading projects for org:', currentOrgId);
      loadProjects();
      hasLoadedRef.current = currentOrgId;
    }
  }, [currentOrgId]); // Only when org changes!

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadProjects = async () => {
    if (!currentOrgId || !user) return;

    try {
      // Only show loading on true initial load
      if (projects.length === 0) {
        setLoading(true);
      }
      
      const projectsData = await ProjectService.getProjectsWithStats(currentOrgId, false);
      
      // If user is a creator, filter to only projects they're assigned to
      if (userRole === 'creator') {
        const creatorProjectIds = await CreatorLinksService.getCreatorProjects(currentOrgId, user.uid);
        const filteredProjects = projectsData.filter(p => creatorProjectIds.includes(p.id));
        setProjects(filteredProjects);
      } else {
        setProjects(projectsData);
      }
      
      // Only set loading to false after we have data
      if (loading) {
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      setLoading(false);
    }
  };

  const handleProjectSelect = async (projectId: string) => {
    try {
      await switchProject(projectId);
      setIsOpen(false);
      // Reload the page to refresh all data
      window.location.reload();
    } catch (error) {
      console.error('Failed to switch project:', error);
      alert('Failed to switch project. Please try again.');
    }
  };

  // Always prefer to show current project if we have it, even during background refresh
  const currentProject = projects.find(p => p.id === currentProjectId);

  // Demo mode - show locked demo project
  if (isDemoMode) {
    return (
      <div className="relative w-full">
        <div className={clsx(
          'w-full flex items-center space-x-2 px-3 py-2 rounded-lg',
          'bg-white/5 border border-white/10 cursor-not-allowed opacity-75'
        )}>
          <FolderOpen className="w-4 h-4 text-white/50" />
          <span className="text-sm font-medium text-white/70">
            Demo Project
          </span>
          <Lock className="w-3 h-3 text-white/40 ml-auto" />
        </div>
      </div>
    );
  }

  // If we have a current project, ALWAYS show it (never show loading skeleton)
  if (currentProject) {
    return (
      <div className="relative w-full" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            'w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-all',
            'hover:bg-white/5 bg-white/5 border border-white/10 hover:border-white/20 backdrop-blur-sm',
            isOpen && 'bg-white/10'
          )}
        >
          {currentProject.imageUrl ? (
            <img
              src={currentProject.imageUrl}
              alt={currentProject.name}
              className="w-6 h-6 rounded object-contain bg-white/5"
            />
          ) : (
            <span className="text-base">{currentProject.icon || '📁'}</span>
          )}
          <span className="text-sm font-medium text-white/90">
            {currentProject.name}
          </span>
          <ChevronDown className={clsx(
            'w-4 h-4 text-white/50 transition-transform',
            isOpen && 'rotate-180'
          )} />
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50 max-h-[300px] overflow-y-auto">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleProjectSelect(project.id)}
                className={clsx(
                  'w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left',
                  project.id === currentProjectId && 'bg-gray-100 dark:bg-gray-800'
                )}
              >
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  {project.imageUrl ? (
                    <img
                      src={project.imageUrl}
                      alt={project.name}
                      className="w-6 h-6 rounded object-contain bg-gray-100 dark:bg-gray-800 flex-shrink-0"
                    />
                  ) : (
                    <span className="text-base flex-shrink-0">{project.icon || '📁'}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {project.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {project.stats?.videoCount || 0} videos • {project.stats?.totalClicks || 0} clicks
                    </p>
                  </div>
                </div>
                {project.id === currentProjectId && (
                  <Check className="w-4 h-4 text-blue-500 flex-shrink-0 ml-2" />
                )}
              </button>
            ))}

            {onCreateProject && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onCreateProject();
                  }}
                  className="w-full flex items-center space-x-2 px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-blue-600 dark:text-blue-400"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">Create New Project</span>
                </button>
              </>
            )}
          </div>
        )}

        {editingProject && (
          <EditProjectModal
            project={editingProject}
            isOpen={!!editingProject}
            onClose={() => setEditingProject(null)}
            onSuccess={() => {
              setEditingProject(null);
              loadProjects();
            }}
          />
        )}
      </div>
    );
  }

  // Only show loading skeleton if we truly have no data
  if (loading) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse">
        <FolderOpen className="w-4 h-4 text-gray-400" />
        <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  // No project found and not loading
  return (
    <div className="flex items-center space-x-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
      <FolderOpen className="w-4 h-4 text-white/50" />
      <span className="text-sm font-medium text-white/70">No Project</span>
    </div>
  );
};

export default ProjectSwitcher;
