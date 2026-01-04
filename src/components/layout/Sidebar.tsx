"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    Search,
    Table,
    Users,
    FileText,
    Clock,
    BarChart2,
    HelpCircle,
    LogOut,
    Settings,
    Calculator,
    Shield,
    Timer,
    ArrowLeftRight,
    FileBarChart,
    ClipboardList,
    ChevronDown,
    Database,
    UserCog,
    FileCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAdmin } from "@/components/auth/AuthProvider";

interface MenuItem {
    icon: any;
    label: string;
    href: string;
}

interface MenuGroup {
    title: string;
    icon: any;
    items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
    {
        title: "ข้อมูล",
        icon: Database,
        items: [
            { icon: Search, label: "ค้นหา", href: "/admin/search" },
            { icon: Table, label: "ตารางข้อมูล", href: "/admin" },
            { icon: ClipboardList, label: "สรุปรายวัน", href: "/admin/summary" },
        ]
    },
    {
        title: "จัดการ",
        icon: UserCog,
        items: [
            { icon: Users, label: "พนักงาน", href: "/admin/employee" },
            { icon: Shield, label: "ผู้ดูแลระบบ", href: "/admin/admins" },
            { icon: Timer, label: "กะเวลาทำงาน", href: "/admin/shifts" },
        ]
    },
    {
        title: "คำขอ/อนุมัติ",
        icon: FileCheck,
        items: [
            { icon: FileText, label: "การลา", href: "/admin/leave" },
            { icon: Clock, label: "ขอทำงานล่วงเวลา", href: "/admin/ot" },
        ]
    },
    {
        title: "รายงาน",
        icon: BarChart2,
        items: [
            { icon: BarChart2, label: "ภาพรวม", href: "/admin/analytics" },
            { icon: FileBarChart, label: "รายงานละเอียด", href: "/admin/reports" },
            { icon: Calculator, label: "เงินเดือน", href: "/admin/payroll" },
        ]
    },
];

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
    const pathname = usePathname();
    const router = useRouter();
    const { adminProfile } = useAdmin();
    const [openGroups, setOpenGroups] = useState<string[]>(["ข้อมูล", "จัดการ", "คำขอ/อนุมัติ", "รายงาน"]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push("/admin/login");
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    const toggleGroup = (title: string) => {
        setOpenGroups(prev =>
            prev.includes(title)
                ? prev.filter(g => g !== title)
                : [...prev, title]
        );
    };

    const isGroupActive = (group: MenuGroup) => {
        return group.items.some(item => pathname === item.href);
    };

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={onClose}
                />
            )}

            <aside className={cn(
                "fixed inset-y-0 left-0 z-50 w-64 bg-background flex flex-col border-r border-gray-200 transition-transform duration-300 ease-in-out",
                isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
            )}>
                {/* Profile Section */}
                <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden relative">
                            <div className="w-full h-full bg-emerald-600 flex items-center justify-center text-white font-bold">
                                {adminProfile?.name?.charAt(0) || "A"}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">ยินดีต้อนรับ,</p>
                            <p className="font-bold text-gray-800 truncate max-w-[100px]">{adminProfile?.name || "Admin"}</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{adminProfile?.role || "Guest"}</p>
                        </div>
                    </div>
                    <Link
                        href="/admin/settings"
                        className="p-2 bg-primary-dark rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
                        title="ตั้งค่า"
                        onClick={onClose}
                    >
                        <Settings className="w-4 h-4 text-gray-100" />
                    </Link>
                </div>

                {/* Menu Groups */}
                <nav className="flex-1 px-3 py-2 overflow-y-auto">
                    {menuGroups.map((group) => {
                        const isOpen = openGroups.includes(group.title);
                        const groupActive = isGroupActive(group);

                        return (
                            <div key={group.title} className="mb-2">
                                {/* Group Header */}
                                <button
                                    onClick={() => toggleGroup(group.title)}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                        groupActive
                                            ? "text-emerald-800 bg-white/30"
                                            : "text-emerald-900/70 hover:bg-white/20"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <group.icon className="w-4 h-4" />
                                        <span>{group.title}</span>
                                    </div>
                                    <ChevronDown className={cn(
                                        "w-4 h-4 transition-transform",
                                        isOpen ? "rotate-180" : ""
                                    )} />
                                </button>

                                {/* Group Items */}
                                {isOpen && (
                                    <div className="mt-1 ml-3 space-y-0.5">
                                        {group.items.map((item) => {
                                            const isActive = pathname === item.href;
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    onClick={onClose}
                                                    className={cn(
                                                        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                                                        isActive
                                                            ? "bg-white text-emerald-900 shadow-sm font-medium"
                                                            : "text-emerald-900/60 hover:bg-white/50 hover:text-emerald-900"
                                                    )}
                                                >
                                                    <item.icon className={cn("w-4 h-4", isActive ? "text-emerald-600" : "")} />
                                                    {item.label}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* Bottom Actions */}
                <div className="p-4 bg-gray-200 border-t border-gray-200/50">

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                        <LogOut className="w-5 h-5 text-gray-400" />
                        ออกจากระบบ
                    </button>
                </div>
            </aside>
        </>
    );
}
