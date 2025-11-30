"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isLoginPage = pathname === "/admin/login";
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <AuthProvider>
            <div className="min-h-screen bg-[#F5F6FA]">
                {!isLoginPage && (
                    <>
                        {/* Mobile Header */}
                        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b sticky top-0 z-40">
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <Menu className="w-6 h-6 text-gray-600" />
                            </button>
                            <span className="font-bold text-gray-800">CheckInOut Admin</span>
                            <div className="w-10" /> {/* Spacer for centering */}
                        </div>

                        <Sidebar
                            isOpen={isSidebarOpen}
                            onClose={() => setIsSidebarOpen(false)}
                        />
                    </>
                )}
                <main className={isLoginPage ? "min-h-screen" : "md:pl-64 min-h-screen transition-all duration-300"}>
                    <div className={isLoginPage ? "" : "p-4 md:p-8 max-w-7xl mx-auto"}>
                        {children}
                    </div>
                </main>
            </div>
        </AuthProvider>
    );
}
