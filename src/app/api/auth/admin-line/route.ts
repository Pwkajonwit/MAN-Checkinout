import { NextResponse } from 'next/server';
import admin, { isFirebaseAdminReady } from '@/lib/firebaseAdmin';

/**
 * POST /api/auth/admin-line
 * Exchange LINE access token for Firebase custom token (Admin only)
 * 
 * Body: { accessToken: string }
 * Response: { customToken: string, adminProfile: {...} } | { needsLink: true, profile: {...} } | { error: string }
 */
export async function POST(request: Request) {
    try {
        console.log('[Admin LINE Auth] Starting authentication request');

        // Verify Firebase Admin is initialized
        if (!isFirebaseAdminReady()) {
            console.error('[Admin LINE Auth] Firebase Admin not initialized!');
            return NextResponse.json(
                { error: 'Server configuration error', details: 'Firebase Admin not initialized' },
                { status: 500 }
            );
        }

        const { accessToken } = await request.json();

        if (!accessToken) {
            return NextResponse.json(
                { error: 'Missing accessToken' },
                { status: 400 }
            );
        }

        // For mock tokens in development
        if (accessToken === 'MOCK_ACCESS_TOKEN') {
            console.log('[Admin LINE Auth] Mock access token detected');

            const mockLineId = 'U_ADMIN_MOCK_1234567890';
            const db = admin.firestore();

            try {
                // Try to find admin by lineUserId
                const adminsRef = db.collection('admins');
                const snapshot = await adminsRef.where('lineUserId', '==', mockLineId).limit(1).get();

                if (snapshot.empty) {
                    return NextResponse.json({
                        needsLink: true,
                        profile: {
                            lineId: mockLineId,
                            displayName: 'Mock Admin',
                        }
                    });
                }

                const adminDoc = snapshot.docs[0];
                const adminData = adminDoc.data();

                // Create custom token using admin email (Firebase Auth UID)
                const customToken = await admin.auth().createCustomToken(adminDoc.id);

                return NextResponse.json({
                    customToken,
                    adminProfile: {
                        id: adminDoc.id,
                        ...adminData,
                    }
                });

            } catch (error: any) {
                console.error('Mock admin auth error:', error);
                return NextResponse.json(
                    { error: 'Authentication failed', details: error.message },
                    { status: 500 }
                );
            }
        }

        // Real LINE token flow
        // Verify the LINE access token by calling LINE API
        const lineResponse = await fetch('https://api.line.me/v2/profile', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        if (!lineResponse.ok) {
            console.error('[Admin LINE Auth] LINE API error:', lineResponse.status);
            return NextResponse.json(
                { error: 'Invalid LINE access token' },
                { status: 401 }
            );
        }

        const lineProfile = await lineResponse.json();
        const lineId = lineProfile.userId;

        console.log('[Admin LINE Auth] LINE profile received:', lineId);

        // Check if admin exists in Firestore with this LINE ID
        const db = admin.firestore();
        const adminsRef = db.collection('admins');
        const snapshot = await adminsRef.where('lineUserId', '==', lineId).limit(1).get();

        if (snapshot.empty) {
            // No admin found with this LINE ID - not authorized
            console.log('[Admin LINE Auth] No admin found with LINE ID:', lineId);
            return NextResponse.json({
                needsLink: true,
                profile: {
                    lineId: lineId,
                    displayName: lineProfile.displayName,
                    pictureUrl: lineProfile.pictureUrl
                }
            });
        }

        // Admin found - create custom token
        const adminDoc = snapshot.docs[0];
        const adminData = adminDoc.data();

        console.log('[Admin LINE Auth] Admin found:', adminDoc.id, adminData.email);

        // Update last login
        await adminDoc.ref.update({
            lastLogin: admin.firestore.FieldValue.serverTimestamp()
        });

        // Get the Firebase Auth user by email to use their UID for custom token
        let uid = adminDoc.id;
        try {
            const userRecord = await admin.auth().getUserByEmail(adminData.email);
            uid = userRecord.uid;
        } catch (e) {
            console.log('[Admin LINE Auth] Using Firestore doc ID as UID');
        }

        const customToken = await admin.auth().createCustomToken(uid);

        return NextResponse.json({
            customToken,
            adminProfile: {
                id: adminDoc.id,
                email: adminData.email,
                name: adminData.name,
                role: adminData.role,
            }
        });

    } catch (error: any) {
        console.error('[Admin LINE Auth] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
