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
    });

    useEffect(() => {
        if (admin) {
            setFormData({
                name: admin.name || "",
                email: admin.email || "",
                password: "", // Password not shown for edit
                role: admin.role || "admin",
            });
        } else {
            setFormData({
                name: "",
                email: "",
                password: "",
                role: "admin",
            });
        }
    }, [admin]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (admin?.id) {
                await adminService.update(admin.id, {
                    name: formData.name,
                    email: formData.email,
                    role: formData.role
                });
            } else {
                // Create new admin
                // 1. Create in Firebase Auth using secondary app to avoid logging out current user
                const secondaryApp = initializeApp(firebaseConfig, "Secondary");
                const secondaryAuth = getAuth(secondaryApp);

                try {
                    await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);

                    // 2. Create in Firestore
                    await adminService.create({
                        name: formData.name,
                        email: formData.email,
                        role: formData.role,
                        createdAt: new Date(),
                    });
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between rounded-t-3xl">
                    <h2 className="text-2xl font-bold text-gray-800">
                        {admin ? "แก้ไขผู้ดูแลระบบ" : "เพิ่มผู้ดูแลระบบ"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                ชื่อ-นามสกุล <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                                placeholder="กรอกชื่อ-นามสกุล"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                อีเมล <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                                placeholder="example@email.com"
                                required
                                disabled={!!admin} // Disable email edit for existing admins
                            />
                        </div>

                        {!admin && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    รหัสผ่าน <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent pr-12"
                                        placeholder="ตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร"
                                        required
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                บทบาท <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                                required
                            >
                                <option value="admin">Admin</option>
                                <option value="super_admin">Super Admin</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            onClick={onClose}
                            variant="outline"
                            className="flex-1 h-12 rounded-xl"
                            disabled={loading}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 h-12 bg-[#553734] hover:bg-[#553734]/90 text-white rounded-xl"
                            disabled={loading}
                        >
                            {loading ? "กำลังบันทึก..." : admin ? "บันทึกการแก้ไข" : "เพิ่มผู้ดูแลระบบ"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
