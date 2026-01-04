"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { leaveService, otService, swapService, type LeaveRequest, type OTRequest, type SwapRequest } from "@/lib/firestore";
import { CheckCircle, XCircle, Clock, FileText, Calendar, Image as ImageIcon, X, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { CustomAlert } from "@/components/ui/custom-alert";

export default function ApprovalsPage() {
    const [activeTab, setActiveTab] = useState<"leave" | "ot" | "swap">("leave");
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [otRequests, setOtRequests] = useState<OTRequest[]>([]);
    const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const [alertState, setAlertState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: "success" | "error" | "warning" | "info";
    }>({
        isOpen: false,
        title: "",
        message: "",
        type: "info"
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [leaves, ots, swaps] = await Promise.all([
                leaveService.getAll(),
                otService.getAll(),
                swapService.getAll()
            ]);

            // Filter only pending requests
            setLeaveRequests(leaves.filter(r => r.status === "รออนุมัติ"));
            setOtRequests(ots.filter(r => r.status === "รออนุมัติ"));
            setSwapRequests(swaps.filter(r => r.status === "รออนุมัติ"));
        } catch (error) {
            console.error("Error fetching requests:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleApproveLeave = async (id: string) => {
        if (!confirm("ยืนยันการอนุมัติ?")) return;
        try {
            await leaveService.updateStatus(id, "อนุมัติ");
            fetchData();
        } catch (error) {
            console.error(error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เกิดข้อผิดพลาด",
                type: "error"
            });
        }
    };

    const handleRejectLeave = async (id: string) => {
        if (!confirm("ยืนยันการปฏิเสธ?")) return;
        try {
            await leaveService.updateStatus(id, "ไม่อนุมัติ");
            fetchData();
        } catch (error) {
            console.error(error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เกิดข้อผิดพลาด",
                type: "error"
            });
        }
    };

    const handleApproveOT = async (id: string) => {
        if (!confirm("ยืนยันการอนุมัติ?")) return;
        try {
            await otService.updateStatus(id, "อนุมัติ");
            fetchData();
        } catch (error) {
            console.error(error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เกิดข้อผิดพลาด",
                type: "error"
            });
        }
    };

    const handleRejectOT = async (id: string) => {
        if (!confirm("ยืนยันการปฏิเสธ?")) return;
        try {
            await otService.updateStatus(id, "ไม่อนุมัติ");
            fetchData();
        } catch (error) {
            console.error(error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เกิดข้อผิดพลาด",
                type: "error"
            });
        }
    };

    const handleApproveSwap = async (id: string) => {
        if (!confirm("ยืนยันการอนุมัติ?")) return;
        try {
            await swapService.updateStatus(id, "อนุมัติ");
            fetchData();
        } catch (error) {
            console.error(error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เกิดข้อผิดพลาด",
                type: "error"
            });
        }
    };

    const handleRejectSwap = async (id: string) => {
        if (!confirm("ยืนยันการปฏิเสธ?")) return;
        try {
            await swapService.updateStatus(id, "ไม่อนุมัติ");
            fetchData();
        } catch (error) {
            console.error(error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เกิดข้อผิดพลาด",
                type: "error"
            });
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <PageHeader
                title="อนุมัติคำขอ"
                subtitle="จัดการคำขอลาและโอทีที่รอการอนุมัติ"
            />

            {/* Tabs */}
            <div className="flex gap-4 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab("leave")}
                    className={`pb-4 px-4 font-medium text-sm transition-colors relative ${activeTab === "leave"
                        ? "text-blue-600"
                        : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    คำขอลา ({leaveRequests.length})
                    {activeTab === "leave" && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("ot")}
                    className={`pb-4 px-4 font-medium text-sm transition-colors relative ${activeTab === "ot"
                        ? "text-blue-600"
                        : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    คำขอ OT ({otRequests.length})
                    {activeTab === "ot" && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("swap")}
                    className={`pb-4 px-4 font-medium text-sm transition-colors relative ${activeTab === "swap"
                        ? "text-blue-600"
                        : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    คำขอสลับวัน ({swapRequests.length})
                    {activeTab === "swap" && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
                    )}
                </button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="w-12 h-12 border-4 border-gray-100 border-t-primary rounded-full animate-spin mx-auto"></div>
                    <p className="text-gray-600 mt-4">กำลังโหลดข้อมูล...</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {activeTab === "leave" && (
                        leaveRequests.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500">
                                ไม่มีคำขอลาที่รออนุมัติ
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {leaveRequests.map((req) => (
                                    <div key={req.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-900">{req.employeeName}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${req.leaveType === "ลาป่วย" ? "bg-red-50 text-red-600" :
                                                    req.leaveType === "ลากิจ" ? "bg-blue-50 text-blue-600" :
                                                        "bg-purple-50 text-purple-600"
                                                    }`}>
                                                    {req.leaveType}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                                <Calendar className="w-4 h-4" />
                                                {format(req.startDate instanceof Date ? req.startDate : (req.startDate as any).toDate(), "d MMM yy", { locale: th })} - {format(req.endDate instanceof Date ? req.endDate : (req.endDate as any).toDate(), "d MMM yy", { locale: th })}
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                เหตุผล: {req.reason}
                                            </div>
                                            {req.attachment && (
                                                <div className="pt-2">
                                                    <button
                                                        onClick={() => setViewingImage(req.attachment || null)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100 text-sm text-blue-600"
                                                    >
                                                        <ImageIcon className="w-4 h-4" />
                                                        ดูหลักฐานแนบ
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2 w-full md:w-auto">
                                            <button
                                                onClick={() => handleApproveLeave(req.id!)}
                                                className="flex-1 md:flex-none px-4 py-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                                อนุมัติ
                                            </button>
                                            <button
                                                onClick={() => handleRejectLeave(req.id!)}
                                                className="flex-1 md:flex-none px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                                            >
                                                <XCircle className="w-4 h-4" />
                                                ไม่อนุมัติ
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}

                    {activeTab === "ot" && (
                        otRequests.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500">
                                ไม่มีคำขอ OT ที่รออนุมัติ
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {otRequests.map((req) => (
                                    <div key={req.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-900">{req.employeeName}</span>
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-600">
                                                    OT Request
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                                <Calendar className="w-4 h-4" />
                                                {format(req.date instanceof Date ? req.date : (req.date as any).toDate(), "d MMM yyyy", { locale: th })}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                                <Clock className="w-4 h-4" />
                                                {format(req.startTime instanceof Date ? req.startTime : (req.startTime as any).toDate(), "HH:mm")} - {format(req.endTime instanceof Date ? req.endTime : (req.endTime as any).toDate(), "HH:mm")}
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                รายละเอียด: {req.reason}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 w-full md:w-auto">
                                            <button
                                                onClick={() => handleApproveOT(req.id!)}
                                                className="flex-1 md:flex-none px-4 py-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                                อนุมัติ
                                            </button>
                                            <button
                                                onClick={() => handleRejectOT(req.id!)}
                                                className="flex-1 md:flex-none px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                                            >
                                                <XCircle className="w-4 h-4" />
                                                ไม่อนุมัติ
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}

                    {activeTab === "swap" && (
                        swapRequests.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500">
                                ไม่มีคำขอสลับวันที่รออนุมัติ
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {swapRequests.map((req) => (
                                    <div key={req.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-900">{req.employeeName}</span>
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-600">
                                                    ขอสลับวันหยุด
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-gray-500 my-2">
                                                <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                                    <div className="text-center">
                                                        <span className="text-[10px] text-gray-400 block">วันหยุดเดิม (มาทำ)</span>
                                                        <span className="font-semibold text-gray-700">
                                                            {format(req.workDate instanceof Date ? req.workDate : (req.workDate as any).toDate(), "d MMM", { locale: th })}
                                                        </span>
                                                    </div>
                                                    <ArrowRight className="w-4 h-4 text-gray-300" />
                                                    <div className="text-center">
                                                        <span className="text-[10px] text-gray-400 block">วันหยุดใหม่ (ขอหยุด)</span>
                                                        <span className="font-semibold text-blue-600">
                                                            {format(req.holidayDate instanceof Date ? req.holidayDate : (req.holidayDate as any).toDate(), "d MMM", { locale: th })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                เหตุผล: {req.reason}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 w-full md:w-auto">
                                            <button
                                                onClick={() => handleApproveSwap(req.id!)}
                                                className="flex-1 md:flex-none px-4 py-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                                อนุมัติ
                                            </button>
                                            <button
                                                onClick={() => handleRejectSwap(req.id!)}
                                                className="flex-1 md:flex-none px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                                            >
                                                <XCircle className="w-4 h-4" />
                                                ไม่อนุมัติ
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            )}

            <CustomAlert
                isOpen={alertState.isOpen}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
                title={alertState.title}
                message={alertState.message}
                type={alertState.type}
            />

            {/* Image Preview Modal */}
            {viewingImage && (
                <div
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
                    onClick={() => setViewingImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] w-full">
                        <button
                            onClick={() => setViewingImage(null)}
                            className="absolute -top-12 right-0 text-white hover:text-gray-300 p-2"
                        >
                            <X className="w-8 h-8" />
                        </button>
                        <img
                            src={viewingImage}
                            alt="Evidence"
                            className="w-full h-full object-contain max-h-[90vh] rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
