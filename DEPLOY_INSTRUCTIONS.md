# 🚀 Firebase Deployment Instructions

## ⚠️ Current Issue

You're seeing "Missing or insufficient permissions" because the Firestore security rules haven't been deployed yet.

## 📋 Step-by-Step Deployment

### 1. Login to Firebase

```bash
firebase login --reauth
```

This will open a browser window. Sign in with the Google account that owns the `trackview-6a3a5` Firebase project.

### 2. Initialize Firebase (if needed)

```bash
firebase init firestore
```

When prompted:
- ✅ Select: **Use an existing project**
- ✅ Choose: **trackview-6a3a5**
- ✅ Firestore Rules File: Press Enter (use `firestore.rules`)
- ✅ Firestore Indexes File: Press Enter (use `firestore.indexes.json`)

### 3. Deploy Firestore Rules & Indexes

**Option A: Use the deployment script**
```bash
./deploy-firestore.sh
```

**Option B: Manual deployment**
```bash
# Deploy rules
firebase deploy --only firestore:rules --project trackview-6a3a5

# Deploy indexes
firebase deploy --only firestore:indexes --project trackview-6a3a5
```

### 4. Verify Deployment

Go to [Firebase Console](https://console.firebase.google.com/project/trackview-6a3a5/firestore/rules) and check:

- ✅ **Rules tab**: Should show the new rules (last updated timestamp)
- ✅ **Indexes tab**: Should show composite indexes being created
- ✅ **Data tab**: Check if you can see the database

### 5. Enable Authentication Methods

1. Go to [Authentication](https://console.firebase.google.com/project/trackview-6a3a5/authentication/providers)
2. Click **Sign-in method** tab
3. Enable:
   - ✅ **Email/Password** (enable both Email/Password and Email link)
   - ✅ **Google** (add OAuth client if needed)

## 🔍 What the Rules Do

The updated rules allow:

1. **User Account Creation**: Any authenticated user can create their own user document
2. **Organization Creation**: Users can create new organizations (becomes owner)
3. **First Member Addition**: Organization creator can add themselves as owner member
4. **Data Access**: Only organization members can access that org's data

## ✅ After Deployment

Once deployed, your app will:

1. ✅ Allow users to sign in
2. ✅ Automatically create user account in Firestore
3. ✅ Automatically create default organization
4. ✅ Add user as organization owner
5. ✅ No more "Missing permissions" errors!

## 🐛 Troubleshooting

### Error: "Missing or insufficient permissions"
- **Cause**: Rules not deployed
- **Fix**: Run `firebase deploy --only firestore:rules`

### Error: "PERMISSION_DENIED: Missing or insufficient permissions"
- **Cause**: User not a member of the organization
- **Fix**: Check `organizations/{orgId}/members/{userId}` exists with `status: 'active'`

### Error: "Index not found"
- **Cause**: Indexes still building (takes 5-10 minutes)
- **Fix**: Wait for indexes to build, or click the link in the error to auto-create

### Error: "Not authenticated"
- **Cause**: Firebase auth session expired
- **Fix**: Sign out and sign back in

## 📊 Verify Rules Are Active

You can test rules in the Firebase Console:

1. Go to **Firestore Database** → **Rules** tab
2. Click **Rules Playground**
3. Test different scenarios:
   - ✅ Authenticated user creating their user doc
   - ✅ Authenticated user creating an organization
   - ❌ Anonymous user reading data
   - ❌ User A reading User B's data

## 🎯 Quick Test

After deploying, refresh your app and sign in. Check the browser console:

```
✅ User signed in: your-email@example.com
✅ Created user account for your-email@example.com
✅ Current organization: abc123xyz
```

If you see all three ✅ messages, it's working!

## 🆘 Need Help?

If you're still getting errors:

1. Check Firebase Console → Firestore → Rules tab (should show updated timestamp)
2. Check Browser Console for specific error messages
3. Check Firebase Console → Firestore → Data tab (should see `users` and `organizations` collections)
4. Verify you're signed in with the correct Google account that owns the project

## 📞 Support

- Firebase Console: https://console.firebase.google.com/project/trackview-6a3a5
- Firebase Rules Reference: https://firebase.google.com/docs/firestore/security/get-started
- Firebase Support: https://firebase.google.com/support

