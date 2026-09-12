"use client";

import { useEffect, useState } from "react";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminFormModal } from "@/components/admin/AdminFormModal";
import { Plus, Search, Filter, ShieldCheck, Shield, Users } from "lucide-react";
import { adminService, type Admin } from "@/lib/firestore";
import { useAdmin } from "@/components/auth/AuthProvider";

export default function AdminsPage() {
    const { isSuperAdmin } = useAdmin();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState<"all" | "super_admin" | "admin">("all");

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

    const filteredAdmins = admins.filter(a => {
        if (roleFilter !== "all" && a.role !== roleFilter) return false;

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const matchName = a.name?.toLowerCase().includes(query);
            const matchEmail = a.email?.toLowerCase().includes(query);
            if (!matchName && !matchEmail) return false;
        }

        return true;
    });

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                            ผู้ดูแลระบบ
                        </h1>
                        <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            Admins
                        </span>
                        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            ทั้งหมด {stats.total} บัญชี
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm font-normal text-slate-500 mt-1">
                        จัดการบัญชีผู้ดูแลระบบ และกำหนดระดับสิทธิ์การเข้าถึง
                    </p>
                </div>
            </div>

            {/* Compact & Clean Stat Cards (Clickable Role Filters) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                {/* ทั้งหมด */}
                <div
                    onClick={() => setRoleFilter("all")}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        roleFilter === "all"
                            ? "border-slate-700 ring-2 ring-slate-100 bg-slate-50/50"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">ทั้งหมด</span>
                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">{stats.total}</div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">บัญชีผู้ดูแลทั้งหมด</div>
                </div>

                {/* Super Admin */}
                <div
                    onClick={() => setRoleFilter(roleFilter === "super_admin" ? "all" : "super_admin")}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        roleFilter === "super_admin"
                            ? "border-purple-500 ring-2 ring-purple-100 bg-purple-50/20"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">Super Admin</span>
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">{stats.superAdmin}</div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">สิทธิ์จัดการระบบเต็มรูปแบบ</div>
                </div>

                {/* Admin */}
                <div
                    onClick={() => setRoleFilter(roleFilter === "admin" ? "all" : "admin")}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        roleFilter === "admin"
                            ? "border-blue-500 ring-2 ring-blue-100 bg-blue-50/20"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">Admin</span>
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">{stats.admin}</div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">สิทธิ์ผู้ดูแลทั่วไป</div>
                </div>
            </div>

            {/* Compact Toolbar (Search, Filter Indicator & Add Button) */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-2.5 sm:p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Search Box */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อ หรือ อีเมล..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-9 pl-8 pr-7 py-1 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 w-52 sm:w-72 transition-all"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-0.5"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Filter Status Pill */}
                    <div className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 inline-flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <span>บทบาท: <span className="font-medium text-slate-800">
                            {roleFilter === "all" ? "ทั้งหมด" : roleFilter === "super_admin" ? "Super Admin" : "Admin"}
                        </span></span>
                    </div>
                </div>

                {/* Add Admin Button */}
                {isSuperAdmin && (
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={handleAddAdmin}
                            className="h-9 inline-flex items-center gap-1.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-medium shadow-xs transition-all"
                        >
                            <Plus className="w-3.5 h-3.5 shrink-0" />
                            <span>เพิ่มผู้ดูแลระบบ</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Table Container */}
            {loading ? (
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-10 text-center text-slate-500 font-normal">
                    <div className="animate-spin w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                    กำลังโหลดข้อมูลผู้ดูแลระบบ...
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden">
                    <AdminTable
                        admins={filteredAdmins}
                        onEdit={handleEditAdmin}
                        onDelete={handleDeleteAdmin}
                        canManage={isSuperAdmin}
                    />

                    {/* Table Footer */}
                    <div className="px-3.5 py-2.5 bg-slate-50/80 border-t border-slate-200 text-xs font-normal text-slate-500 flex flex-wrap items-center justify-between gap-2">
                        <span>
                            แสดงผล <span className="font-semibold text-slate-800">{filteredAdmins.length}</span> จากทั้งหมด <span className="font-semibold text-slate-800">{admins.length}</span> บัญชี
                        </span>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                            <span>Super Admin: {stats.superAdmin}</span>
                            <span>•</span>
                            <span>Admin: {stats.admin}</span>
                        </div>
                    </div>
                </div>
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
