"use client";

import { useState, useEffect } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminService, type Admin } from "@/lib/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { firebaseConfig } from "@/lib/firebase";

interface AdminFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    admin?: Admin | null;
    onSuccess: () => void;
}

export function AdminFormModal({ isOpen, onClose, admin, onSuccess }: AdminFormModalProps) {
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        role: "admin" as "admin" | "super_admin",
        lineUserId: "",
    });

    useEffect(() => {
        if (admin) {
            setFormData({
                name: admin.name || "",
                email: admin.email || "",
                password: "", // Password not shown for edit
                role: admin.role || "admin",
                lineUserId: admin.lineUserId || "",
            });
        } else {
            setFormData({
                name: "",
                email: "",
                password: "",
                role: "admin",
                lineUserId: "",
            });
        }
    }, [admin]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (admin?.id) {
                // Build update data - only include lineUserId if it has a value
                const updateData: any = {
                    name: formData.name,
                    email: formData.email,
                    role: formData.role,
                };
                // Only include lineUserId if it's not empty
                if (formData.lineUserId && formData.lineUserId.trim()) {
                    updateData.lineUserId = formData.lineUserId.trim();
                }
                await adminService.update(admin.id, updateData);
            } else {
                // Create new admin
                // 1. Create in Firebase Auth using secondary app to avoid logging out current user
                const secondaryApp = initializeApp(firebaseConfig, "Secondary");
                const secondaryAuth = getAuth(secondaryApp);

                try {
                    await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);

                    // 2. Create in Firestore - only include lineUserId if it has a value
                    const createData: any = {
                        name: formData.name,
                        email: formData.email,
                        role: formData.role,
                        createdAt: new Date(),
                    };
                    if (formData.lineUserId && formData.lineUserId.trim()) {
                        createData.lineUserId = formData.lineUserId.trim();
                    }
                    await adminService.create(createData);
                } catch (authError: any) {
                    if (authError.code === 'auth/email-already-in-use') {
                        alert("อีเมลนี้มีผู้ใช้งานแล้วในระบบ");
                        return;
                    }
                    throw authError;
                } finally {
                    await deleteApp(secondaryApp);
                }
            }
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error saving admin:", error);
            alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white border border-slate-100 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 p-6 flex items-center justify-between ">
                    <h2 className="text-xl font-semibold text-slate-900">
                        {admin ? "แก้ไขผู้ดูแลระบบ" : "เพิ่มผู้ดูแลระบบ"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                ชื่อ-นามสกุล <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#009966]/20 focus:border-[#009966] transition-all placeholder:text-slate-400"
                                placeholder="กรอกชื่อ-นามสกุล"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                อีเมล <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#009966]/20 focus:border-[#009966] transition-all placeholder:text-slate-400 disabled:opacity-50 disabled:bg-slate-50"
                                placeholder="example@email.com"
                                required
                                disabled={!!admin} // Disable email edit for existing admins
                            />
                        </div>

                        {!admin && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    รหัสผ่าน <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#009966]/20 focus:border-[#009966] transition-all placeholder:text-slate-400 pr-12"
                                        placeholder="ตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร"
                                        required
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                บทบาท <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#009966]/20 focus:border-[#009966] transition-all"
                                required
                            >
                                <option value="admin">Admin</option>
                                <option value="super_admin">Super Admin</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                LINE User ID
                                <span className="text-slate-400 text-xs ml-2">(สำหรับ Auto Login ผ่าน LINE)</span>
                            </label>
                            <input
                                type="text"
                                value={formData.lineUserId}
                                onChange={(e) => setFormData({ ...formData, lineUserId: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#009966]/20 focus:border-[#009966] transition-all placeholder:text-slate-400"
                                placeholder="U1234567890abcdef..."
                            />
                            <p className="text-xs text-slate-400 mt-1">ใส่ LINE User ID เพื่อให้ Admin สามารถ Login อัตโนมัติเมื่อเปิดผ่าน LINE</p>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-10 rounded-md text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                            disabled={loading}
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            className="flex-1 h-10 bg-[#009966] hover:bg-[#008f60] text-white rounded-md text-sm font-medium transition-all shadow-md shadow-[#009966]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading}
                        >
                            {loading ? "กำลังบันทึก..." : admin ? "บันทึกการแก้ไข" : "เพิ่มผู้ดูแลระบบ"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
