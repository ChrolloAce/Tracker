import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, Folder, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ProjectService from '../services/ProjectService';
import { Project } from '../types/projects';
import { clsx } from 'clsx';

interface ProjectSwitcherProps {
  isCollapsed?: boolean;
}

const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({ isCollapsed = false }) => {
  const { currentOrgId, currentProjectId, switchProject } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
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
          <Folder className="w-4 h-4 text-white/60 flex-shrink-0" />
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
            <button
              key={project.id}
              onClick={() => handleProjectSelect(project.id)}
              className={clsx(
                "w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors",
                {
                  "bg-white/10 text-white": project.id === currentProjectId,
                  "text-white/70 hover:bg-white/5 hover:text-white": project.id !== currentProjectId,
                }
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Folder className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{project.name}</span>
              </div>
              {project.id === currentProjectId && (
                <Check className="w-4 h-4 flex-shrink-0 text-green-500" />
              )}
            </button>
          ))}
          
          {/* Divider */}
          {projects.length > 0 && (
            <div className="border-t border-white/10 my-1" />
          )}
          
          {/* Create New Project Button */}
          <button
            onClick={() => {
              setIsOpen(false);
              navigate('/create-project');
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-blue-400 hover:bg-white/5 transition-colors"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            <span>Create New Project</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ProjectSwitcher;
