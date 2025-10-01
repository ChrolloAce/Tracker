import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { Project, ProjectStats, CreateProjectData, ProjectWithStats } from '../types/projects';

/**
 * Service for managing projects within organizations
 */
class ProjectService {
  /**
   * Create a new project
   */
  static async createProject(
    orgId: string,
    userId: string,
    data: CreateProjectData
  ): Promise<string> {
    const projectRef = doc(collection(db, 'organizations', orgId, 'projects'));
    
    const project: Project = {
      id: projectRef.id,
      orgId,
      name: data.name,
      description: data.description,
      imageUrl: data.imageUrl,
      color: data.color,
      icon: data.icon,
      createdAt: Timestamp.now(),
      createdBy: userId,
      isArchived: false,
    };

    // Initialize project stats
    const statsRef = doc(db, 'organizations', orgId, 'projects', projectRef.id, 'stats', 'current');
    const stats: ProjectStats = {
      projectId: projectRef.id,
      trackedAccountCount: 0,
      videoCount: 0,
      linkCount: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalClicks: 0,
      lastUpdated: Timestamp.now(),
    };

    const batch = writeBatch(db);
    batch.set(projectRef, project);
    batch.set(statsRef, stats);

    // Update org project count
    const orgRef = doc(db, 'organizations', orgId);
    batch.update(orgRef, {
      projectCount: (await getDoc(orgRef)).data()?.projectCount || 0 + 1,
    });

    await batch.commit();
    
    console.log(`✅ Created project "${data.name}" with ID: ${projectRef.id}`);
    return projectRef.id;
  }

  /**
   * Get all projects for an organization
   */
  static async getProjects(orgId: string, includeArchived: boolean = false): Promise<Project[]> {
    const projectsRef = collection(db, 'organizations', orgId, 'projects');
    
    let q = query(projectsRef, orderBy('createdAt', 'desc'));
    
    if (!includeArchived) {
      q = query(projectsRef, where('isArchived', '==', false), orderBy('createdAt', 'desc'));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Project);
  }

  /**
   * Get a single project with stats
   */
  static async getProjectWithStats(orgId: string, projectId: string): Promise<ProjectWithStats | null> {
    const projectDoc = await getDoc(doc(db, 'organizations', orgId, 'projects', projectId));
    
    if (!projectDoc.exists()) {
      return null;
    }

    const project = projectDoc.data() as Project;
    
    // Get stats
    const statsDoc = await getDoc(
      doc(db, 'organizations', orgId, 'projects', projectId, 'stats', 'current')
    );
    
    const stats = statsDoc.exists()
      ? (statsDoc.data() as ProjectStats)
      : {
          projectId,
          trackedAccountCount: 0,
          videoCount: 0,
          linkCount: 0,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          totalClicks: 0,
          lastUpdated: Timestamp.now(),
        };

    return { ...project, stats };
  }

  /**
   * Get all projects with their stats
   */
  static async getProjectsWithStats(orgId: string, includeArchived: boolean = false): Promise<ProjectWithStats[]> {
    const projects = await this.getProjects(orgId, includeArchived);
    
    const projectsWithStats = await Promise.all(
      projects.map(async (project) => {
        const statsDoc = await getDoc(
          doc(db, 'organizations', orgId, 'projects', project.id, 'stats', 'current')
        );
        
        const stats = statsDoc.exists()
          ? (statsDoc.data() as ProjectStats)
          : {
              projectId: project.id,
              trackedAccountCount: 0,
              videoCount: 0,
              linkCount: 0,
              totalViews: 0,
              totalLikes: 0,
              totalComments: 0,
              totalShares: 0,
              totalClicks: 0,
              lastUpdated: Timestamp.now(),
            };

        return { ...project, stats };
      })
    );

    return projectsWithStats;
  }

  /**
   * Update a project
   */
  static async updateProject(
    orgId: string,
    projectId: string,
    updates: Partial<Pick<Project, 'name' | 'description' | 'color' | 'icon' | 'imageUrl'>>
  ): Promise<void> {
    const projectRef = doc(db, 'organizations', orgId, 'projects', projectId);
    await updateDoc(projectRef, updates);
    console.log(`✅ Updated project ${projectId}`);
  }

