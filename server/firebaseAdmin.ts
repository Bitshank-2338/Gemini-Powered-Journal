import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import type { Request, Response, NextFunction } from 'express';
import firebaseConfig from '../firebase-applet-config.json';

const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId || 'fifa-502907';

const adminApp = getApps().length === 0 
  ? initializeApp({ projectId })
  : getApp();

export const adminAuth = getAuth(adminApp);
export const adminDb = firebaseConfig.firestoreDatabaseId
  ? getFirestore(adminApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(adminApp);

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Token is empty.' });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
    };
    next();
  } catch (err: any) {
    // Check for test mock token in non-production automated testing
    if (process.env.NODE_ENV === 'test' && token.startsWith('test-token-')) {
      const mockUid = token.replace('test-token-', '');
      req.user = {
        uid: mockUid,
        email: `${mockUid}@test.local`,
      };
      return next();
    }

    console.error('Token verification error:', err.message);
    return res.status(401).json({ 
      error: 'Invalid or expired authentication token', 
      details: err.code || err.message 
    });
  }
}
