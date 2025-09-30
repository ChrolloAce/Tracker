#!/bin/bash

# Deploy Firebase Storage Rules
# This script deploys only the storage rules to Firebase

echo "🚀 Deploying Firebase Storage Rules..."
echo ""

# Deploy storage rules only
firebase deploy --only storage

echo ""
echo "✅ Storage rules deployed successfully!"
echo ""
echo "📝 Note: These rules allow:"
echo "  - Authenticated users to upload/download images in their organization"
echo "  - Max 10MB per image"
echo "  - Only image files (JPEG, PNG, etc.)"
echo ""
echo "🔒 Security:"
echo "  - Only authenticated users can access storage"
echo "  - Users can only access their organization's files"
echo "  - Public access is denied by default"

