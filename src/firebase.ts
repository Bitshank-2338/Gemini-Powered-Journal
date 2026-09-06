import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import config from "../firebase-applet-config.json";
const app = getApps().length ? getApp() : initializeApp(config);
export const auth = getAuth(app);
export const signInWithGoogle = () =>
  signInWithPopup(auth, new GoogleAuthProvider());
export const signOutUser = () => signOut(auth);
export const onAuthChange = onAuthStateChanged;
