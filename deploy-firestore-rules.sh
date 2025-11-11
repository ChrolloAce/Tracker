#!/bin/bash

# Deploy Firestore Security Rules Script
# This script helps deploy updated Firestore rules to Firebase

echo "🔥 Firebase Firestore Rules Deployment"
echo "========================================"
echo ""

# Check if firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed."
    echo "Install it with: npm install -g firebase-tools"
    exit 1
fi

echo "✅ Firebase CLI found"
echo ""

# Check if user is logged in
echo "🔍 Checking Firebase authentication..."
if ! firebase projects:list &> /dev/null; then
    echo "⚠️  You need to login to Firebase first."
    echo "Opening browser for login..."
    firebase login
fi

# List projects to confirm
echo ""
echo "📋 Your Firebase projects:"
firebase projects:list

# Prompt for confirmation
echo ""
read -p "🚀 Deploy Firestore rules to production? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Deploying Firestore rules..."
    firebase deploy --only firestore:rules
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Firestore rules deployed successfully!"
        echo ""
        echo "📝 What was fixed:"
        echo "   - Added security rules for payoutStructures subcollection"
        echo "   - This allows admins to delete projects and all their data"
        echo ""
        echo "🔒 Security:"
        echo "   - Only org admins can delete payoutStructures"
        echo "   - Read access for all org members"
        echo ""
    else
        echo ""
        echo "❌ Failed to deploy rules."
        echo "Check the error message above for details."
        exit 1
    fi
else
    echo "❌ Deployment cancelled."
    exit 0
fi

