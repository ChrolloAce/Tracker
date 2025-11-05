#!/usr/bin/env node

/**
 * Helper script to encode Firebase service account credentials to base64
 * 
 * Usage:
 *   node scripts/encode-firebase-credentials.js path/to/serviceAccount.json
 * 
 * This will output a base64 string that you can set as FIREBASE_SERVICE_ACCOUNT_BASE64
 * environment variable in Vercel.
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('❌ Error: Please provide path to Firebase service account JSON file');
  console.error('');
  console.error('Usage:');
  console.error('  node scripts/encode-firebase-credentials.js path/to/serviceAccount.json');
  console.error('');
  process.exit(1);
}

const filePath = args[0];

if (!fs.existsSync(filePath)) {
  console.error(`❌ Error: File not found: ${filePath}`);
  process.exit(1);
}

try {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(fileContent); // Validate it's valid JSON
  
  // Encode to base64
  const base64 = Buffer.from(fileContent).toString('base64');
  
  console.log('✅ Firebase service account encoded successfully!');
  console.log('');
  console.log('📋 Copy this value and set it as FIREBASE_SERVICE_ACCOUNT_BASE64 in Vercel:');
  console.log('');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(base64);
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
  console.log('🔧 In Vercel:');
  console.log('1. Go to your project Settings → Environment Variables');
  console.log('2. Add new variable: FIREBASE_SERVICE_ACCOUNT_BASE64');
  console.log('3. Paste the base64 string above');
  console.log('4. Save and redeploy');
  console.log('');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

