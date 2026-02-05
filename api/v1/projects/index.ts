/**
 * Public API v1 - Projects
 * GET /api/v1/projects - List all projects
 * POST /api/v1/projects - Create new project
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeFirebase } from '../../utils/firebase-admin';
import { withApiAuth } from '../../middleware/apiKeyAuth';
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

/**
 * List all projects for organization
 */
async function listProjects(
  req: VercelRequest,
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
          description: data.description,
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
    
    // Get counts
    const [accountsSnapshot, videosSnapshot] = await Promise.all([
      doc.ref.collection('trackedAccounts').count().get(),
      doc.ref.collection('videos').count().get()
    ]);
    
    return {
      id: doc.id,
      name: data.name,
      description: data.description,
      accountCount: accountsSnapshot.data().count,
      videoCount: videosSnapshot.data().count,
      createdAt: data.createdAt?.toDate?.()?.toISOString(),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString()
    };
  }));
  
  return res.status(200).json({
    success: true,
    data: {
      projects,
      total: projects.length
    }
  });
}

/**
 * Create a new project
 */
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
  
  const { name, description } = req.body;
  
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'Project name is required', code: 'VALIDATION_ERROR' }
    });
  }
  
  // Check for duplicate name
  const existingQuery = await db
    .collection('organizations')
    .doc(auth.organizationId)
    .collection('projects')
    .where('name', '==', name.trim())
    .limit(1)
    .get();
  
  if (!existingQuery.empty) {
    return res.status(409).json({
      success: false,
      error: { message: 'A project with this name already exists', code: 'ALREADY_EXISTS' }
    });
  }
  
  const projectData = {
    name: name.trim(),
    description: description?.trim() || '',
    organizationId: auth.organizationId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  
  const docRef = await db
    .collection('organizations')
    .doc(auth.organizationId)
    .collection('projects')
    .add(projectData);
  
  return res.status(201).json({
    success: true,
    data: {
      id: docRef.id,
      name: name.trim(),
      description: description?.trim() || '',
      createdAt: new Date().toISOString()
    }
  });
}

// Export with authentication wrapper
export default withApiAuth(['projects:read'], handler);
