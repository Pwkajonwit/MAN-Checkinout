"use client";

import { useState, useEffect } from 'react';

interface UseAdminLiffAuthReturn {
    loading: boolean;
    error: string | null;
    isInLineApp: boolean;
    adminProfile: any | null;
    needsLink: boolean;
    linkProfile: any | null;
    loginWithLine: () => Promise<void>;
}

export default function useAdminLiffAuth(): UseAdminLiffAuthReturn {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isInLineApp, setIsInLineApp] = useState(false);
    const [adminProfile, setAdminProfile] = useState<any | null>(null);
    const [needsLink, setNeedsLink] = useState(false);
    const [linkProfile, setLinkProfile] = useState<any | null>(null);
    const [liffObject, setLiffObject] = useState<any | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                // Check for Mock LIFF mode
                const isMockLiff = process.env.NEXT_PUBLIC_MOCK_LIFF === 'true';

                if (isMockLiff) {
                    console.log('🧪 Mock LIFF mode enabled - skipping LINE login');
                    setIsInLineApp(false);
                    setLoading(false);
                    return;
                }

                // Check if we're in LINE's in-app browser
                const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : '';
                const inLineApp = /Line/i.test(userAgent);
                setIsInLineApp(inLineApp);

                if (!inLineApp) {
                    // Not in LINE, skip LIFF initialization
                    setLoading(false);
                    return;
                }

                console.log('🔧 Detected LINE Browser, initializing LIFF for Admin...');

                // Use LIFF_ADMIN_ID if available, otherwise use main LIFF_ID
                const liffId = process.env.NEXT_PUBLIC_LIFF_ADMIN_ID || process.env.NEXT_PUBLIC_LIFF_ID;

                if (!liffId) {
                    console.error('LIFF ID not configured');
                    setError('LIFF ID not configured');
                    setLoading(false);
                    return;
                }

                // Dynamic import LIFF SDK
                const liffModule = (await import('@line/liff')).default;

                await liffModule.init({ liffId });
                setLiffObject(liffModule);

                // Check if already logged in
                if (liffModule.isLoggedIn()) {
                    await authenticateWithLine(liffModule);
                } else {
                    // Not logged in yet, show login button
                    setLoading(false);
                }

            } catch (err: any) {
                console.error('useAdminLiffAuth error:', err);
                setError(err?.message || 'Initialization error');
                setLoading(false);
            }
        };

        init();
    }, []);

    const authenticateWithLine = async (liff: any) => {
        try {
            const accessToken = liff.getAccessToken();
            if (!accessToken) {
                setError('No access token');
                setLoading(false);
                return;
            }

            // Exchange LINE access token for Firebase custom token
            const response = await fetch('/api/auth/admin-line', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken }),
            });

            if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`Auth failed: ${response.status} ${errBody}`);
            }

            const data = await response.json();

            if (data.needsLink) {
                setNeedsLink(true);
                setLinkProfile(data.profile || null);
                setLoading(false);
                return;
            }

            const { customToken, adminProfile: receivedProfile } = data;

            // Sign in with custom token
            const { signInWithCustomToken } = await import('firebase/auth');
            const { auth } = await import('@/lib/firebase');
            await signInWithCustomToken(auth, customToken);

            setAdminProfile(receivedProfile);
            setLoading(false);

        } catch (err: any) {
            console.error('authenticateWithLine error:', err);
            setError(err?.message || 'Authentication error');
            setLoading(false);
        }
    };

    const loginWithLine = async () => {
        if (liffObject) {
            // Use LIFF login - this will redirect to LINE login page
            liffObject.login({ redirectUri: window.location.href });
        } else {
            setError('LIFF not initialized');
        }
    };

    return { loading, error, isInLineApp, adminProfile, needsLink, linkProfile, loginWithLine };
}
