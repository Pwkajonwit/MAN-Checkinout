"use client";

import { useEmployee } from "@/contexts/EmployeeContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";

export function EmployeeHeader() {
    const { employee, loading, lineProfile } = useEmployee();
    const pathname = usePathname();
    const router = useRouter();
    const isHomePage = pathname === "/";
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Determine display name and avatar
    const displayName = employee ? employee.name : (lineProfile?.displayName || "ผู้มาเยือน");
    const displayPosition = employee?.position || (lineProfile ? "LINE User" : "Guest");
    const displayAvatar = employee?.avatar || lineProfile?.pictureUrl || undefined;
    const displayInitial = displayName?.charAt(0) || "G";

    return (
        <header className="bg-primary text-white pt-4 pb-8 px-5 rounded-b-[2rem] shadow-lg relative overflow-hidden">
            {/* Decorative Circles */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-12 -mt-12 blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full -ml-8 -mb-8 blur-xl pointer-events-none" />

            <div className="relative z-10">
                <div className="flex justify-between items-center">
                    {/* Left Side: Back Button or Avatar */}
                    <div className="flex items-center gap-3">
                        {!isHomePage && (
                            <button
                                onClick={() => router.push("/")}
                                className="p-1.5 bg-white/10 backdrop-blur-md rounded-lg hover:bg-white/20 transition-colors mr-1"
                            >
                                <ArrowLeft className="w-5 h-5 text-white" />
                            </button>
                        )}

                        {/* Employee Info (Compact) */}
                        <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10 border border-white/30 shadow-md bg-black/10">
                                <AvatarImage src={displayAvatar} className="object-cover" />
                                <AvatarFallback className="bg-white/10 text-white backdrop-blur-sm text-sm font-bold">
                                    {loading ? "" : displayInitial}
                                </AvatarFallback>
                            </Avatar>

                            <div className="min-w-0">
                                {loading ? (
                                    <div className="space-y-1.5">
                                        <Skeleton className="h-4 w-24 bg-white/20" />
                                        <Skeleton className="h-3 w-16 bg-white/10" />
                                    </div>
                                ) : (
                                    <>
                                        <h1 className="text-base font-bold truncate leading-tight max-w-[140px]">
                                            {displayName}
                                        </h1>
                                        <p className="text-xs text-blue-100 opacity-80 truncate">
                                            {displayPosition}
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Time */}
                    <div className="text-right">
                        <div className="text-2xl font-bold tracking-tight leading-none">
                            {format(currentTime, "HH:mm")}
                        </div>
                        <div className="text-[10px] text-blue-100 font-medium mt-0.5 opacity-80">
                            {format(currentTime, "d MMM yy", { locale: th })}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
