import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

function initFirebase(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // 1. Production Deployment: Try environment variable first
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountEnv) {
    try {
      if (!serviceAccountEnv.trim().startsWith("{")) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable does not look like a JSON object.");
      }
      const serviceAccount = JSON.parse(serviceAccountEnv);
      console.log("Firebase Admin initialized with provided service account from ENV.");
      return initializeApp({
        credential: cert(serviceAccount),
      });
    } catch (e) {
      console.error("CRITICAL: Failed to parse FIREBASE_SERVICE_ACCOUNT. Check your environment variables.", e);
    }
  }

  // 2. Local Development: Try local file
  const localKeyPath = path.resolve(process.cwd(), "firebase-service-account.json");
  if (fs.existsSync(localKeyPath)) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, "utf-8"));
      console.log("Firebase Admin initialized with local firebase-service-account.json.");
      return initializeApp({
        credential: cert(serviceAccount),
      });
    } catch (e) {
      console.error("Failed to read local firebase-service-account.json", e);
    }
  }

  console.log("FIREBASE_SERVICE_ACCOUNT not found. Defaulting to application default credentials.");
  return initializeApp();
}

const app = initFirebase();

// Export the Firestore instance
export const db = getFirestore(app);
