import "dotenv/config";
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import config from "../firebase-applet-config.json";
export const adminApp = getApps().length
  ? getApp()
  : initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || config.projectId,
      storageBucket: process.env.STORAGE_BUCKET || config.storageBucket,
    });
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(
  adminApp,
  process.env.FIREBASE_DATABASE_ID || config.firestoreDatabaseId || "(default)",
);
export const bucket = getStorage(adminApp).bucket();
