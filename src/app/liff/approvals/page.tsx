"use client";

import { useState, useEffect } from "react";
import { leaveService, otService, swapService, type LeaveRequest, type OTRequest, type SwapRequest } from "@/lib/firestore";
import { CheckCircle, XCircle, Clock, FileText, Calendar, ChevronLeft, ArrowRight, Image as ImageIcon, X } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CustomAlert } from "@/components/ui/custom-alert";

export default function LiffApprovalsPage() {
    const [activeTab, setActiveTab] = useState<"leave" | "ot" | "swap">("leave");
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [otRequests, setOtRequests] = useState<OTRequest[]>([]);
    const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [liffError, setLiffError] = useState("");
    const [viewingImage, setViewingImage] = useState<string | null>(null);

    // Confirm Dialog State
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: "danger" | "warning" | "info";
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: "",
        message: "",
        type: "info",
        onConfirm: () => { }
    });

    // Alert State
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

    const showConfirm = (title: string, message: string, onConfirm: () => void, type: "danger" | "warning" | "info" = "info") => {
        setConfirmState({ isOpen: true, title, message, onConfirm, type });
    };

    const closeConfirm = () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
    };

    const showAlert = (title: string, message: string, type: "success" | "error" | "warning" | "info" = "info") => {
        setAlertState({ isOpen: true, title, message, type });
    };

    const closeAlert = () => {
        setAlertState(prev => ({ ...prev, isOpen: false }));
    };

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

    const notifyEmployee = async (employeeId: string, type: "leave" | "ot" | "swap", status: "อนุมัติ" | "ไม่อนุมัติ", details: string) => {
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

    const handleApproveLeave = (req: LeaveRequest) => {
        showConfirm("ยืนยันการอนุมัติ", `อนุมัติการลาของ ${req.employeeName}?`, async () => {
            closeConfirm();
            try {
                await leaveService.updateStatus(req.id!, "อนุมัติ");
                await notifyEmployee(
                    req.employeeId,
                    "leave",
                    "อนุมัติ",
                    `${req.leaveType}: ${format(req.startDate instanceof Date ? req.startDate : (req.startDate as any).toDate(), "d MMM", { locale: th })}`
                );
                showAlert("สำเร็จ", "อนุมัติคำขอลาเรียบร้อยแล้ว", "success");
                fetchData();
            } catch (error) {
                console.error(error);
                showAlert("เกิดข้อผิดพลาด", "ไม่สามารถดำเนินการได้", "error");
            }
        }, "info");
    };

    const handleRejectLeave = (req: LeaveRequest) => {
        showConfirm("ยืนยันการปฏิเสธ", `ปฏิเสธการลาของ ${req.employeeName}?`, async () => {
            closeConfirm();
            try {
                await leaveService.updateStatus(req.id!, "ไม่อนุมัติ");
                await notifyEmployee(
                    req.employeeId,
                    "leave",
                    "ไม่อนุมัติ",
                    `${req.leaveType}: ${format(req.startDate instanceof Date ? req.startDate : (req.startDate as any).toDate(), "d MMM", { locale: th })}`
                );
                showAlert("สำเร็จ", "ปฏิเสธคำขอลาเรียบร้อยแล้ว", "success");
                fetchData();
            } catch (error) {
                console.error(error);
                showAlert("เกิดข้อผิดพลาด", "ไม่สามารถดำเนินการได้", "error");
            }
        }, "danger");
    };

    const handleApproveOT = (req: OTRequest) => {
        showConfirm("ยืนยันการอนุมัติ", `อนุมัติ OT ของ ${req.employeeName}?`, async () => {
            closeConfirm();
            try {
                await otService.updateStatus(req.id!, "อนุมัติ");
                await notifyEmployee(
                    req.employeeId,
                    "ot",
                    "อนุมัติ",
                    `OT: ${format(req.date instanceof Date ? req.date : (req.date as any).toDate(), "d MMM", { locale: th })}`
                );
                showAlert("สำเร็จ", "อนุมัติ OT เรียบร้อยแล้ว", "success");
                fetchData();
            } catch (error) {
                console.error(error);
                showAlert("เกิดข้อผิดพลาด", "ไม่สามารถดำเนินการได้", "error");
            }
        }, "info");
    };

    const handleRejectOT = (req: OTRequest) => {
        showConfirm("ยืนยันการปฏิเสธ", `ปฏิเสธ OT ของ ${req.employeeName}?`, async () => {
            closeConfirm();
            try {
                await otService.updateStatus(req.id!, "ไม่อนุมัติ");
                await notifyEmployee(
                    req.employeeId,
                    "ot",
                    "ไม่อนุมัติ",
                    `OT: ${format(req.date instanceof Date ? req.date : (req.date as any).toDate(), "d MMM", { locale: th })}`
                );
                showAlert("สำเร็จ", "ปฏิเสธ OT เรียบร้อยแล้ว", "success");
                fetchData();
            } catch (error) {
                console.error(error);
                showAlert("เกิดข้อผิดพลาด", "ไม่สามารถดำเนินการได้", "error");
            }
        }, "danger");
    };

    const handleApproveSwap = (req: SwapRequest) => {
        showConfirm("ยืนยันการอนุมัติ", `อนุมัติสลับวันหยุดของ ${req.employeeName}?`, async () => {
            closeConfirm();
            try {
                await swapService.updateStatus(req.id!, "อนุมัติ");
                await notifyEmployee(
                    req.employeeId,
                    "swap",
                    "อนุมัติ",
                    `สลับวันหยุด: ${format(req.workDate instanceof Date ? req.workDate : (req.workDate as any).toDate(), "d MMM", { locale: th })} -> ${format(req.holidayDate instanceof Date ? req.holidayDate : (req.holidayDate as any).toDate(), "d MMM", { locale: th })}`
                );
                showAlert("สำเร็จ", "อนุมัติสลับวันหยุดเรียบร้อยแล้ว", "success");
                fetchData();
            } catch (error) {
                console.error(error);
                showAlert("เกิดข้อผิดพลาด", "ไม่สามารถดำเนินการได้", "error");
            }
        }, "info");
    };

    const handleRejectSwap = (req: SwapRequest) => {
        showConfirm("ยืนยันการปฏิเสธ", `ปฏิเสธสลับวันหยุดของ ${req.employeeName}?`, async () => {
            closeConfirm();
            try {
                await swapService.updateStatus(req.id!, "ไม่อนุมัติ");
                await notifyEmployee(
                    req.employeeId,
                    "swap",
                    "ไม่อนุมัติ",
                    `สลับวันหยุด: ${format(req.workDate instanceof Date ? req.workDate : (req.workDate as any).toDate(), "d MMM", { locale: th })} -> ${format(req.holidayDate instanceof Date ? req.holidayDate : (req.holidayDate as any).toDate(), "d MMM", { locale: th })}`
                );
                showAlert("สำเร็จ", "ปฏิเสธสลับวันหยุดเรียบร้อยแล้ว", "success");
                fetchData();
            } catch (error) {
                console.error(error);
                showAlert("เกิดข้อผิดพลาด", "ไม่สามารถดำเนินการได้", "error");
            }
        }, "danger");
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
                    <button
                        onClick={() => setActiveTab("swap")}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === "swap"
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-gray-500"
                            }`}
                    >
                        สลับวัน ({swapRequests.length})
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="px-4 py-6">
                {loading ? (
                    <div className="text-center py-12 text-gray-500">กำลังโหลดข้อมูล...</div>
                ) : (
                    <div className="space-y-4">
                        {activeTab === "leave" && (
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
                                                {req.attachment && (
                                                    <div className="flex items-center gap-2 text-sm text-blue-600 mt-2">
                                                        <button
                                                            onClick={() => setViewingImage(req.attachment || null)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100"
                                                        >
                                                            <ImageIcon className="w-4 h-4" />
                                                            ดูหลักฐานแนบ
                                                        </button>
                                                    </div>
                                                )}
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
                                                    className="flex-1 py-2.5 bg-primary-dark text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-blue-900/20"
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

                        {activeTab === "ot" && (
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
                                                    className="flex-1 py-2.5 bg-primary-dark text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-blue-900/20"
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

                        {activeTab === "swap" && (
                            swapRequests.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-500">
                                    ไม่มีคำขอสลับวันหยุดที่รออนุมัติ
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {swapRequests.map((req) => (
                                        <div key={req.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <div className="font-bold text-gray-900 text-lg">{req.employeeName}</div>
                                                    <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium mt-1 bg-teal-50 text-teal-600">
                                                        ขอสลับวันหยุด
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="space-y-2 mb-4">
                                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                                    <div className="w-full flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                                                        <div className="text-center">
                                                            <div className="text-xs text-gray-500 mb-1">วันหยุดเดิม (มาทำ)</div>
                                                            <div className="font-bold text-gray-800">
                                                                {format(req.workDate instanceof Date ? req.workDate : (req.workDate as any).toDate(), "d MMM", { locale: th })}
                                                            </div>
                                                        </div>
                                                        <ArrowRight className="w-4 h-4 text-gray-400" />
                                                        <div className="text-center">
                                                            <div className="text-xs text-gray-500 mb-1">วันหยุดใหม่ (ขอหยุด)</div>
                                                            <div className="font-bold text-blue-600">
                                                                {format(req.holidayDate instanceof Date ? req.holidayDate : (req.holidayDate as any).toDate(), "d MMM", { locale: th })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-2 text-sm text-gray-600">
                                                    <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                                                    <span className="flex-1">{req.reason}</span>
                                                </div>
                                            </div>

                                            <div className="flex gap-3 pt-3 border-t border-gray-50">
                                                <button
                                                    onClick={() => handleRejectSwap(req)}
                                                    className="flex-1 py-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2 text-sm font-bold"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                    ไม่อนุมัติ
                                                </button>
                                                <button
                                                    onClick={() => handleApproveSwap(req)}
                                                    className="flex-1 py-2.5 bg-primary-dark text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-blue-900/20"
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

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={confirmState.isOpen}
                onConfirm={confirmState.onConfirm}
                onCancel={closeConfirm}
                title={confirmState.title}
                message={confirmState.message}
                type={confirmState.type}
            />

            {/* Alert */}
            <CustomAlert
                isOpen={alertState.isOpen}
                onClose={closeAlert}
                title={alertState.title}
                message={alertState.message}
                type={alertState.type}
            />

            {/* Image Preview Modal */}
            {viewingImage && (
                <div
                    className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
                    onClick={() => setViewingImage(null)}
                >
                    <div className="relative max-w-full max-h-full w-full flex items-center justify-center">
                        <button
                            onClick={() => setViewingImage(null)}
                            className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 bg-black/50 rounded-full"
                        >
                            <X className="w-8 h-8" />
                        </button>
                        <img
                            src={viewingImage}
                            alt="Evidence"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
