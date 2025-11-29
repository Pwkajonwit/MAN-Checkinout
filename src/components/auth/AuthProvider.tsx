"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { adminService, type Admin } from "@/lib/firestore";

interface AdminContextType {
    user: User | null;
    adminProfile: Admin | null;
    loading: boolean;
    isSuperAdmin: boolean;
}

const AdminContext = createContext<AdminContextType>({
    user: null,
    adminProfile: null,
    loading: true,
    isSuperAdmin: false,
});

export const useAdmin = () => useContext(AdminContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [adminProfile, setAdminProfile] = useState<Admin | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
                try {
                    // Fetch admin profile
                    if (currentUser.email) {
                        console.log("Fetching admin profile for:", currentUser.email);
                        const profile = await adminService.getByEmail(currentUser.email);
                        console.log("Admin profile found:", profile);
                        setAdminProfile(profile);
                    }
                } catch (error) {
                    console.error("Error fetching admin profile:", error);
                }
            } else {
                setAdminProfile(null);
            }

            setLoading(false);

            // Redirect to login if not authenticated and not already on login page
            if (!currentUser && pathname !== "/admin/login") {
                router.push("/admin/login");
            }
        });

        return () => unsubscribe();
    }, [pathname, router]);

    const isSuperAdmin = adminProfile?.role === "super_admin";

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-[#EBDACA] border-t-[#553734] rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">กำลังโหลด...</p>
                </div>
            </div>
        );
    }

    // Allow access to login page even when not authenticated
    if (!user && pathname === "/admin/login") {
        return <AdminContext.Provider value={{ user, adminProfile, loading, isSuperAdmin }}>{children}</AdminContext.Provider>;
    }

    // Only render children if authenticated
    if (user) {
        return (
            <AdminContext.Provider value={{ user, adminProfile, loading, isSuperAdmin }}>
                {children}
            </AdminContext.Provider>
        );
    }

    return null;
}
