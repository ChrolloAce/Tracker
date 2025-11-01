import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, FolderOpen, Plus, Check, Edit3, Lock } from 'lucide-react';
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
    if (hasLoadedRef.current === currentOrgId) {
      return; // Already loaded for this org
    }
    
    if (currentOrgId) {
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
      // Don't show skeleton on reload, keep existing data visible
      const isInitialLoad = projects.length === 0;
      if (isInitialLoad) {
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
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
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

  if (loading || !currentProject) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse">
        <FolderOpen className="w-4 h-4 text-gray-400" />
        <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

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
        <div className="absolute top-full left-0 mt-2 w-80 bg-gradient-to-br from-[#121212] to-[#151515] rounded-xl shadow-2xl border border-white/10 z-50 overflow-hidden backdrop-blur-xl">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10 bg-white/5">
            <h3 className="text-sm font-semibold text-white/90">
              Switch Project
            </h3>
          </div>

          {/* Project List */}
          <div className="max-h-80 overflow-y-auto">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleProjectSelect(project.id)}
                className={clsx(
                  'w-full px-4 py-3 flex items-start space-x-3 transition-colors text-left',
                  project.id === currentProjectId
                    ? 'bg-white/10'
                    : 'hover:bg-white/5'
                )}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {project.imageUrl ? (
                    <img
                      src={project.imageUrl}
                      alt={project.name}
                      className="w-8 h-8 rounded-lg object-contain bg-white/5"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10"
                    >
                      <span className="text-lg">{project.icon || '📁'}</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium text-white/90 truncate">
                      {project.name}
                    </h4>
                    <div className="flex items-center gap-1">
                      {project.id === currentProjectId && (
                        <Check className="w-4 h-4 text-white/90 flex-shrink-0" />
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProject(project);
                          setIsOpen(false);
                        }}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                        title="Edit project"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-white/50 hover:text-white/90" />
                      </button>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Create New Project Button */}
          {onCreateProject && (
            <div className="border-t border-white/10 bg-white/5 p-2">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onCreateProject();
                }}
                className="w-full px-3 py-2 flex items-center space-x-2 text-sm font-medium text-white/90 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Project</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <EditProjectModal
          isOpen={!!editingProject}
          onClose={() => setEditingProject(null)}
          project={editingProject}
          onSuccess={loadProjects}
        />
      )}
    </div>
  );
};

export default ProjectSwitcher;

