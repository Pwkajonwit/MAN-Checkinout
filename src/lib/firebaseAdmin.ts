import admin from 'firebase-admin';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const hasCredentials = projectId && clientEmail && privateKey;

if (!admin.apps.length && hasCredentials) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
    } catch (error) {
        console.error('Firebase Admin initialization error:', error);
    }
}

// Helper function สำหรับตรวจสอบว่า Firebase Admin พร้อมใช้งานหรือไม่
function isFirebaseAdminReady(): boolean {
    return admin.apps.length > 0;
}

export { isFirebaseAdminReady };
export default admin;
