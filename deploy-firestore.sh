#!/bin/bash

# Deploy Firestore Rules and Indexes to Firebase
# Make sure you have Firebase CLI installed: npm install -g firebase-tools
# And you're logged in: firebase login

echo "🚀 Deploying Firestore rules and indexes..."

# Check if firebase-tools is installed
if ! command -v firebase &> /dev/null
then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Deploy rules
echo "📋 Deploying Firestore security rules..."
firebase deploy --only firestore:rules --project trackview-6a3a5

if [ $? -eq 0 ]; then
    echo "✅ Rules deployed successfully!"
else
    echo "❌ Rules deployment failed!"
    exit 1
fi

# Deploy indexes
echo "📊 Deploying Firestore indexes..."
firebase deploy --only firestore:indexes --project trackview-6a3a5

if [ $? -eq 0 ]; then
    echo "✅ Indexes deployed successfully!"
else
    echo "❌ Indexes deployment failed!"
    exit 1
fi

echo ""
echo "🎉 Firestore deployment complete!"
echo ""
echo "Next steps:"
echo "1. Go to Firebase Console: https://console.firebase.google.com/project/trackview-6a3a5"
echo "2. Enable Authentication methods (Google, Email/Password)"
echo "3. Check Firestore rules are active in Firestore → Rules tab"
echo ""

