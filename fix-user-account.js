/**
 * Script to fix a broken user account
 * Run in browser console while signed in as the affected user
 */

// Clear all local state for the current user
async function fixUserAccount() {
  console.log('🔧 Starting account fix...');
  
  // 1. Clear all local storage
  console.log('🗑️ Clearing local storage...');
  localStorage.clear();
  
  // 2. Clear session storage
  console.log('🗑️ Clearing session storage...');
  sessionStorage.clear();
  
  // 3. Clear IndexedDB (Firebase cache)
  console.log('🗑️ Clearing IndexedDB...');
  const databases = await indexedDB.databases();
  for (const db of databases) {
    if (db.name) {
      console.log(`  Deleting database: ${db.name}`);
      indexedDB.deleteDatabase(db.name);
    }
  }
  
  console.log('✅ All local data cleared!');
  console.log('🔄 Redirecting to login in 2 seconds...');
  
  setTimeout(() => {
    window.location.href = '/login';
  }, 2000);
}

// Run it
fixUserAccount();

