"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Lock, Mail, AlertCircle } from "lucide-react";
import { adminService } from "@/lib/firestore";

export default function AdminLoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

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

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#F5F2ED] via-[#EBDACA] to-[#F5F2ED] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo/Header */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-[#000000] rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-lg">
                        <Lock className="w-10 h-10 text-white" />
                    </div>
                    <p className="text-gray-600">เข้าสู่ระบบจัดการ CHECKINOUT</p>
                </div>

                {/* Login Form */}
                <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
                    <form onSubmit={handleLogin} className="space-y-6">
                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}

                        {/* Email Input */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                อีเมล
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent transition-all"
                                    placeholder="admin@example.com"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                รหัสผ่าน
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        {/* Remember Me & Forgot Password */}
                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-gray-300 text-[#000000] focus:ring-[#EBDACA]"
                                />
                                <span className="text-gray-600">จดจำฉันไว้</span>
                            </label>
                            <a href="#" className="text-[#000000] hover:underline">
                                ลืมรหัสผ่าน?
                            </a>
                        </div>

                        {/* Login Button */}
                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-[#000000] hover:bg-[#000000]/90 text-white rounded-xl font-medium text-base shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    กำลังเข้าสู่ระบบ...
                                </div>
                            ) : (
                                "เข้าสู่ระบบ"
                            )}
                        </Button>
                    </form>

                    {/* Divider */}
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white text-gray-500">หรือ</span>
                        </div>
                    </div>

                    {/* Additional Info */}
                    <p className="text-center text-sm text-gray-600">
                        ต้องการความช่วยเหลือ?{" "}
                        <a href="#" className="text-[#000000] font-medium hover:underline">
                            ติดต่อผู้ดูแลระบบ
                        </a>
                    </p>
                </div>

                {/* Footer */}
                <p className="text-center text-sm text-gray-600 mt-6">
                    © 2025 CHECKINOUT. All rights reserved.
                </p>
            </div>
        </div>
    );
}
