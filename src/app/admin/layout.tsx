"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { usePathname } from "next/navigation";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isLoginPage = pathname === "/admin/login";

    return (
        <AuthProvider>
            <div className="min-h-screen bg-[#F5F6FA]">
                {!isLoginPage && <Sidebar />}
                <main className={isLoginPage ? "min-h-screen" : "pl-64 min-h-screen"}>
                    <div className={isLoginPage ? "" : "p-8 max-w-7xl mx-auto"}>
                        {children}
                    </div>
                </main>
            </div>
        </AuthProvider>
    );
}
