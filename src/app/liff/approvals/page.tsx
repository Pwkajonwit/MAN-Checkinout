"use client";

import { useState, useEffect } from "react";
import { leaveService, otService, type LeaveRequest, type OTRequest } from "@/lib/firestore";
import { CheckCircle, XCircle, Clock, FileText, Calendar, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";

export default function LiffApprovalsPage() {
    const [activeTab, setActiveTab] = useState<"leave" | "ot">("leave");
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [otRequests, setOtRequests] = useState<OTRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [liffError, setLiffError] = useState("");

    useEffect(() => {
        const initLiff = async () => {
            try {
                const liffId = process.env.NEXT_PUBLIC_LIFF_APPROVE_ID;
                if (!liffId) {
                    console.warn("LIFF_APPROVE_ID not found");
                    return;
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const liff = (window as any).liff;
                if (liff) {
                    await liff.init({ liffId });
                    if (!liff.isLoggedIn()) {
                        liff.login();
                    }
                }
            } catch (error) {
                console.error("LIFF Init Error:", error);
                setLiffError("Failed to initialize LIFF");
            }
        };
        initLiff();
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [leaves, ots] = await Promise.all([
                leaveService.getAll(),
                otService.getAll()
            ]);

            // Filter only pending requests
            setLeaveRequests(leaves.filter(r => r.status === "รออนุมัติ"));
            setOtRequests(ots.filter(r => r.status === "รออนุมัติ"));
        } catch (error) {
            console.error("Error fetching requests:", error);
        } finally {
            setLoading(false);
        }
    };

    const notifyEmployee = async (employeeId: string, type: "leave" | "ot", status: "อนุมัติ" | "ไม่อนุมัติ", details: string) => {
        try {
            await fetch("/api/line/notify-employee", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    employeeId,
                    type,
                    status,
                    details
                }),
            });
        } catch (error) {
            console.error("Error notifying employee:", error);
        }
    };

    const handleApproveLeave = async (req: LeaveRequest) => {
        if (!confirm("ยืนยันการอนุมัติ?")) return;
        try {
            await leaveService.updateStatus(req.id!, "อนุมัติ");
            await notifyEmployee(
                req.employeeId,
                "leave",
                "อนุมัติ",
                `${req.leaveType}: ${format(req.startDate instanceof Date ? req.startDate : (req.startDate as any).toDate(), "d MMM", { locale: th })}`
            );
            fetchData();
        } catch (error) {
            console.error(error);
            alert("เกิดข้อผิดพลาด");
        }
    };

    const handleRejectLeave = async (req: LeaveRequest) => {
        if (!confirm("ยืนยันการปฏิเสธ?")) return;
        try {
            await leaveService.updateStatus(req.id!, "ไม่อนุมัติ");
            await notifyEmployee(
                req.employeeId,
                "leave",
                "ไม่อนุมัติ",
                `${req.leaveType}: ${format(req.startDate instanceof Date ? req.startDate : (req.startDate as any).toDate(), "d MMM", { locale: th })}`
            );
            fetchData();
        } catch (error) {
            console.error(error);
            alert("เกิดข้อผิดพลาด");
        }
    };

    const handleApproveOT = async (req: OTRequest) => {
        if (!confirm("ยืนยันการอนุมัติ?")) return;
        try {
            await otService.updateStatus(req.id!, "อนุมัติ");
            await notifyEmployee(
                req.employeeId,
                "ot",
                "อนุมัติ",
                `OT: ${format(req.date instanceof Date ? req.date : (req.date as any).toDate(), "d MMM", { locale: th })}`
            );
            fetchData();
        } catch (error) {
            console.error(error);
            alert("เกิดข้อผิดพลาด");
        }
    };

    const handleRejectOT = async (req: OTRequest) => {
        if (!confirm("ยืนยันการปฏิเสธ?")) return;
        try {
            await otService.updateStatus(req.id!, "ไม่อนุมัติ");
            await notifyEmployee(
                req.employeeId,
                "ot",
                "ไม่อนุมัติ",
                `OT: ${format(req.date instanceof Date ? req.date : (req.date as any).toDate(), "d MMM", { locale: th })}`
            );
            fetchData();
        } catch (error) {
            console.error(error);
            alert("เกิดข้อผิดพลาด");
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-10">
            {/* Mobile Header */}
            <div className="bg-white px-6 pt-12 pb-6 shadow-sm sticky top-0 z-10">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-bold text-gray-900">อนุมัติคำขอ</h1>
                    <div className="text-sm text-gray-500">Admin</div>
                </div>

                {/* Tabs */}
                <div className="flex p-1 bg-gray-100 rounded-xl">
                    <button
                        onClick={() => setActiveTab("leave")}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === "leave"
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-gray-500"
                            }`}
                    >
                        ลา ({leaveRequests.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("ot")}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === "ot"
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-gray-500"
                            }`}
                    >
                        OT ({otRequests.length})
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="px-4 py-6">
                {loading ? (
                    <div className="text-center py-12 text-gray-500">กำลังโหลดข้อมูล...</div>
                ) : (
                    <div className="space-y-4">
                        {activeTab === "leave" ? (
                            leaveRequests.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-500">
                                    ไม่มีคำขอลาที่รออนุมัติ
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {leaveRequests.map((req) => (
                                        <div key={req.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <div className="font-bold text-gray-900 text-lg">{req.employeeName}</div>
                                                    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium mt-1 ${req.leaveType === "ลาป่วย" ? "bg-red-50 text-red-600" :
                                                        req.leaveType === "ลากิจ" ? "bg-blue-50 text-blue-600" :
                                                            "bg-purple-50 text-purple-600"
                                                        }`}>
                                                        {req.leaveType}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="space-y-2 mb-4">
                                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                                    <Calendar className="w-4 h-4 text-gray-400" />
                                                    {format(req.startDate instanceof Date ? req.startDate : (req.startDate as any).toDate(), "d MMM", { locale: th })} - {format(req.endDate instanceof Date ? req.endDate : (req.endDate as any).toDate(), "d MMM yy", { locale: th })}
                                                </div>
                                                <div className="flex items-start gap-2 text-sm text-gray-600">
                                                    <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                                                    <span className="flex-1">{req.reason}</span>
                                                </div>
                                            </div>

                                            <div className="flex gap-3 pt-3 border-t border-gray-50">
                                                <button
                                                    onClick={() => handleRejectLeave(req)}
                                                    className="flex-1 py-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2 text-sm font-bold"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                    ไม่อนุมัติ
                                                </button>
                                                <button
                                                    onClick={() => handleApproveLeave(req)}
                                                    className="flex-1 py-2.5 bg-[#0047BA] text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-blue-900/20"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    อนุมัติ
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : (
                            otRequests.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-500">
                                    ไม่มีคำขอ OT ที่รออนุมัติ
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {otRequests.map((req) => (
                                        <div key={req.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <div className="font-bold text-gray-900 text-lg">{req.employeeName}</div>
                                                    <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium mt-1 bg-orange-50 text-orange-600">
                                                        OT Request
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="space-y-2 mb-4">
                                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                                    <Calendar className="w-4 h-4 text-gray-400" />
                                                    {format(req.date instanceof Date ? req.date : (req.date as any).toDate(), "d MMM yyyy", { locale: th })}
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                                    <Clock className="w-4 h-4 text-gray-400" />
                                                    {format(req.startTime instanceof Date ? req.startTime : (req.startTime as any).toDate(), "HH:mm")} - {format(req.endTime instanceof Date ? req.endTime : (req.endTime as any).toDate(), "HH:mm")}
                                                </div>
                                                <div className="flex items-start gap-2 text-sm text-gray-600">
                                                    <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                                                    <span className="flex-1">{req.reason}</span>
                                                </div>
                                            </div>

                                            <div className="flex gap-3 pt-3 border-t border-gray-50">
                                                <button
                                                    onClick={() => handleRejectOT(req)}
                                                    className="flex-1 py-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2 text-sm font-bold"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                    ไม่อนุมัติ
                                                </button>
                                                <button
                                                    onClick={() => handleApproveOT(req)}
                                                    className="flex-1 py-2.5 bg-[#0047BA] text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-blue-900/20"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    อนุมัติ
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
