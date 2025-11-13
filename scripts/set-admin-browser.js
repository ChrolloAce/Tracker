/**
 * Browser Console Script to Set Admin Status
 * 
 * Instructions:
 * 1. Open your app in the browser (https://www.viewtrack.app or localhost:5173)
 * 2. Make sure you're logged in
 * 3. Open browser console (F12 or Cmd+Option+I)
 * 4. Copy and paste this entire script
 * 5. Press Enter
 * 
 * This will set ernesto@maktubtechnologies.com as admin
 */

(async function setAdmin() {
  const targetEmail = 'ernesto@maktubtechnologies.com';
  
  console.log(`🔍 Looking for user with email: ${targetEmail}`);
  
  try {
    // Get Firebase instances from the app
    const { getAuth } = await import('firebase/auth');
    const { getFirestore, collection, query, where, getDocs, doc, setDoc, updateDoc } = await import('firebase/firestore');
    
    // Get current auth instance
    const auth = getAuth();
    const db = getFirestore();
    
    console.log('✅ Firebase instances loaded');
    
    // We need to find the userId for this email
    // Since we can't query auth from client, we'll query the users collection
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', targetEmail));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.error(`❌ No user found with email: ${targetEmail}`);
      console.log('   Make sure this user has logged in at least once.');
      return;
    }
    
    const userDoc = snapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();
    
    console.log(`✅ Found user: ${userId}`);
    console.log(`   Display Name: ${userData.displayName}`);
    console.log(`   Current Admin Status: ${userData.isAdmin || false}`);
    
    // Update to admin
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isAdmin: true
    });
    
    console.log(`\n🎉 SUCCESS! ${targetEmail} is now an admin!`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Admin Status: true`);
    console.log(`\n⚠️  Please refresh the page for changes to take effect.`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Make sure you are logged in');
    console.log('   2. Make sure the user has logged in at least once');
    console.log('   3. Check Firebase permissions allow reading users collection');
  }
})();

