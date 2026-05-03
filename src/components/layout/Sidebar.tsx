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
            { icon: Timer, label: "กะเวลา", href: "/admin/shifts" },
            { icon: Shield, label: "ผู้ดูแลระบบ", href: "/admin/admins" },
        ]
    },
    {
        title: "คำขอ/อนุมัติ",
        icon: FileCheck,
        items: [
            { icon: FileText, label: "การลา", href: "/admin/leave" },
            { icon: Clock, label: "ขอทำงานล่วงเวลา", href: "/admin/ot" },
            { icon: ArrowLeftRight, label: "สลับวันหยุด", href: "/admin/swap" },
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
                "fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 flex flex-col border-r border-slate-800 shadow-2xl transition-transform duration-300 ease-in-out",
                isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
            )}>
                {/* Brand/Profile Section */}
                <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-slate-950/50">
                    <div className="flex items-center gap-3 w-full">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-lg backdrop-blur-sm">
                            {adminProfile?.name?.charAt(0) || "A"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-white truncate leading-tight">{adminProfile?.name || "Admin"}</p>
                            <p className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">{adminProfile?.role || "Administrator"}</p>
                        </div>
                        <Link
                            href="/admin/settings"
                            className="p-1.5 text-white/60 hover:text-white hover:bg-white/20 rounded-lg transition-all"
                            title="ตั้งค่า"
                            onClick={onClose}
                        >
                            <Settings className="w-5 h-5" />
                        </Link>
                    </div>
                </div>

                {/* Menu Groups */}
                <nav className="flex-1 px-4 py-6 overflow-y-auto custom-scrollbar space-y-6">
                    {menuGroups.map((group) => {
                        const isOpen = openGroups.includes(group.title);
                        const groupActive = isGroupActive(group);

                        return (
                            <div key={group.title}>
                                {/* Group Header */}
                                <div className="px-2 mb-2">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        {group.title}
                                    </h3>
                                </div>

                                <div className="space-y-1">
                                    {group.items.map((item) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                onClick={onClose}
                                                className={cn(
                                                    "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group overflow-hidden",
                                                    isActive
                                                        ? "bg-[#009966] text-white shadow-md shadow-[#009966]/20 font-medium"
                                                        : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                                                )}
                                            >
                                                {/* Active Indicator Highlight */}
                                                {isActive && (
                                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-lg opacity-0" /> // Hidden for card style
                                                )}

                                                <item.icon className={cn(
                                                    "w-4 h-4 transition-transform group-hover:scale-110",
                                                    isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                                                )} />
                                                <span className="relative z-10">{item.label}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                {/* Bottom Actions */}
                <div className="p-4 border-t border-slate-800 bg-slate-950/50">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-300 bg-slate-800/50 border border-slate-700/50 hover:bg-red-500 hover:text-white hover:border-red-500 rounded-lg shadow-sm transition-all duration-200 group"
                    >
                        <LogOut className="w-4 h-4 transition-colors group-hover:text-white" />
                        <span>ออกจากระบบ</span>
                    </button>
                    <div className="mt-3 text-center">
                        <p className="text-[10px] text-slate-500 font-mono">v.5.0.0 Business Edition</p>
                    </div>
                </div>
            </aside>
        </>
    );
}
