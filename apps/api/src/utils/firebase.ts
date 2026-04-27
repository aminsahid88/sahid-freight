import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
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
