"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Employee, employeeService } from "@/lib/firestore";
import Script from "next/script";

interface EmployeeContextType {
    employee: Employee | null;
    loading: boolean;
    lineUserId: string | null;
    lineProfile: any | null;
    refreshEmployee: () => Promise<void>;
}

const EmployeeContext = createContext<EmployeeContextType>({
    employee: null,
    loading: true,
    lineUserId: null,
    lineProfile: null,
    refreshEmployee: async () => { },
});

export function EmployeeProvider({ children }: { children: ReactNode }) {
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [loading, setLoading] = useState(true);
    const [lineUserId, setLineUserId] = useState<string | null>(null);
    const [lineProfile, setLineProfile] = useState<any | null>(null);

    const initLiff = async () => {
        try {
            // DEV MODE / MOCK LIFF: Skip LIFF and use mock data
            const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === "true";
            const isMockLiff = process.env.NEXT_PUBLIC_MOCK_LIFF === "true";

            if (isDevMode || isMockLiff) {
                console.log("🧪 Mock LIFF mode enabled - skipping LINE login for employees");
                const mockUserId = "dev_user_001";
                const mockProfile = {
                    userId: mockUserId,
                    displayName: "Dev User (ทดสอบ)",
                    pictureUrl: "",
                };
                setLineUserId(mockUserId);
                setLineProfile(mockProfile);
                await fetchEmployee(mockUserId);
                return;
            }

            // Wait for LIFF SDK to be available
            if (!window.liff) {
                console.error("LIFF SDK not loaded");
                setLoading(false);
                return;
            }

            const liff = window.liff;
            console.log("Initializing LIFF...");

            // Check if LIFF ID is available
            const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
            if (!liffId) {
                console.error("LIFF ID not found in environment variables");
                setLoading(false);
                return;
            }

            console.log("LIFF ID:", liffId);

            // Initialize LIFF
            await liff.init({ liffId });
            console.log("LIFF initialized successfully");

            // Check if user is logged in
            if (liff.isLoggedIn()) {
                console.log("User is logged in");
                const profile = await liff.getProfile();
                console.log("User profile:", profile);
                setLineUserId(profile.userId);
                setLineProfile(profile);
                await fetchEmployee(profile.userId);
            } else {
                console.log("User is not logged in");
                // For development/testing without actual LIFF login, check localStorage
                const mockId = localStorage.getItem("mockLineUserId");
                if (mockId) {
                    console.log("Using mock ID:", mockId);
                    setLineUserId(mockId);
                    // Try to get mock profile from localStorage
                    const mockProfileStr = localStorage.getItem("mockLineProfile");
                    if (mockProfileStr) {
                        try {
                            const mockProfile = JSON.parse(mockProfileStr);
                            setLineProfile(mockProfile);
                        } catch (e) {
                            console.error("Error parsing mock profile:", e);
                        }
                    }
                    await fetchEmployee(mockId);
                } else {
                    // Auto login if not in LIFF browser
                    if (!liff.isInClient()) {
                        console.log("Not in LINE app, redirecting to login...");
                        liff.login();
                    } else {
                        setLoading(false);
                    }
                }
            }
        } catch (error) {
            console.error("LIFF Initialization failed:", error);
            setLoading(false);
        }
    };

    const fetchEmployee = async (userId: string) => {
        try {
            const data = await employeeService.getByLineUserId(userId);
            setEmployee(data);
        } catch (error: any) {
            // Only log error if it's not a permission error
            // Permission errors are expected for users who haven't registered yet
            if (error?.code !== 'permission-denied' && !error?.message?.includes('Missing or insufficient permissions')) {
                console.error("Error fetching employee:", error);
            } else {
                console.log("User not registered yet or insufficient permissions");
            }
            // Set employee to null if not found or permission denied
            setEmployee(null);
        } finally {
            setLoading(false);
        }
    };

    const refreshEmployee = async () => {
        if (lineUserId) {
            await fetchEmployee(lineUserId);
        }
    };

    return (
        <EmployeeContext.Provider value={{ employee, loading, lineUserId, lineProfile, refreshEmployee }}>
            <Script
                src="https://static.line-scdn.net/liff/edge/2/sdk.js"
                onLoad={initLiff}
            />
            {children}
        </EmployeeContext.Provider>
    );
}

export const useEmployee = () => useContext(EmployeeContext);
