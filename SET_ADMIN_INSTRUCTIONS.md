# Set Admin Status for ernesto@maktubtechnologies.com

## Quick Method (Browser Console)

1. **Open your app** in the browser:
   - Production: https://www.viewtrack.app
   - Local dev: http://localhost:5173

2. **Log in** to your account (any account is fine)

3. **Open Browser Console**:
   - Chrome/Edge: `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - Firefox: `F12` or `Cmd+Option+K` (Mac) / `Ctrl+Shift+K` (Windows)
   - Safari: `Cmd+Option+C`

4. **Copy and run this code**:

```javascript
(async function() {
  const targetEmail = 'ernesto@maktubtechnologies.com';
  console.log(`Setting ${targetEmail} as admin...`);
  
  const { getFirestore, collection, query, where, getDocs, doc, updateDoc } = 
    await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
  
  const db = getFirestore();
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('email', '==', targetEmail));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    console.error('❌ User not found. Make sure they have logged in at least once.');
    return;
  }
  
  const userDoc = snapshot.docs[0];
  const userId = userDoc.id;
  
  await updateDoc(doc(db, 'users', userId), { isAdmin: true });
  
  console.log('✅ SUCCESS! User is now an admin. Refresh the page.');
  console.log('User ID:', userId);
})();
```

5. **Press Enter** to run

6. **Refresh the page** to see the admin badge appear

---

## Alternative Method (Firebase Console)

If the browser method doesn't work:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Firestore Database**
4. Navigate to the `users` collection
5. Find the document for **ernesto@maktubtechnologies.com** (search by email)
6. Click on the document
7. Click **"Add field"** or edit existing
8. Field name: `isAdmin`
9. Type: `boolean`
10. Value: `true`
11. Click **Save**

---

## Verify Admin Status

After setting admin status:

1. Log in as **ernesto@maktubtechnologies.com**
2. Go to **Settings → Profile**
3. You should see a gold **"Admin"** badge next to the Profile heading
4. You now have unlimited accounts, videos, links, and team members!

---

## Troubleshooting

**User not found?**
- Make sure `ernesto@maktubtechnologies.com` has logged in at least once
- Check the email is spelled correctly

**Permission denied?**
- Use the Firebase Console method instead
- Make sure your Firebase security rules allow reading the users collection

**Admin badge not showing?**
- Hard refresh the page (Cmd+Shift+R or Ctrl+Shift+F5)
- Clear browser cache
- Log out and log back in

