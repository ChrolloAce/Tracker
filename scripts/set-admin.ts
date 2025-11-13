/**
 * One-time script to set a user as admin
 * 
 * Usage:
 * 1. Install ts-node if not already: npm install -g ts-node
 * 2. Run: ts-node scripts/set-admin.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin
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
    credential: cert(serviceAccount as any)
  });
}

const db = getFirestore();
const auth = getAuth();

async function setAdminByEmail(email: string) {
  try {
    console.log(`🔍 Looking up user: ${email}`);
    
    // Get user by email
    const userRecord = await auth.getUserByEmail(email);
    const userId = userRecord.uid;
    
    console.log(`✅ Found user: ${userId}`);
    console.log(`   Display Name: ${userRecord.displayName}`);
    console.log(`   Created: ${userRecord.metadata.creationTime}`);
    
    // Update user document
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.log(`❌ User document not found in Firestore. Creating...`);
      await userRef.set({
        uid: userId,
        email: email,
        displayName: userRecord.displayName || email.split('@')[0],
        createdAt: new Date(),
        lastLoginAt: new Date(),
        plan: 'pro',
        isAdmin: true
      });
      console.log(`✅ Created user document with admin status`);
    } else {
      await userRef.update({
        isAdmin: true
      });
      console.log(`✅ Updated user to admin status`);
    }
    
    console.log(`\n🎉 ${email} is now an admin!`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Admin status: true`);
    
  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
    throw error;
  }
}

// Run the script
const targetEmail = 'ernesto@maktubtechnologies.com';
setAdminByEmail(targetEmail)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

