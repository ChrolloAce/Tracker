#!/usr/bin/env node

/**
 * This script helps format your Firebase private key for Vercel
 * 
 * Usage:
 * 1. Put your firebase-service-account.json in this directory
 * 2. Run: node format-firebase-key.js
 * 3. Copy the output and paste into Vercel environment variable
 */

const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Error: firebase-service-account.json not found!');
  console.log('\nPlease:');
  console.log('1. Download your service account from Firebase Console');
  console.log('2. Save it as firebase-service-account.json in this directory');
  console.log('3. Run this script again');
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  
  console.log('✅ Service account loaded successfully!\n');
  console.log('📋 Copy these values to Vercel Environment Variables:\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('FIREBASE_PROJECT_ID=');
  console.log(serviceAccount.project_id);
  console.log();
  
  console.log('FIREBASE_CLIENT_EMAIL=');
  console.log(serviceAccount.client_email);
  console.log();
  
  console.log('FIREBASE_PRIVATE_KEY=');
  console.log(serviceAccount.private_key);
  console.log();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('⚠️  IMPORTANT: When pasting into Vercel:');
  console.log('   - Copy the ENTIRE private key including -----BEGIN----- and -----END-----');
  console.log('   - Keep the \\n characters as-is (they should be literal \\n, not actual newlines)');
  console.log('   - OR paste with quotes around it\n');
  
} catch (error) {
  console.error('❌ Error reading service account:', error.message);
  process.exit(1);
}

