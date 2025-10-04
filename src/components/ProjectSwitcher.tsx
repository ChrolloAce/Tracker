import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, FolderOpen, Plus, Check, Edit3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ProjectService from '../services/ProjectService';
import CreatorLinksService from '../services/CreatorLinksService';
import { ProjectWithStats } from '../types/projects';
import { clsx } from 'clsx';
import EditProjectModal from './EditProjectModal';

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

  useEffect(() => {
    loadProjects();
  }, [currentOrgId, userRole, user]);

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
      setLoading(true);
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
          'w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors',
          'hover:bg-gray-100 dark:hover:bg-gray-800',
          'border border-gray-200 dark:border-gray-700',
          isOpen && 'bg-gray-100 dark:bg-gray-800'
        )}
      >
        {currentProject.imageUrl ? (
          <img
            src={currentProject.imageUrl}
            alt={currentProject.name}
            className="w-6 h-6 rounded object-contain bg-gray-100 dark:bg-gray-800"
          />
        ) : (
          <span className="text-base">{currentProject.icon || '📁'}</span>
        )}
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {currentProject.name}
        </span>
        <ChevronDown className={clsx(
          'w-4 h-4 text-gray-500 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 w-full bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Switch Project
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </p>
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
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                )}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {project.imageUrl ? (
                    <img
                      src={project.imageUrl}
                      alt={project.name}
                      className="w-8 h-8 rounded-lg object-contain bg-gray-100 dark:bg-gray-800"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-200 dark:bg-gray-700"
                    >
                      <span className="text-lg">{project.icon || '📁'}</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {project.name}
                    </h4>
                    <div className="flex items-center gap-1">
                      {project.id === currentProjectId && (
                        <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProject(project);
                          setIsOpen(false);
                        }}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Edit project"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400" />
                      </button>
                    </div>
                  </div>
                  {project.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {project.description}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Create New Project Button */}
          {onCreateProject && (
            <div className="border-t border-gray-200 dark:border-gray-800 p-2">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onCreateProject();
                }}
                className="w-full px-3 py-2 flex items-center space-x-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
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

