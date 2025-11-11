// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserSessionPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCjsUafI6z16Yvc1W4DFKCQnczP1-bB0Tk",
  authDomain: "trackview-6a3a5.firebaseapp.com",
  projectId: "trackview-6a3a5",
  storageBucket: "trackview-6a3a5.firebasestorage.app",
  messagingSenderId: "1049268627677",
  appId: "1:1049268627677:web:71253848a8e500ade15334"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);

// Session persistence - auth stored in sessionStorage
// Survives page navigation/refresh but clears when browser closes
// This is privacy-friendly and works with both popup and redirect auth
setPersistence(auth, browserSessionPersistence)
  .then(() => {
    console.log('✅ Firebase Auth persistence set to SESSION');
    console.log('ℹ️  Auth will persist during your session but clear when browser closes');
  })
  .catch((error) => {
    console.error('❌ Failed to set auth persistence:', error);
  });

export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize Analytics only in browser environment
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}
export { analytics };

export default app;

