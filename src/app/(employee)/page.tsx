"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmployeeHeader } from "@/components/mobile/EmployeeHeader";
import { MapPin, Calendar, Clock, FileText, ChevronRight, RefreshCw } from "lucide-react";
import { useEmployee } from "@/contexts/EmployeeContext";

export default function MobileHomePage() {
    const { employee, loading } = useEmployee();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const menuItems = [
        {
            title: "ประวัติการลงเวลา",
            subtitle: "ดูรายการย้อนหลัง",
            icon: Calendar,
            href: "/history",
            color: "bg-orange-50 text-orange-600",
            iconBg: "bg-orange-100",
        },
        {
            title: "ขออนุมัติลางาน",
            subtitle: "ลาป่วย ลากิจ พักร้อน",
            icon: FileText,
            href: "/leave-request",
            color: "bg-blue-50 text-blue-600",
            iconBg: "bg-blue-100",
        },
        {
            title: "ขออนุมัติ OT",
            subtitle: "บันทึกการทำงานล่วงเวลา",
            icon: Clock,
            href: "/ot-request",
            color: "bg-purple-50 text-purple-600",
            iconBg: "bg-purple-100",
        },
        {
            title: "ขอสลับวันหยุด",
            subtitle: "สลับวันหยุดกับวันทำงาน",
            icon: RefreshCw,
            href: "/shift-swap",
            color: "bg-indigo-50 text-indigo-600",
            iconBg: "bg-indigo-100",
        },
    ];

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <EmployeeHeader />

            <main className="px-6 -mt-6 relative z-10 space-y-6">
                {/* Main Action: Check In/Out */}
                <Link href="/check-in" className="block group">
                    <div className="bg-white rounded-3xl p-6 shadow-xl shadow-green-900/5 border border-green-50 relative overflow-hidden transition-transform active:scale-95">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-transparent rounded-bl-full -mr-8 -mt-8" />

                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
                                <MapPin className="w-6 h-6" />
                            </div>

                        </div>

                        <div>
                            <h2 className="text-xl font-bold text-gray-800 mb-1">ลงเวลา</h2>
                            <p className="text-sm text-gray-500">บันทึกเวลาทำงานผ่าน GPS และรูปถ่าย</p>
                        </div>

                        <div className="mt-4 flex items-center text-sm font-semibold text-green-600 group-hover:translate-x-1 transition-transform">
                            เข้าสู่เมนู <ChevronRight className="w-4 h-4 ml-1" />
                        </div>
                    </div>
                </Link>

                {/* Secondary Menu Grid */}
                <div className="grid grid-cols-1 gap-4">
                    {menuItems.map((item, index) => (
                        <Link key={index} href={item.href} className="block">
                            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 transition-all active:bg-gray-50">
                                <div className={`w-12 h-12 rounded-xl ${item.iconBg} ${item.color.split(" ")[1]} flex items-center justify-center shrink-0`}>
                                    <item.icon className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-800">{item.title}</h3>
                                    <p className="text-xs text-gray-500">{item.subtitle}</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-300" />
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Register Button (Only if needed or for testing) */}
                {!loading && !employee && (
                    <Link href="/register" className="block mt-8">
                        <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-4 text-white text-center shadow-lg">
                            <p className="font-bold">ลงทะเบียนพนักงานใหม่</p>
                            <p className="text-xs text-gray-400 mt-1">สำหรับพนักงานที่ยังไม่มีรหัส</p>
                        </div>
                    </Link>
                )}
            </main>
        </div>
    );
}
