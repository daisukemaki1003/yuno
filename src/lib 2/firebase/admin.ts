import { getApps, initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { credential } from "firebase-admin";

// Initialize Firebase Admin SDK (server-side only)
if (!getApps().length) {
  initializeAdminApp({
    credential: credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

export const adminAuth = getAdminAuth();