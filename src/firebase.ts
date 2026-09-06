import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  onIdTokenChanged,
  type User,
} from "firebase/auth";
import config from "../firebase-applet-config.json";

const app = getApps().length ? getApp() : initializeApp(config);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export const checkRedirectResult = () => getRedirectResult(auth);
export const signInWithGooglePopup = () => signInWithPopup(auth, googleProvider);
export const signInWithGoogleRedirect = () => signInWithRedirect(auth, googleProvider);
export const signOutUser = () => signOut(auth);
export const onAuthChange = onAuthStateChanged;
export const onTokenChange = (cb: (user: User | null) => void) => onIdTokenChanged(auth, cb);
