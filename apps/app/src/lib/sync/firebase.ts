import { getApp, getApps, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase client configuration identifies the project; it is not a secret.
// Authorization is enforced by Firebase Authentication and Firestore rules.
const app = getApps().length
  ? getApp()
  : initializeApp({
      apiKey: "AIzaSyChrPOsiRgiXDX--SMNJx-ngzg3JN1xIgI",
      appId: "1:282075925265:web:31f6bc88f4aad3f0eb9ab0",
      authDomain: "pupil-sync-2026.firebaseapp.com",
      messagingSenderId: "282075925265",
      projectId: "pupil-sync-2026",
      storageBucket: "pupil-sync-2026.firebasestorage.app",
    });

const auth = getAuth(app);
export const syncDatabase = getFirestore(app, "pupil-sync");

export function observeSyncAccount(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function registerSyncAccount(email: string, password: string): Promise<void> {
  await createUserWithEmailAndPassword(auth, email.trim(), password);
}

export async function signInSyncAccount(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function resetSyncPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signOutSyncAccount(): Promise<void> {
  await signOut(auth);
}
