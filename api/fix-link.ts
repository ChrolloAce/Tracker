import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * DIAGNOSTIC & FIX API for Link Tracking Issues
 * 
 * Usage:
 * GET /api/fix-link?shortCode=E9mj4J&action=check
 * GET /api/fix-link?shortCode=E9mj4J&action=fix&projectId=YOUR_PROJECT_ID
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    // Initialize Firebase Admin if not already initialized
    if (getApps().length === 0) {
      let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
      
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      
      privateKey = privateKey.replace(/\\n/g, '\n');

      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      };

      initializeApp({
        credential: cert(serviceAccount as any),
      });
    }

    const db = getFirestore();
    const { shortCode, action, projectId } = req.query;

    if (!shortCode || typeof shortCode !== 'string') {
      return res.status(400).json({ error: 'Missing shortCode parameter' });
    }

    if (action === 'check') {
      // Check the link status
      const publicLinkDoc = await db.collection('publicLinks').doc(shortCode).get();
      
      if (!publicLinkDoc.exists) {
        return res.status(404).json({
          status: 'error',
          message: 'Link not found in publicLinks collection',
          shortCode,
          solution: 'The link needs to be recreated or the publicLinks entry needs to be created'
        });
      }

      const publicLinkData = publicLinkDoc.data();
      
      // Check if we have the link document
      if (!publicLinkData?.orgId || !publicLinkData?.linkId) {
        return res.status(500).json({
          status: 'error',
          message: 'publicLinks entry is corrupted - missing orgId or linkId',
          data: publicLinkData
        });
      }

      // Try to find the link in the organization
      const linkDocPath = publicLinkData.projectId 
        ? `organizations/${publicLinkData.orgId}/projects/${publicLinkData.projectId}/links/${publicLinkData.linkId}`
        : `organizations/${publicLinkData.orgId}/links/${publicLinkData.linkId}`;

      let linkDoc;
      try {
        linkDoc = await db.doc(linkDocPath).get();
      } catch (err) {
        // Try old path without projects
        try {
          linkDoc = await db.doc(`organizations/${publicLinkData.orgId}/links/${publicLinkData.linkId}`).get();
        } catch (err2) {
          return res.status(500).json({
            status: 'error',
            message: 'Could not find link document in either old or new location',
            triedPaths: [
              linkDocPath,
              `organizations/${publicLinkData.orgId}/links/${publicLinkData.linkId}`
            ]
          });
        }
      }

      const linkData = linkDoc?.data();

      return res.json({
        status: 'ok',
        shortCode,
        publicLinkData,
        linkData,
        hasProjectId: !!publicLinkData.projectId,
        linkPath: linkDoc?.ref.path,
        diagnosis: !publicLinkData.projectId 
          ? 'OLD LINK - Missing projectId. Needs migration.' 
          : 'Link structure looks good',
        recommendation: !publicLinkData.projectId
          ? `Call this API with action=fix&projectId=YOUR_PROJECT_ID to fix`
          : 'Link should work. Check Vercel logs for errors when clicking.'
      });

    } else if (action === 'fix') {
      if (!projectId || typeof projectId !== 'string') {
        return res.status(400).json({ 
          error: 'Missing projectId parameter. You need to provide the project ID to fix the link.' 
        });
      }

      // Get public link data
      const publicLinkDoc = await db.collection('publicLinks').doc(shortCode).get();
      
      if (!publicLinkDoc.exists) {
        return res.status(404).json({ error: 'Link not found in publicLinks collection' });
      }

      const publicLinkData = publicLinkDoc.data();
      const orgId = publicLinkData?.orgId;
      const linkId = publicLinkData?.linkId;

      if (!orgId || !linkId) {
        return res.status(500).json({ error: 'publicLinks entry is corrupted' });
      }

      // Check if link exists in old location
      const oldLinkDoc = await db.doc(`organizations/${orgId}/links/${linkId}`).get();
      
      if (!oldLinkDoc.exists) {
        return res.status(404).json({ 
          error: 'Link document not found in old location',
          path: `organizations/${orgId}/links/${linkId}`
        });
      }

      const linkData = oldLinkDoc.data();

      // Create link in new location with projectId
      const newLinkRef = db.doc(`organizations/${orgId}/projects/${projectId}/links/${linkId}`);
      await newLinkRef.set({
        ...linkData,
        orgId,
        projectId // Add projectId if missing
      });

      // Update publicLinks to include projectId
      await publicLinkDoc.ref.update({
        projectId,
        url: linkData?.originalUrl || publicLinkData.url
      });

      return res.json({
        status: 'fixed',
        message: 'Link has been migrated to project structure',
        shortCode,
        oldPath: `organizations/${orgId}/links/${linkId}`,
        newPath: `organizations/${orgId}/projects/${projectId}/links/${linkId}`,
        publicLinkUpdated: true,
        testUrl: `${req.headers.origin || 'https://your-domain.com'}/l/${shortCode}`
      });

    } else {
      return res.status(400).json({
        error: 'Invalid action. Use action=check or action=fix&projectId=YOUR_PROJECT_ID'
      });
    }

  } catch (error: any) {
    console.error('Fix link error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: error.stack
    });
  }
}

