"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminFormModal } from "@/components/admin/AdminFormModal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { adminService, type Admin } from "@/lib/firestore";
import { useAdmin } from "@/components/auth/AuthProvider";

export default function AdminsPage() {
    const { isSuperAdmin } = useAdmin();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loading, setLoading] = useState(true);

    const loadAdmins = async () => {
        try {
            const data = await adminService.getAll();
            setAdmins(data);
        } catch (error) {
            console.error("Error loading admins:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAdmins();
    }, []);

    const handleAddAdmin = () => {
        setSelectedAdmin(null);
        setIsModalOpen(true);
    };

    const handleEditAdmin = (admin: Admin) => {
        setSelectedAdmin(admin);
        setIsModalOpen(true);
    };

    const handleDeleteAdmin = async (admin: Admin) => {
        try {
            if (admin.id) {
                await adminService.delete(admin.id);
                await loadAdmins();
            }
        } catch (error) {
            console.error("Error deleting admin:", error);
            alert("เกิดข้อผิดพลาดในการลบผู้ดูแลระบบ");
        }
    };

    const handleSuccess = () => {
        loadAdmins();
    };

    const stats = {
        total: admins.length,
        superAdmin: admins.filter(a => a.role === "super_admin").length,
        admin: admins.filter(a => a.role === "admin").length,
    };

    return (
        <div>
            <PageHeader
                title="ผู้ดูแลระบบ"
                subtitle={`${admins.length} users found`}
                searchPlaceholder="Search admins..."
                action={
                    isSuperAdmin ? (
                        <Button
                            onClick={handleAddAdmin}
                            className="bg-primary-dark hover:bg-primary-dark/90 text-white rounded-xl px-6 gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            เพิ่มผู้ดูแลระบบ
                        </Button>
                    ) : null
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatsCard
                    title="ทั้งหมด"
                    value={stats.total}
                    className="ring ring-gray-500 bg-gray-50"
                />
                <StatsCard
                    title="Super Admin"
                    value={stats.superAdmin}
                    className="ring ring-purple-500 bg-purple-50"
                />
                <StatsCard
                    title="Admin"
                    value={stats.admin}
                    className="ring ring-blue-500 bg-blue-50"
                />
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="w-12 h-12 border-4 border-[#EBDACA] border-t-[#553734] rounded-full animate-spin mx-auto"></div>
                    <p className="text-gray-600 mt-4">กำลังโหลดข้อมูล...</p>
                </div>
            ) : (
                <AdminTable
                    admins={admins}
                    onEdit={handleEditAdmin}
                    onDelete={handleDeleteAdmin}
                    canManage={isSuperAdmin}
                />
            )}

            <AdminFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                admin={selectedAdmin}
                onSuccess={handleSuccess}
            />
        </div>
    );
}
