"use client";

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
    Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

const menuItems = [
    { icon: Search, label: "Search", href: "/admin/search" },
    { icon: Table, label: "Data Table", href: "/admin" },
    { icon: Users, label: "Employee", href: "/admin/employee" },
    { icon: Shield, label: "Admins", href: "/admin/admins" },
    { icon: FileText, label: "Leave", href: "/admin/leave" },
    { icon: Clock, label: "OT", href: "/admin/ot" },
    { icon: BarChart2, label: "Analytics", href: "/admin/analytics" },
    { icon: Calculator, label: "เงินเดือน", href: "/admin/payroll" },
];

import { useAdmin } from "@/components/auth/AuthProvider";

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
    const pathname = usePathname();
    const router = useRouter();
    const { adminProfile } = useAdmin();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push("/admin/login");
        } catch (error) {
            console.error("Logout error:", error);
        }
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
                "fixed inset-y-0 left-0 z-50 w-64 bg-[#F5F2ED] flex flex-col border-r border-gray-200 transition-transform duration-300 ease-in-out",
                isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
            )}>
                {/* Profile Section */}
                <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden relative">
                            {/* Placeholder for user image */}
                            <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white font-bold">
                                {adminProfile?.name?.charAt(0) || "A"}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Welcome back,</p>
                            <p className="font-bold text-gray-800 truncate max-w-[100px]">{adminProfile?.name || "Admin"}</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{adminProfile?.role || "Guest"}</p>
                        </div>
                    </div>
                    <Link
                        href="/admin/settings"
                        className="p-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
                        title="ตั้งค่า"
                        onClick={onClose}
                    >
                        <Settings className="w-4 h-4 text-gray-500" />
                    </Link>
                </div>

                {/* Menu Items */}
                <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onClose}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-white text-gray-900 shadow-sm"
                                        : "text-gray-500 hover:bg-white/50 hover:text-gray-900"
                                )}
                            >
                                <item.icon className={cn("w-5 h-5", isActive ? "text-gray-900" : "text-gray-400")} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom Actions */}
                <div className="p-4 space-y-1 border-t border-gray-200/50">
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-white/50 rounded-xl transition-colors">
                        <HelpCircle className="w-5 h-5 text-gray-400" />
                        Support
                    </button>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                        <LogOut className="w-5 h-5 text-gray-400" />
                        Sign Out
                    </button>
                </div>
            </aside>
        </>
    );
}
