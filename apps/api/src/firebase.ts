import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

let firebaseAuth: Auth | null = null;

export function initFirebase(): Auth | null {
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
      console.log("Firebase not configured — running in dev mode (auth bypassed)");
      return null;
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
