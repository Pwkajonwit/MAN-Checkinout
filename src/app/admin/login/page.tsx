"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { adminService } from "@/lib/firestore";
import useAdminLiffAuth from "@/hooks/useAdminLiffAuth";

export default function AdminLoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const {
        loading: liffLoading,
        error: liffError,
        isInLineApp,
        adminProfile,
        needsLink,
        linkProfile,
        loginWithLine,
    } = useAdminLiffAuth();

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

            const admin = await adminService.getByEmail(email);
            if (admin && admin.id) {
                await adminService.update(admin.id, { lastLogin: new Date() });
            }

            router.push("/admin");
        } catch (err: unknown) {
            console.error("Login error:", err);
            const errorCode = err instanceof FirebaseError ? err.code : "";
            if (errorCode === "auth/invalid-credential") {
                setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
            } else if (errorCode === "auth/user-not-found") {
                setError("ไม่พบบัญชีผู้ใช้นี้");
            } else if (errorCode === "auth/wrong-password") {
                setError("รหัสผ่านไม่ถูกต้อง");
            } else {
                setError("เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLineLogin = async () => {
        setError("");
        setLoading(true);
        try {
            await loginWithLine();
        } catch {
            setError("ไม่สามารถเชื่อมต่อ LINE ได้");
            setLoading(false);
        }
    };

    if (isInLineApp && liffLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white px-6">
                <div className="text-center">
                    <Loader2 className="mx-auto h-7 w-7 animate-spin text-zinc-900" />
                    <h2 className="mt-4 text-base font-semibold text-zinc-950">กำลังเชื่อมต่อ LINE</h2>
                    <p className="mt-1 text-sm text-zinc-500">ระบบกำลังตรวจสอบสิทธิ์ผู้ดูแล</p>
                </div>
            </div>
        );
    }

    if (isInLineApp && needsLink) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white px-6">
                <div className="w-full max-w-sm">
                    <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                        <AlertCircle className="h-5 w-5" />
                    </div>
                    <h1 className="text-2xl font-semibold text-zinc-950">ยังไม่ได้เชื่อมบัญชี</h1>
                    <p className="mt-2 text-sm text-zinc-500">
                        LINE: {linkProfile?.displayName || "Unknown"}
                    </p>

                    <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                        <p className="text-xs font-medium text-zinc-500">LINE User ID</p>
                        <code className="mt-2 block break-all text-xs text-zinc-800">
                            {linkProfile?.lineId || "-"}
                        </code>
                    </div>

                    <p className="mt-5 text-sm leading-6 text-zinc-600">
                        กรุณาแจ้งผู้ดูแลระบบให้เพิ่ม LINE User ID นี้ในบัญชีแอดมินก่อนเข้าใช้งาน
                    </p>
                </div>
            </div>
        );
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-8 font-sans text-zinc-950">
            <div className="w-full max-w-[760px] overflow-hidden rounded-[18px] bg-white shadow-[0_24px_80px_rgba(24,24,27,0.14)] ring-1 ring-zinc-200/70 md:grid md:grid-cols-[46%_54%]">
                <section className="relative h-36 overflow-hidden bg-[#071321] md:h-auto" aria-label="Office building visual">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(71,113,150,0.38),transparent_34%),linear-gradient(135deg,#050b12_0%,#0e2942_45%,#163d5d_100%)]" />
                    <div className="absolute inset-0 opacity-90">
                        <div className="absolute left-[-16%] top-[-10%] h-[92%] w-[64%] skew-x-[-17deg] border-r border-white/15 bg-[#0b1e31]/80 shadow-2xl" />
                        <div className="absolute left-[12%] top-[-16%] h-[126%] w-[38%] skew-x-[-17deg] border-x border-white/12 bg-[#133453]/75" />
                        <div className="absolute left-[44%] top-[-18%] h-[132%] w-[24%] skew-x-[-17deg] border-x border-white/10 bg-[#244f74]/55" />
                        <div className="absolute left-[58%] top-[-14%] h-[126%] w-[34%] skew-x-[-17deg] border-l border-white/15 bg-[#102a43]/60" />
                        <div className="absolute bottom-[-28%] left-[-10%] h-[62%] w-[90%] rotate-[-18deg] border-t border-white/15 bg-white/5" />
                        <div className="absolute left-[4%] top-[38%] h-px w-[88%] rotate-[-18deg] bg-white/18" />
                        <div className="absolute left-[0%] top-[62%] h-px w-[72%] rotate-[-18deg] bg-white/14" />
                        <div className="absolute left-[24%] top-[-18%] h-[145%] w-px rotate-[13deg] bg-white/12" />
                        <div className="absolute left-[54%] top-[-18%] h-[145%] w-px rotate-[13deg] bg-white/15" />
                    </div>
                    <div className="absolute left-5 top-4 text-[9px] font-semibold uppercase tracking-[0.24em] text-white/70">
                        Check In-Out
                    </div>
                </section>

                <section className="px-7 py-8 sm:px-9">
                    <div className="mx-auto w-full max-w-[340px]">
                        <div className="mb-6">
                            <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em] text-zinc-950">
                                Welcome Back!
                            </h1>
                            <p className="mt-1.5 text-xs text-zinc-500">
                                Log in to start controlling everything modern with ease.
                            </p>
                        </div>

                        {isInLineApp && (
                            <div className="mb-6">
                                <Button
                                    type="button"
                                    onClick={handleLineLogin}
                                    disabled={loading}
                                    className="h-10 w-full rounded-full bg-[#06C755] text-xs font-medium text-white hover:bg-[#05b34c]"
                                >
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Login with LINE
                                </Button>
                                <div className="my-5 flex items-center gap-3">
                                    <span className="h-px flex-1 bg-zinc-200" />
                                    <span className="text-xs text-zinc-400">or</span>
                                    <span className="h-px flex-1 bg-zinc-200" />
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-3.5">
                            {(error || liffError) && (
                                <div className="flex items-start gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-2.5">
                                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                                    <p className="text-sm leading-5 text-red-700">{error || liffError}</p>
                                </div>
                            )}

                            <div>
                                <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-zinc-900">
                                    Email
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3.5 text-xs text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-950/5"
                                    placeholder="Input your email"
                                    autoComplete="email"
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-zinc-900">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3.5 pr-10 text-xs text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-950/5"
                                        placeholder="Input your password"
                                        autoComplete="current-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((value) => !value)}
                                        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-0.5 text-[11px] text-zinc-500">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-950"
                                    />
                                    Remember Me
                                </label>
                                <button type="button" className="hover:text-zinc-950">
                                    Forgot Password?
                                </button>
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                className="mt-2 h-10 w-full rounded-full bg-zinc-950 text-xs font-medium text-white shadow-none hover:bg-zinc-800 disabled:opacity-60"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Logging in
                                    </>
                                ) : (
                                    "Login"
                                )}
                            </Button>
                        </form>
                    </div>
                </section>
            </div>
        </main>
    );
}