  /**
   * Archive a project (soft delete)
   */
  static async archiveProject(orgId: string, projectId: string, userId: string): Promise<void> {
    const projectRef = doc(db, 'organizations', orgId, 'projects', projectId);
    await updateDoc(projectRef, {
      isArchived: true,
      archivedAt: Timestamp.now(),
      archivedBy: userId,
    });
    console.log(`✅ Archived project ${projectId}`);
  }

  /**
   * Unarchive a project
   */
  static async unarchiveProject(orgId: string, projectId: string): Promise<void> {
    const projectRef = doc(db, 'organizations', orgId, 'projects', projectId);
    await updateDoc(projectRef, {
      isArchived: false,
      archivedAt: null,
      archivedBy: null,
    });
    console.log(`✅ Unarchived project ${projectId}`);
  }

  /**
   * Delete a project permanently (use with caution!)
   */
  static async deleteProject(orgId: string, projectId: string): Promise<void> {
    // This should cascade delete all subcollections
    // In production, use a Cloud Function for this
    
    // TODO: Implement cascading delete via Cloud Function
    // For now, just archive it
    await this.archiveProject(orgId, projectId, 'system');
    
    console.warn(`⚠️ Project ${projectId} archived (not permanently deleted)`);
  }

  /**
   * Update project stats (called when data changes)
   */
  static async updateProjectStats(
    orgId: string,
    projectId: string,
    updates: Partial<Omit<ProjectStats, 'projectId' | 'lastUpdated'>>
  ): Promise<void> {
    const statsRef = doc(db, 'organizations', orgId, 'projects', projectId, 'stats', 'current');
    
    await updateDoc(statsRef, {
      ...updates,
      lastUpdated: Timestamp.now(),
    });
  }

  /**
   * Recalculate project stats from data (expensive operation)
   */
  static async recalculateProjectStats(orgId: string, projectId: string): Promise<void> {
    // Get counts from subcollections
    const accountsSnapshot = await getDocs(
      collection(db, 'organizations', orgId, 'projects', projectId, 'trackedAccounts')
    );
    
    const linksSnapshot = await getDocs(
      collection(db, 'organizations', orgId, 'projects', projectId, 'links')
    );
    
    const videosSnapshot = await getDocs(
      collection(db, 'organizations', orgId, 'projects', projectId, 'videos')
    );

    // Calculate totals
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalClicks = 0;

    // Sum from links
    linksSnapshot.docs.forEach(doc => {
      const link = doc.data();
      totalClicks += link.totalClicks || 0;
    });

    // Sum from videos
    videosSnapshot.docs.forEach(doc => {
      const video = doc.data();
      totalViews += video.views || 0;
      totalLikes += video.likes || 0;
      totalComments += video.comments || 0;
      totalShares += video.shares || 0;
    });

    const stats: ProjectStats = {
      projectId,
      trackedAccountCount: accountsSnapshot.size,
      videoCount: videosSnapshot.size,
      linkCount: linksSnapshot.size,
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalClicks,
      lastUpdated: Timestamp.now(),
    };

    const statsRef = doc(db, 'organizations', orgId, 'projects', projectId, 'stats', 'current');
    await setDoc(statsRef, stats);
    
    console.log(`✅ Recalculated stats for project ${projectId}`);
  }

  /**
   * Set user's active project
   */
  static async setActiveProject(orgId: string, userId: string, projectId: string): Promise<void> {
    const memberRef = doc(db, 'organizations', orgId, 'members', userId);
    await updateDoc(memberRef, {
      lastActiveProjectId: projectId,
    });
  }

  /**
   * Get user's last active project
   */
  static async getActiveProjectId(orgId: string, userId: string): Promise<string | null> {
    const memberDoc = await getDoc(doc(db, 'organizations', orgId, 'members', userId));
    return memberDoc.data()?.lastActiveProjectId || null;
  }

  /**
   * Create default project for existing organizations (migration)
   */
  static async createDefaultProject(orgId: string, userId: string): Promise<string> {
    return this.createProject(orgId, userId, {
      name: 'Default Project',
      description: 'Your main project workspace',
      color: '#3B82F6',
      icon: '📁',
    });
  }
}

export default ProjectService;

