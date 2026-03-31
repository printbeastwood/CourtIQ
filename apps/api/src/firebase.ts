import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

let firebaseAuth: Auth | null = null;

export function initFirebase(): Auth {
  if (firebaseAuth) return firebaseAuth;

  if (getApps().length === 0) {
    const projectId = process.env["FIREBASE_PROJECT_ID"];
    const clientEmail = process.env["FIREBASE_CLIENT_EMAIL"];
    const privateKey = process.env["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n");

    if (projectId && clientEmail && privateKey) {
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    } else if (projectId) {
      // Application Default Credentials (e.g. on GCP / Fly.io with service account)
      initializeApp({ projectId });
    } else {
      throw new Error(
        "Firebase configuration missing. Set FIREBASE_PROJECT_ID (+ FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY for service account auth)"
      );
    }
  }

  firebaseAuth = getAuth();
  return firebaseAuth;
}

export function getFirebaseAuth(): Auth {
  if (!firebaseAuth) {
    throw new Error("Firebase not initialized. Call initFirebase() first.");
  }
  return firebaseAuth;
}
