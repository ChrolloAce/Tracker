# 🚨 SUBSCRIPTION SHOWING AS FREE - FIX GUIDE

## What Happened?

Your account that had a **paid subscription is now showing as FREE** because you're looking at a **NEW organization** that was just created, not your original organization with the subscription!

### The Issue

When you logged in, the system:
1. Checked for your organizations using `getUserOrganizations()`
2. If it returned 0 organizations (due to query timing, Firestore indexes, or session issues)
3. **It triggered the onboarding flow** which created a BRAND NEW organization
4. The new org has a default **FREE plan**
5. You're now viewing this new org instead of your paid one

### Your Original Org Still Exists! 

**Your original organization with the subscription is still in Firestore!** You just need to switch back to it.

---

## ✅ IMMEDIATE FIX - Switch Back to Your Paid Org

### Option 1: Use the Organization Switcher (EASIEST)

**After the next deployment:**

1. **Look at the bottom-left sidebar** - you'll see your organization name
2. **Click on the organization name** at the bottom of the sidebar
3. A modal will open showing **ALL your organizations**
4. **Look for**:
   - The organization with multiple members (your team)
   - The older organization (check creation dates)
   - **NOT the newest one** (that's the free one just created)
5. **Click on your real organization** to switch back
6. The page will reload with your subscription restored!

### Option 2: Use the Diagnostic API Endpoint

If you need to see all your organizations with subscription details:

1. **Get your User ID**:
   - Open browser console (F12)
   - Type: `firebase.auth().currentUser.uid`
   - Copy the ID

2. **Call the diagnostic endpoint**:
```bash
https://your-domain.com/api/list-my-orgs?userId=YOUR_USER_ID
```

3. **Look for the organization with**:
   - `planTier`: "pro", "basic", or "ultra" (not "free")
   - `stripeSubscriptionId`: Has a value
   - Older `createdAt` date

4. **Note the `orgId`** of your paid organization

5. **In the app UI**: Use the Organization Switcher to select that org

---

## 🔍 Diagnostic Information

### What to Look For

When you use the Organization Switcher or the API endpoint, here's how to identify your REAL organization:

| Indicator | Your Paid Org | New Free Org |
|-----------|---------------|--------------|
| **Plan Tier** | `pro`, `basic`, or `ultra` | `free` |
| **Stripe Customer ID** | Has value | Empty/null |
| **Stripe Subscription ID** | Has value | Empty/null |
| **Member Count** | 2+ members | 1 member (you) |
| **Created Date** | Older | **Very recent (today)** |
| **Organization Name** | Your team's actual name | "{Your Name}'s Workspace" |

---

## 🛡️ Prevention - How to Avoid This in the Future

### The Root Cause

The `getUserOrganizations()` function uses a Firestore **collectionGroup** query:

```typescript
const membersQuery = query(
  collectionGroup(db, 'members'),
  where('userId', '==', userId),
  where('status', '==', 'active')
);
```

**This can fail if:**
1. Firestore composite index is not built yet
2. Query times out or has issues
3. Member document status is not 'active'
4. Session/auth timing issues

### The Fix Applied

We've added an **Organization Switcher** to the sidebar that will:
- Show ALL your organizations
- Let you switch between them easily
- Persist your choice across sessions

### Additional Safeguards Needed

**TODO (Future Updates):**

1. **Add a "Do you already have an organization?" check** in the onboarding flow
2. **More robust org detection** - check multiple ways (user doc + collectionGroup)
3. **Warning banner** if a new org is created for a user with existing orgs
4. **Backup query** if collectionGroup fails

---

## 🆘 If You Still Can't Find Your Paid Org

### Step 1: Check Firestore Directly

1. Go to Firebase Console
2. Navigate to Firestore Database
3. Look in `organizations` collection
4. Find your organization (look for the one with your team name)
5. Go to `organizations/{orgId}/billing/subscription`
6. Check if `planTier` is not "free"

### Step 2: Verify Member Document Exists

1. In Firestore: `organizations/{orgId}/members/{yourUserId}`
2. Check that:
   - Document exists
   - `status` field = "active"
   - `role` field has a value ("owner", "admin", "member")

### Step 3: Manual Fix (Last Resort)

If your member document is missing or has wrong status:

```typescript
// In Firestore Console, update:
organizations/{YOUR_ORG_ID}/members/{YOUR_USER_ID}

// Set fields:
{
  userId: "YOUR_USER_ID",
  email: "your@email.com",
  role: "owner",  // or "admin"
  status: "active",
  joinedAt: <current timestamp>
}
```

### Step 4: Set as Default Org

1. In Firestore: `users/{yourUserId}`
2. Update or add field:
```typescript
{
  defaultOrgId: "YOUR_REAL_ORG_ID"
}
```

3. Refresh the app

---

## 📞 Contact Support

If none of these solutions work:

1. **Provide**:
   - Your email address
   - Your User ID
   - The name of your organization with the subscription
   - Your Stripe Customer ID (if you have it)

2. **We can**:
   - Manually link you back to your org
   - Verify your subscription in Stripe
   - Update Firestore documents directly

---

## ⚙️ Technical Details (For Developers)

### Files Involved

- `src/contexts/AuthContext.tsx` (lines 183-198) - Checks user organizations on login
- `src/services/OrganizationService.ts` (lines 170-201) - `getUserOrganizations()` function  
- `src/pages/OnboardingOrchestrator.tsx` (lines 24-50) - Creates new org if none found
- `src/services/SubscriptionService.ts` (lines 303-345) - Creates default free subscription
- `src/components/OrganizationSwitcher.tsx` - Switch between organizations

### The Flow That Causes This

```
Login → AuthContext.onAuthStateChanged
  ↓
getUserOrganizations(userId)
  ↓
Returns [] (empty array)
  ↓
AuthContext sets currentOrgId = null
  ↓
App.tsx routing: !currentOrgId → Navigate to /onboarding
  ↓
OnboardingOrchestrator: !currentOrgId → createOrganization()
  ↓
Creates new org with FREE subscription
  ↓
User now on new org (not their paid one)
```

### Proposed Code Fix (TODO)

```typescript
// In OnboardingOrchestrator.tsx, before creating new org:

// Check if user already has orgs via alternative method
const userDoc = await getDoc(doc(db, 'users', user.uid));
const defaultOrgId = userDoc.data()?.defaultOrgId;

if (defaultOrgId) {
  console.log('⚠️ User has a defaultOrgId but no orgs returned from query!');
  console.log('⚠️ This might be a query timing issue. Trying to load org directly...');
  
  const orgDoc = await getDoc(doc(db, 'organizations', defaultOrgId));
  if (orgDoc.exists()) {
    console.log('✅ Found existing org directly! Using that instead of creating new one.');
    return; // Exit onboarding, let AuthContext pick up the org
  }
}

// Also check if user has any orgs at all (backup query)
const orgsSnapshot = await getDocs(
  query(
    collection(db, 'organizations'),
    where('createdBy', '==', user.uid)
  )
);

if (!orgsSnapshot.empty) {
  console.log('⚠️ User created organizations but query didn\'t find them!');
  // Show warning or use first org found
}
```

---

## 📊 Monitoring

After this fix, monitor:

1. **Number of organizations per user** - Alert if >2 orgs for same user
2. **Duplicate organization creation** - Log when org is created for user with existing orgs
3. **CollectionGroup query performance** - Track if queries are timing out
4. **Subscription downgrades** - Alert if paid → free happens (this shouldn't occur naturally)

---

## ✅ Summary

**What happened**: You were redirected to a new free org instead of your paid one  
**Where is your subscription**: Still exists in your original organization in Firestore  
**How to fix**: Use the Organization Switcher in the bottom-left sidebar after next deployment  
**How to verify**: Check that planTier is "pro"/"basic"/"ultra" and stripeSubscriptionId exists  
**Prevention**: Additional org detection safeguards and user prompts in onboarding

**Your subscription and data are safe!** You just need to switch back to the right organization.

