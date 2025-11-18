import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, Folder, Plus, Pencil } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ProjectService from '../services/ProjectService';
import { Project } from '../types/projects';
import { clsx } from 'clsx';
import EditProjectModal from './EditProjectModal';
import CreateProjectModal from './CreateProjectModal';

interface ProjectSwitcherProps {
  isCollapsed?: boolean;
}

const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({ isCollapsed = false }) => {
  const { currentOrgId, currentProjectId, switchProject } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load projects
  useEffect(() => {
    const loadProjects = async () => {
      if (!currentOrgId) return;
      
      try {
        setLoading(true);
        const projectsList = await ProjectService.getProjects(currentOrgId, false);
        setProjects(projectsList);
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        setLoading(false);
      }
    };

      loadProjects();
  }, [currentOrgId]);

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
        setProjects(projectsList);
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
        setProjects(projectsList);
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
          "h-10 bg-white/5 rounded-lg animate-pulse",
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
          className="w-full flex items-center justify-center p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          title={currentProject.name}
        >
          <Folder className="w-5 h-5 text-white/80" />
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
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
            <Folder className="w-4 h-4 text-white/60 flex-shrink-0" />
          )}
          <span className="text-sm font-medium text-white truncate">
            {currentProject.name}
          </span>
        </div>
          <ChevronDown className={clsx(
          "w-4 h-4 text-white/60 flex-shrink-0 transition-transform",
          { "rotate-180": isOpen }
          )} />
        </button>

      {/* Dropdown */}
        {isOpen && (
        <div className="absolute top-full left-3 right-3 mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
          {/* Project List */}
            {projects.map((project) => (
              <div
                key={project.id}
                className={clsx(
                  "w-full flex items-center justify-between group transition-colors",
                  {
                    "bg-white/10": project.id === currentProjectId,
                    "hover:bg-white/5": project.id !== currentProjectId,
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
                    <Folder className="w-4 h-4 flex-shrink-0 text-white/60" />
                  )}
                  <span className={clsx(
                    "truncate",
                    {
                      "text-white": project.id === currentProjectId,
                      "text-white/70 group-hover:text-white": project.id !== currentProjectId,
                    }
                  )}>
                    {project.name}
                  </span>
                </button>
                <div className="flex items-center gap-1 px-2">
                  {project.id === currentProjectId && (
                    <Check className="w-4 h-4 flex-shrink-0 text-green-500" />
                  )}
                  <button
                    onClick={(e) => handleEditProject(project, e)}
                    className="p-1.5 rounded hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                    title="Edit project"
                  >
                    <Pencil className="w-3.5 h-3.5 text-white/60 hover:text-white" />
                  </button>
                </div>
              </div>
            ))}

          {/* Divider */}
          {projects.length > 0 && (
            <div className="border-t border-white/10 my-1" />
          )}
          
          {/* Create New Project Button */}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setShowCreateModal(true);
                  }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-blue-400 hover:bg-white/5 transition-colors"
                >
            <Plus className="w-4 h-4 flex-shrink-0" />
            <span>Create New Project</span>
                </button>
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
