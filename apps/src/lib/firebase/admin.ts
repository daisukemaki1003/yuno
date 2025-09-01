import {
  getApps,
  initializeApp as initializeAdminApp,
} from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { credential } from "firebase-admin";

const firebaseConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  privateKey: process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  ),
  clientEmail: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL,
};

// Initialize Firebase Admin SDK (server-side only)
if (!getApps().length) {
  initializeAdminApp({
    credential: credential.cert(firebaseConfig),
  });
}

export const adminAuth = getAdminAuth();
