import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

const serviceAccount =
  projectId && clientEmail && privateKey
    ? {
        projectId,
        clientEmail,
        privateKey,
      }
    : null;

const firebaseApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp(
        serviceAccount
          ? {
              credential: cert(serviceAccount),
              projectId,
            }
          : {
              credential: applicationDefault(),
              projectId,
            }
      );

export const firebaseAuth = getAuth(firebaseApp);
export const firebaseDb = getFirestore(firebaseApp);

export const FIREBASE_COLLECTIONS = {
  users: "users",
  businesses: "businesses",
  services: "services",
  professionals: "professionals",
  businessHours: "businessHours",
  appointments: "appointments",
} as const;
