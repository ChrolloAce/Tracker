import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
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
    
    // Clean undefined values
    const project: any = {
      id: projectRef.id,
      orgId,
      name: data.name,
      createdAt: Timestamp.now(),
      createdBy: userId,
      isArchived: false,
    };

    // Only add optional fields if they exist
    if (data.description !== undefined) project.description = data.description;
    if (data.imageUrl !== undefined) project.imageUrl = data.imageUrl;
    if (data.color !== undefined) project.color = data.color;
    if (data.icon !== undefined) project.icon = data.icon;

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

    // Get current org data BEFORE starting batch
    const orgRef = doc(db, 'organizations', orgId);
    const orgDoc = await getDoc(orgRef);
    const currentProjectCount = orgDoc.data()?.projectCount || 0;

    const batch = writeBatch(db);
    batch.set(projectRef, project);
    batch.set(statsRef, stats);

    // Update org project count
    batch.update(orgRef, {
      projectCount: currentProjectCount + 1,
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
    
    // Filter out undefined values (Firebase doesn't allow them)
    const cleanedUpdates: any = {};
    Object.keys(updates).forEach((key) => {
      const value = updates[key as keyof typeof updates];
      if (value !== undefined) {
        cleanedUpdates[key] = value;
      }
    });
    
    await updateDoc(projectRef, cleanedUpdates);
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
   * Delete a project permanently with all its data (use with caution!)
   */
  static async deleteProject(orgId: string, projectId: string, _userId: string): Promise<void> {
    console.log(`🗑️ Starting deletion of project ${projectId}`);
    
    try {
      // Get current org data to update project count
      const orgRef = doc(db, 'organizations', orgId);
      const orgDoc = await getDoc(orgRef);
      const currentProjectCount = orgDoc.data()?.projectCount || 0;
      
      // 1. Delete all subcollections
      await this.deleteProjectSubcollections(orgId, projectId);
      
      // 2. Delete the project document itself
      const projectRef = doc(db, 'organizations', orgId, 'projects', projectId);
      await deleteDoc(projectRef);
      
      // 3. Update org project count
      await updateDoc(orgRef, {
        projectCount: Math.max(0, currentProjectCount - 1),
      });
      
      console.log(`✅ Successfully deleted project ${projectId} and all its data`);
    } catch (error) {
      console.error(`❌ Failed to delete project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Delete all subcollections within a project
   */
  private static async deleteProjectSubcollections(orgId: string, projectId: string): Promise<void> {
    const subcollections = [
      'trackedAccounts',
      'videos',
      'links',
      'campaigns',
      'trackingRules',
      'payoutStructures',
      'stats',
      'creators', // Delete creators last (contains nested payouts subcollection)
    ];

    console.log(`🗑️ Deleting ${subcollections.length} subcollections for project ${projectId}`);

    for (const subcollection of subcollections) {
      await this.deleteCollection(orgId, projectId, subcollection);
    }
    
    // Note: Payouts are nested under creators/{creatorId}/payouts
    // They are automatically inaccessible once creators are deleted
    // Firestore will eventually garbage collect orphaned subcollections
  }

  /**
   * Delete an entire collection
   */
  private static async deleteCollection(orgId: string, projectId: string, collectionName: string): Promise<void> {
    const collectionRef = collection(db, 'organizations', orgId, 'projects', projectId, collectionName);
    const snapshot = await getDocs(collectionRef);
    
    if (snapshot.empty) {
      console.log(`✓ ${collectionName}: empty, skipping`);
      return;
    }

    console.log(`🗑️ Deleting ${snapshot.size} documents from ${collectionName}`);

    // Batch delete documents (Firestore limit: 500 per batch)
    const batchSize = 500;
    let batch = writeBatch(db);
    let operationCount = 0;

    for (const docSnapshot of snapshot.docs) {
      batch.delete(docSnapshot.ref);
      operationCount++;

      // Commit batch every 500 operations
      if (operationCount >= batchSize) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
        console.log(`  ✓ Committed batch of ${batchSize} deletions`);
      }
    }

    // Commit remaining operations
    if (operationCount > 0) {
      await batch.commit();
      console.log(`  ✓ Committed final batch of ${operationCount} deletions`);
    }

    console.log(`✅ Deleted ${snapshot.size} documents from ${collectionName}`);
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
    // Use setDoc with merge to create the document if it doesn't exist
    await setDoc(memberRef, {
      lastActiveProjectId: projectId,
    }, { merge: true });
    console.log(`✅ Set active project ${projectId} for user ${userId}`);
  }

  /**
   * Get user's last active project
   */
  static async getActiveProjectId(orgId: string, userId: string): Promise<string | null> {
    try {
      const memberDoc = await getDoc(doc(db, 'organizations', orgId, 'members', userId));
      if (!memberDoc.exists()) {
        console.warn(`⚠️ Member document does not exist for user ${userId} in org ${orgId}`);
        return null;
      }
      return memberDoc.data()?.lastActiveProjectId || null;
    } catch (error) {
      console.error(`❌ Failed to get active project ID:`, error);
      return null;
    }
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

  /**
   * Get projects for a creator (filtered by their assigned projects)
   */
  static async getProjectsForCreator(orgId: string, userId: string): Promise<Project[]> {
    // Get the member document to check assigned projects
    const memberDoc = await getDoc(doc(db, 'organizations', orgId, 'members', userId));
    
    if (!memberDoc.exists()) {
      console.warn(`⚠️ Member document does not exist for creator ${userId}`);
      return [];
    }

    const memberData = memberDoc.data();
    const creatorProjectIds = memberData?.creatorProjectIds as string[] | undefined;

    // If no specific projects assigned, return empty (creator has no access)
    if (!creatorProjectIds || creatorProjectIds.length === 0) {
      console.log(`ℹ️ Creator ${userId} has no assigned projects`);
      return [];
    }

    // Get all projects and filter by assigned IDs
    const allProjects = await this.getProjects(orgId, false);
    const filteredProjects = allProjects.filter(project => creatorProjectIds.includes(project.id));
    
    console.log(`✅ Creator ${userId} has access to ${filteredProjects.length} projects`);
    return filteredProjects;
  }

  /**
   * Assign a creator to specific projects
   */
  static async assignCreatorToProjects(
    orgId: string, 
    creatorUserId: string, 
    projectIds: string[]
  ): Promise<void> {
    const memberRef = doc(db, 'organizations', orgId, 'members', creatorUserId);
    
    await updateDoc(memberRef, {
      creatorProjectIds: projectIds,
    });
    
    console.log(`✅ Assigned creator ${creatorUserId} to ${projectIds.length} projects`);
  }

  /**
   * Add a creator to a single project (append to existing)
   */
  static async addCreatorToProject(
    orgId: string, 
    creatorUserId: string, 
    projectId: string
  ): Promise<void> {
    const memberDoc = await getDoc(doc(db, 'organizations', orgId, 'members', creatorUserId));
    
    if (!memberDoc.exists()) {
      throw new Error('Creator member document not found');
    }

    const currentProjectIds = memberDoc.data()?.creatorProjectIds || [];
    
    if (!currentProjectIds.includes(projectId)) {
      await updateDoc(doc(db, 'organizations', orgId, 'members', creatorUserId), {
        creatorProjectIds: [...currentProjectIds, projectId],
      });
      console.log(`✅ Added creator ${creatorUserId} to project ${projectId}`);
    }
  }

  /**
   * Remove a creator from a single project
   */
  static async removeCreatorFromProject(
    orgId: string, 
    creatorUserId: string, 
    projectId: string
  ): Promise<void> {
    const memberDoc = await getDoc(doc(db, 'organizations', orgId, 'members', creatorUserId));
    
    if (!memberDoc.exists()) {
      throw new Error('Creator member document not found');
    }

    const currentProjectIds = memberDoc.data()?.creatorProjectIds || [];
    const updatedProjectIds = currentProjectIds.filter((id: string) => id !== projectId);
    
    await updateDoc(doc(db, 'organizations', orgId, 'members', creatorUserId), {
      creatorProjectIds: updatedProjectIds,
    });
    
    console.log(`✅ Removed creator ${creatorUserId} from project ${projectId}`);
  }

  /**
   * Get creator's assigned project IDs
   */
  static async getCreatorProjectIds(orgId: string, creatorUserId: string): Promise<string[]> {
    const memberDoc = await getDoc(doc(db, 'organizations', orgId, 'members', creatorUserId));
    
    if (!memberDoc.exists()) {
      return [];
    }

    return memberDoc.data()?.creatorProjectIds || [];
  }
}

export default ProjectService;

