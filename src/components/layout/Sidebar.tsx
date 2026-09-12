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
    CalendarDays,
    BarChart2,
    LogOut,
    Settings,
    Calculator,
    Shield,
    Timer,
    ArrowLeftRight,
    FileBarChart,
    ChevronDown,
    ClipboardList,
    Database,
    UserCog,
    FileCheck,
    CircleDollarSign,
    type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAdmin } from "@/components/auth/AuthProvider";

interface MenuItem {
    icon: LucideIcon;
    label: string;
    href: string;
}

interface MenuGroup {
    title: string;
    icon: LucideIcon;
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
        title: "การเงิน",
        icon: CircleDollarSign,
        items: [
            { icon: Calculator, label: "เงินเดือน", href: "/admin/payroll" },
            { icon: CircleDollarSign, label: "ผ่อนสินค้า", href: "/admin/installments" },
        ]
    },
    {
        title: "รายงาน",
        icon: BarChart2,
        items: [
            { icon: BarChart2, label: "ภาพรวม", href: "/admin/analytics" },
            { icon: FileBarChart, label: "รายงานละเอียด", href: "/admin/reports" },
            { icon: CalendarDays, label: "สรุปรายปี", href: "/admin/yearly-summary" },
        ]
    },
];

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
    const pathname = usePathname();
    const router = useRouter();
    const { adminProfile } = useAdmin();
    const [openGroups, setOpenGroups] = useState<string[]>(["ข้อมูล"]);

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
                ? prev.filter(groupTitle => groupTitle !== title)
                : [...prev, title]
        );
    };

    const isGroupActive = (group: MenuGroup) => group.items.some(item => pathname === item.href);

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
                <nav className="flex-1 px-4 py-6 overflow-y-auto custom-scrollbar space-y-3">
                    {menuGroups.map((group) => {
                        const groupOpen = openGroups.includes(group.title);
                        const groupActive = isGroupActive(group);
                        const GroupIcon = group.icon;

                        return (
                            <div key={group.title}>
                                {/* Group Header */}
                                <button
                                    type="button"
                                    onClick={() => toggleGroup(group.title)}
                                    className={cn(
                                        "mb-1 flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm font-semibold transition-colors",
                                        groupActive
                                            ? "bg-slate-800/80 text-white"
                                            : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                                    )}
                                    aria-expanded={groupOpen}
                                >
                                    <span className="flex min-w-0 items-center gap-2.5">
                                        <span className={cn(
                                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors",
                                            groupActive
                                                ? "bg-emerald-500/15 text-emerald-300"
                                                : "text-slate-500"
                                        )}>
                                            <GroupIcon className="h-4 w-4" />
                                        </span>
                                        <span className="truncate">{group.title}</span>
                                    </span>
                                    <ChevronDown className={cn(
                                        "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                                        groupOpen ? "rotate-180" : "rotate-0",
                                        groupActive && "text-white"
                                    )} />
                                </button>

                                {groupOpen && (
                                    <div className="relative ml-[22px] pl-3.5 space-y-1 mt-1.5 mb-2.5">
                                        {/* Vertical tree line from top to center of last item */}
                                        <div className="absolute left-0 top-0 bottom-[17px] w-px bg-slate-700/70 pointer-events-none" />

                                        {group.items.map((item) => {
                                            const isActive = pathname === item.href;
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    onClick={onClose}
                                                    className={cn(
                                                        "relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 group",
                                                        isActive
                                                            ? "bg-[#009966] text-white shadow-xs font-medium"
                                                            : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 font-normal"
                                                    )}
                                                >
                                                    {/* Horizontal tree branch connector line */}
                                                    <span
                                                        className={cn(
                                                            "absolute -left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-px transition-colors pointer-events-none",
                                                            isActive
                                                                ? "bg-emerald-400"
                                                                : "bg-slate-700/70 group-hover:bg-slate-500"
                                                        )}
                                                    />

                                                    <item.icon className={cn(
                                                        "w-4 h-4 shrink-0 transition-transform group-hover:scale-105",
                                                        isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"
                                                    )} />
                                                    <span className="relative z-10 truncate">{item.label}</span>
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
                <div className="p-4 border-t border-slate-800 bg-slate-950/50">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-300 bg-slate-800/50 border border-slate-700/50 hover:bg-red-500 hover:text-white hover:border-red-500 rounded-lg shadow-sm transition-all duration-200 group"
                    >
                        <LogOut className="w-4 h-4 transition-colors group-hover:text-white" />
                        <span>ออกจากระบบ</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
