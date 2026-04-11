"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Lock, Mail, AlertCircle, Loader2 } from "lucide-react";
import { adminService } from "@/lib/firestore";
import useAdminLiffAuth from "@/hooks/useAdminLiffAuth";

export default function AdminLoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // LINE Auto Login hook
    const {
        loading: liffLoading,
        error: liffError,
        isInLineApp,
        adminProfile,
        needsLink,
        linkProfile,
        loginWithLine
    } = useAdminLiffAuth();

    // Auto redirect if logged in via LINE
    useEffect(() => {
        if (adminProfile && !liffLoading) {
            console.log("Admin logged in via LINE:", adminProfile);
            router.push("/admin");
        }
    }, [adminProfile, liffLoading, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);

            // Update last login
            const admin = await adminService.getByEmail(email);
            if (admin && admin.id) {
                await adminService.update(admin.id, { lastLogin: new Date() });
            }

            router.push("/admin");
        } catch (err: any) {
            console.error("Login error:", err);
            if (err.code === "auth/invalid-credential") {
                setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
            } else if (err.code === "auth/user-not-found") {
                setError("ไม่พบผู้ใช้งานนี้");
            } else if (err.code === "auth/wrong-password") {
                setError("รหัสผ่านไม่ถูกต้อง");
            } else {
                setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLineLogin = async () => {
        setLoading(true);
        try {
            await loginWithLine();
        } catch (err) {
            setError("ไม่สามารถเชื่อมต่อ LINE ได้");
            setLoading(false);
        }
    };

    // Show loading while LIFF is initializing (only in LINE browser)
    if (isInLineApp && liffLoading) {
        return (
            <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-slate-200 border border-gray-100">
                        <Loader2 className="w-8 h-8 text-slate-900 animate-spin" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Connecting...</h2>
                    <p className="text-gray-500 text-sm">Please wait while we log you in via LINE</p>
                </div>
            </div>
        );
    }

    // Show message if LINE account is not linked to any admin
    if (isInLineApp && needsLink) {
        return (
            <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4 font-sans">
                <div className="w-full max-w-[400px]">
                    <div className="bg-white rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 p-8">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-100">
                                <AlertCircle className="w-8 h-8 text-amber-600" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-900 mb-2">Account Not Linked</h2>
                            <p className="text-gray-500 text-sm">
                                This LINE account ({linkProfile?.displayName || 'Unknown'}) is not linked to any admin user.
                            </p>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100 text-center">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Your LINE User ID
                            </p>
                            <code className="text-xs bg-white px-3 py-2 rounded-lg border border-gray-200 font-mono text-slate-700 break-all block shadow-sm">
                                {linkProfile?.lineId || '-'}
                            </code>
                        </div>

                        <p className="text-xs text-gray-500 text-center mb-4 leading-relaxed">
                            Please contact a Super Admin to add this LINE User ID to your admin profile.
                        </p>

                        <div className="border-t border-gray-100 pt-4 mt-6">
                            <p className="text-xs text-gray-400 text-center">
                                Or try logging in with Email/Password via a standard browser.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Normal Login page (works in both LINE browser and normal browser)
    return (
        <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-[400px]">


                {/* Login Card */}
                <div className="bg-white rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 p-8">
                    {/* LINE Login Button */}
                    {isInLineApp && (
                        <div className="mb-6">
                            <Button
                                type="button"
                                onClick={handleLineLogin}
                                disabled={loading}
                                className="w-full h-11 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19.365 9.863c.349 0 .63.285.631.631 0 .345-.282.631-.631.631h-2.466v1.457h2.466c.349 0 .631.283.631.63 0 .349-.282.631-.631.631h-3.096c-.349 0-.63-.282-.63-.631V8.102c0-.349.281-.631.63-.631h3.096c.349 0 .631.282.631.631 0 .346-.282.631-.631.631h-2.466v1.13h2.466zm-6.171 3.349c.018.349-.263.635-.612.635-.175 0-.335-.064-.458-.186l-3.106-3.423v2.908c0 .349-.282.631-.631.631-.349 0-.631-.282-.631-.631V8.102c0-.349.282-.631.631-.631.163 0 .31.061.424.166l3.117 3.434V8.102c0-.349.282-.631.631-.631.349 0 .631.282.631.631v5.11h.004zm-6.844.635c-.349 0-.631-.282-.631-.631V8.102c0-.349.282-.631.631-.631.349 0 .631.282.631.631v5.114c0 .349-.282.631-.631.631zm-2.035-.631V8.102c0-.349.282-.631.631-.631.349 0 .631.282.631.631v5.114c0 .349-.282.631-.631.631h-3.096c-.349 0-.631-.282-.631-.631 0-.349.282-.631.631-.631h2.465zM24 11.4C24 5.103 18.627 0 12 0S0 5.103 0 11.4c0 5.636 4.998 10.358 11.753 11.26.458.099 1.081.303 1.238.694.141.356.093.914.046 1.273l-.199 1.2c-.061.374-.284 1.466 1.285.799 1.569-.666 8.475-4.994 11.565-8.548l-.001.001C23.28 15.2 24 13.378 24 11.4z" />
                                    </svg>
                                )}
                                <span className="font-semibold">Log in with LINE</span>
                            </Button>

                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-gray-100"></span>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-white px-2 text-gray-400 font-medium">Or continue with</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        {/* Error Message */}
                        {(error || liffError) && (
                            <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-3">
                                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-xs font-medium text-red-600">{error || liffError}</p>
                            </div>
                        )}

                        {/* Email Input */}
                        <div className="space-y-1.5">
                            <label htmlFor="email" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                Email
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-4 w-4 text-gray-400 group-focus-within:text-slate-600 transition-colors" />
                                </div>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 placeholder-gray-400 transition-all font-medium text-gray-900"
                                    placeholder="name@company.com"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-1.5">
                            <label htmlFor="password" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                Password
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-4 w-4 text-gray-400 group-focus-within:text-slate-600 transition-colors" />
                                </div>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 placeholder-gray-400 transition-all font-medium text-gray-900"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <input
                                    id="remember-me"
                                    name="remember-me"
                                    type="checkbox"
                                    className="h-4 w-4 text-slate-900 focus:ring-slate-900 border-gray-300 rounded"
                                />
                                <label htmlFor="remember-me" className="ml-2 block text-xs text-gray-600">
                                    Remember me
                                </label>
                            </div>
                            <div className="text-xs">
                                <a href="#" className="font-medium text-slate-900 hover:text-slate-700">
                                    Forgot password?
                                </a>
                            </div>
                        </div>

                        {/* Login Button */}
                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-sm shadow-md shadow-slate-900/10 transition-all disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Signing in...</span>
                                </div>
                            ) : (
                                "Sign in"
                            )}
                        </Button>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-gray-400 mt-8">
                    &copy; {new Date().getFullYear()} Check In-Out System. All rights reserved.
                </p>
            </div>
        </div>
    );
}
