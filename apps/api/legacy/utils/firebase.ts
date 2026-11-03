import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Service account is loaded from FIREBASE_SERVICE_ACCOUNT_JSON (full JSON string).
// For local dev only, if the env var is unset we fall back to the gitignored file
// at src/utils/firebase-service-account.json. In production the env var must be set.
function loadServiceAccount(): admin.ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      return JSON.parse(raw) as admin.ServiceAccount;
    } catch (e) {
      console.error('❌ FIREBASE_SERVICE_ACCOUNT_JSON is set but not valid JSON');
      return null;
    }
  }

  const localPath = path.resolve(__dirname, 'firebase-service-account.json');
  if (fs.existsSync(localPath)) {
    try {
      return JSON.parse(fs.readFileSync(localPath, 'utf8')) as admin.ServiceAccount;
    } catch {
      return null;
    }
  }
  return null;
}

if (!admin.apps.length) {
  const serviceAccount = loadServiceAccount();
  if (serviceAccount) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('✅ Firebase Admin initialized');
  } else {
    console.warn('⚠️ Firebase Admin credentials missing — phone verification will not work');
  }
}

export async function verifyFirebaseToken(idToken: string): Promise<{ phone: string; uid: string }> {
  const decoded = await admin.auth().verifyIdToken(idToken);
  const phone = decoded.phone_number;
  if (!phone) throw new Error('Firebase token does not contain a phone number');
  return { phone, uid: decoded.uid };
}
