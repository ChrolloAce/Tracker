/**
 * Public API v1 - Projects
 * GET  /api/v1/projects - List all projects
 * POST /api/v1/projects - Create new project (mirrors manual flow)
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { initializeFirebase } from '../../utils/firebase-admin.js';
import { withApiAuth } from '../../middleware/apiKeyAuth.js';
import type { AuthenticatedApiRequest } from '../../../src/types/apiKeys';

initializeFirebase();
const db = getFirestore();

async function handler(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  switch (req.method) {
    case 'GET':
      return await listProjects(req, res, auth);
    case 'POST':
      return await createProject(req, res, auth);
    default:
      return res.status(405).json({
        success: false,
        error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }
      });
  }
}

// ─── GET: List Projects ──────────────────────────────────

async function listProjects(
  _req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  // If API key is scoped to a project, only return that project
  if (auth.projectId) {
    const projectDoc = await db
      .collection('organizations')
      .doc(auth.organizationId)
      .collection('projects')
      .doc(auth.projectId)
      .get();

    if (!projectDoc.exists) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project not found', code: 'NOT_FOUND' }
      });
    }

    const data = projectDoc.data()!;
    return res.status(200).json({
      success: true,
      data: {
        projects: [{
          id: projectDoc.id,
          name: data.name,
          description: data.description || '',
          color: data.color || null,
          isArchived: data.isArchived || false,
          createdAt: data.createdAt?.toDate?.()?.toISOString()
        }],
        total: 1
      }
    });
  }

  // List all projects
  const snapshot = await db
    .collection('organizations')
    .doc(auth.organizationId)
    .collection('projects')
    .orderBy('createdAt', 'desc')
    .get();

  const projects = await Promise.all(snapshot.docs.map(async doc => {
    const data = doc.data();

    const [accountsSnap, videosSnap] = await Promise.all([
      doc.ref.collection('trackedAccounts').count().get(),
      doc.ref.collection('videos').count().get()
    ]);

    return {
      id: doc.id,
      name: data.name,
      description: data.description || '',
      color: data.color || null,
      isArchived: data.isArchived || false,
      accountCount: accountsSnap.data().count,
      videoCount: videosSnap.data().count,
      createdAt: data.createdAt?.toDate?.()?.toISOString(),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString()
    };
  }));

  return res.status(200).json({
    success: true,
    data: { projects, total: projects.length }
  });
}

// ─── POST: Create Project ────────────────────────────────

async function createProject(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  // Can't create projects if API key is scoped to a project
  if (auth.projectId) {
    return res.status(403).json({
      success: false,
      error: { message: 'This API key is scoped to a specific project', code: 'FORBIDDEN' }
    });
  }

  const { name, description, color } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'Project name is required', code: 'VALIDATION_ERROR' }
    });
  }

  const orgRef = db.collection('organizations').doc(auth.organizationId);
  const projectsCol = orgRef.collection('projects');

  // Check for duplicate name
  const existingQuery = await projectsCol
    .where('name', '==', name.trim())
    .limit(1)
    .get();

  if (!existingQuery.empty) {
    return res.status(409).json({
      success: false,
      error: { message: 'A project with this name already exists', code: 'ALREADY_EXISTS' }
    });
  }

  // Generate doc ref for the ID
  const projectRef = projectsCol.doc();

  // Build project data (mirrors ProjectService.createProject)
  const projectData: Record<string, any> = {
    id: projectRef.id,
    orgId: auth.organizationId,
    name: name.trim(),
    createdAt: Timestamp.now(),
    createdBy: 'api',
    isArchived: false,
  };

  if (description && typeof description === 'string' && description.trim()) {
    projectData.description = description.trim();
  }
  if (color && typeof color === 'string' && color.trim()) {
    projectData.color = color.trim();
  }

  // Initialize project stats subcollection
  const statsRef = projectRef.collection('stats').doc('current');
  const statsData = {
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

  // Get current project count for increment
  const orgDoc = await orgRef.get();
  const currentProjectCount = orgDoc.data()?.projectCount || 0;

  // Batch write: project + stats + org count update
  const batch = db.batch();
  batch.set(projectRef, projectData);
  batch.set(statsRef, statsData);
  batch.update(orgRef, { projectCount: currentProjectCount + 1 });

  await batch.commit();

  console.log(`📁 [API] Project created: ${projectRef.id} "${name.trim()}" for org ${auth.organizationId}`);

  return res.status(201).json({
    success: true,
    data: {
      id: projectRef.id,
      name: name.trim(),
      description: projectData.description || '',
      color: projectData.color || null,
      isArchived: false,
      createdAt: new Date().toISOString(),
      message: 'Project created successfully. Use this project ID when adding accounts or videos.'
    }
  });
}

// ─── Export ──────────────────────────────────────────────

export default withApiAuth(['projects:read'], handler);
