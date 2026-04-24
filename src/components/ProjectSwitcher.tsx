import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, Check, Folder, Plus, Pencil } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import ProjectService from '../services/ProjectService';
import { Project } from '../types/projects';
import { clsx } from 'clsx';
import EditProjectModal from './EditProjectModal';
import CreateProjectModal from './CreateProjectModal';

interface ProjectSwitcherProps {
  isCollapsed?: boolean;
}

const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({ isCollapsed = false }) => {
  const { currentOrgId, currentProjectId, switchProject, userRole, user } = useAuth();
  const { member } = usePermissions();
  const [rawProjects, setRawProjects] = useState<Project[]>([]);
  const projects = useMemo(
    () => ProjectService.filterByAssignedProjects(rawProjects, member),
    [rawProjects, member]
  );
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load projects (filtered for creators)
  useEffect(() => {
    const loadProjects = async () => {
      if (!currentOrgId) return;
      
      try {
        setLoading(true);
        
        // Creators only see their assigned projects
        if (userRole === 'creator' && user?.uid) {
          const creatorProjects = await ProjectService.getProjectsForCreator(currentOrgId, user.uid);
          setRawProjects(creatorProjects);
        } else {
          // Admins see everything; restricted members are filtered via filterByAssignedProjects (useMemo)
          const projectsList = await ProjectService.getProjects(currentOrgId, false);
          setRawProjects(projectsList);
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        setLoading(false);
      }
    };

      loadProjects();
  }, [currentOrgId, userRole, user?.uid]);

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

  const currentProject = projects.find(p => p.id === currentProjectId);

  const handleProjectSelect = async (projectId: string) => {
    try {
      await switchProject(projectId);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to switch project:', error);
    }
  };

  const handleEditProject = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dropdown from closing
    setEditingProject(project);
    setIsOpen(false);
  };

  const handleEditSuccess = async () => {
    // Reload projects after successful edit
    if (currentOrgId) {
      try {
        const projectsList = await ProjectService.getProjects(currentOrgId, false);
        setRawProjects(projectsList);
      } catch (error) {
        console.error('Failed to reload projects:', error);
      }
    }
    setEditingProject(null);
  };

  const handleCreateSuccess = async () => {
    // Reload projects after successful creation
    if (currentOrgId) {
      try {
        const projectsList = await ProjectService.getProjects(currentOrgId, false);
        setRawProjects(projectsList);
      } catch (error) {
        console.error('Failed to reload projects:', error);
      }
    }
    setShowCreateModal(false);
  };

  if (loading || !currentProject) {
    return (
      <div className="px-3 py-2">
        <div className={clsx(
          "h-10 bg-surface-hover rounded-lg animate-pulse",
          { "w-10": isCollapsed, "w-full": !isCollapsed }
        )} />
      </div>
    );
  }

  if (isCollapsed) {
    return (
      <div className="px-3 py-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-center p-2 rounded-lg bg-surface-hover hover:bg-surface-active transition-colors"
          title={currentProject.name}
        >
          <Folder className="w-5 h-5 text-content-secondary" />
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-hover hover:bg-surface-active transition-colors group"
      >
        <div className="flex items-center gap-2 min-w-0">
          {currentProject.imageUrl ? (
            <img 
              src={currentProject.imageUrl} 
              alt={currentProject.name}
              className="w-4 h-4 rounded object-cover flex-shrink-0"
            />
          ) : currentProject.icon ? (
            <span className="text-sm flex-shrink-0">{currentProject.icon}</span>
          ) : (
            <Folder className="w-4 h-4 text-content-tertiary flex-shrink-0" />
          )}
          <span className="text-sm font-medium text-content truncate">
            {currentProject.name}
          </span>
        </div>
          <ChevronDown className={clsx(
          "w-4 h-4 text-content-tertiary flex-shrink-0 transition-transform",
          { "rotate-180": isOpen }
          )} />
        </button>

      {/* Dropdown */}
        {isOpen && (
        <div className="absolute top-full left-3 right-3 mt-1 bg-surface-secondary border border-border rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
          {/* Project List */}
            {projects.map((project) => (
              <div
                key={project.id}
                className={clsx(
                  "w-full flex items-center justify-between group transition-colors",
                  {
                    "bg-surface-active": project.id === currentProjectId,
                    "hover:bg-surface-hover": project.id !== currentProjectId,
                  }
                )}
              >
                <button
                  onClick={() => handleProjectSelect(project.id)}
                  className="flex-1 flex items-center gap-2 px-3 py-2.5 text-sm text-left min-w-0"
                >
                  {project.imageUrl ? (
                    <img 
                      src={project.imageUrl} 
                      alt={project.name}
                      className="w-4 h-4 rounded object-cover flex-shrink-0"
                    />
                  ) : project.icon ? (
                    <span className="text-sm flex-shrink-0">{project.icon}</span>
                  ) : (
                    <Folder className="w-4 h-4 flex-shrink-0 text-content-tertiary" />
                  )}
                  <span className={clsx(
                    "truncate",
                    {
                      "text-content": project.id === currentProjectId,
                      "text-content-secondary group-hover:text-content": project.id !== currentProjectId,
                    }
                  )}>
                    {project.name}
                  </span>
                </button>
                <div className="flex items-center gap-1 px-2">
                  {project.id === currentProjectId && (
                    <Check className="w-4 h-4 flex-shrink-0 text-green-500" />
                  )}
                  {/* Hide edit button for creators */}
                  {userRole !== 'creator' && (
                    <button
                      onClick={(e) => handleEditProject(project, e)}
                      className="p-1.5 rounded hover:bg-surface-active transition-colors opacity-0 group-hover:opacity-100"
                      title="Edit project"
                    >
                      <Pencil className="w-3.5 h-3.5 text-content-tertiary hover:text-content" />
                    </button>
                  )}
                </div>
              </div>
            ))}

          {/* Divider & Create New Project Button - Hidden for creators */}
          {userRole !== 'creator' && (
            <>
              {projects.length > 0 && (
                <div className="border-t border-border my-1" />
              )}
              
              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowCreateModal(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-blue-400 hover:bg-surface-hover transition-colors"
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span>Create New Project</span>
              </button>
            </>
          )}
          </div>
        )}

      {/* Edit Project Modal */}
        {editingProject && (
          <EditProjectModal
          isOpen={true}
          onClose={() => setEditingProject(null)}
            project={editingProject}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
};

export default ProjectSwitcher;
