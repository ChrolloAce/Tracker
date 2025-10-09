import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  try {
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

    initializeApp({ credential: cert(serviceAccount as any) });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

const db = getFirestore();

/**
 * Delete Organization API
 * Cascades deletion to all related data:
 * - Projects
 * - Tracked Accounts
 * - Videos and Snapshots
 * - Tracked Links
 * - Team Members
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Verify Firebase is initialized
    if (!getApps().length) {
      console.error('❌ Firebase Admin not initialized');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: Firebase not initialized',
        errorType: 'FIREBASE_INIT_ERROR'
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }

    const { organizationId, userId } = req.body;

    if (!organizationId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: organizationId and userId'
      });
    }

    console.log(`🗑️  Starting deletion of organization: ${organizationId} by user: ${userId}`);

    // Verify the organization exists
    const orgRef = db.collection('organizations').doc(organizationId);
    const orgDoc = await orgRef.get();

    if (!orgDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found'
      });
    }

    const orgData = orgDoc.data();
    console.log(`📁 Organization: ${orgData?.name}`);

    // Verify user is the owner (field is ownerUserId, not ownerId)
    if (orgData?.ownerUserId !== userId) {
      console.error(`❌ Permission denied: User ${userId} is not owner (owner is: ${orgData?.ownerUserId})`);
      return res.status(403).json({
        success: false,
        error: 'Only the organization owner can delete it'
      });
    }

    let deletedCounts = {
      projects: 0,
      accounts: 0,
      videos: 0,
      snapshots: 0,
      links: 0,
      members: 0
    };

    // 1. Delete all projects and their nested data
    const projectsSnapshot = await orgRef.collection('projects').get();
    console.log(`📂 Found ${projectsSnapshot.size} projects to delete`);

    for (const projectDoc of projectsSnapshot.docs) {
      const projectId = projectDoc.id;
      console.log(`  🗂️  Processing project: ${projectId}`);

      // Delete tracked accounts
      const accountsSnapshot = await projectDoc.ref.collection('trackedAccounts').get();
      console.log(`    👥 Deleting ${accountsSnapshot.size} accounts`);
      for (const accountDoc of accountsSnapshot.docs) {
        await accountDoc.ref.delete();
        deletedCounts.accounts++;
      }

      // Delete videos and their snapshots
      const videosSnapshot = await projectDoc.ref.collection('videos').get();
      console.log(`    🎬 Deleting ${videosSnapshot.size} videos`);
      for (const videoDoc of videosSnapshot.docs) {
        // Delete snapshots subcollection
        const snapshotsSnapshot = await videoDoc.ref.collection('snapshots').get();
        for (const snapshotDoc of snapshotsSnapshot.docs) {
          await snapshotDoc.ref.delete();
          deletedCounts.snapshots++;
        }
        await videoDoc.ref.delete();
        deletedCounts.videos++;
      }

      // Delete tracked links
      const linksSnapshot = await projectDoc.ref.collection('trackedLinks').get();
      console.log(`    🔗 Deleting ${linksSnapshot.size} links`);
      for (const linkDoc of linksSnapshot.docs) {
        // Delete link clicks subcollection
        const clicksSnapshot = await linkDoc.ref.collection('clicks').get();
        for (const clickDoc of clicksSnapshot.docs) {
          await clickDoc.ref.delete();
        }
        await linkDoc.ref.delete();
        deletedCounts.links++;
      }

      // Delete the project
      await projectDoc.ref.delete();
      deletedCounts.projects++;
    }

    // 2. Delete team members
    const membersSnapshot = await orgRef.collection('members').get();
    console.log(`👨‍👩‍👧‍👦 Deleting ${membersSnapshot.size} members`);
    for (const memberDoc of membersSnapshot.docs) {
      // Remove organization from user's organizations array
      const userId = memberDoc.id;
      const userRef = db.collection('users').doc(userId);
      await userRef.update({
        organizations: FieldValue.arrayRemove(organizationId)
      });
      
      await memberDoc.ref.delete();
      deletedCounts.members++;
    }

    // 3. Delete pending invitations
    const invitationsSnapshot = await orgRef.collection('invitations').get();
    console.log(`📧 Deleting ${invitationsSnapshot.size} invitations`);
    for (const invitationDoc of invitationsSnapshot.docs) {
      await invitationDoc.ref.delete();
    }

    // 4. Delete the organization itself
    await orgRef.delete();
    console.log(`✅ Organization deleted: ${orgData?.name}`);

    // 5. Remove organization from owner's organizations array
    const ownerRef = db.collection('users').doc(userId);
    await ownerRef.update({
      organizations: FieldValue.arrayRemove(organizationId)
    });

    return res.status(200).json({
      success: true,
      message: 'Organization deleted successfully',
      organizationId,
      organizationName: orgData?.name,
      deleted: deletedCounts
    });

  } catch (error: any) {
    console.error('❌ Delete organization error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      errorType: 'PROCESSING_ERROR'
    });
  }
}

