"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Calendar } from "lucide-react";
import { startOfMonth, endOfMonth, format, subMonths, addMonths } from "date-fns";
import { th } from "date-fns/locale";

import { SwapTable } from "@/components/swap/SwapTable";
import { swapService, type SwapRequest, employeeService, type Employee, adminService } from "@/lib/firestore";
import { sendPushMessage } from "@/app/actions/line";
import { auth } from "@/lib/firebase";
import { CustomAlert } from "@/components/ui/custom-alert";

export default function SwapPage() {
    const [requests, setRequests] = useState<SwapRequest[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [statusFilter, setStatusFilter] = useState<"all" | "รออนุมัติ" | "อนุมัติ" | "ไม่อนุมัติ">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [alertState, setAlertState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: "success" | "error" | "warning" | "info";
    }>({
        isOpen: false,
        title: "",
        message: "",
        type: "info",
    });

    const loadData = async () => {
        try {
            const [swapData, empData] = await Promise.all([
                swapService.getByDateRange(startOfMonth(currentDate), endOfMonth(currentDate)),
                employeeService.getActive(),
            ]);
            setRequests(swapData);
            setEmployees(empData);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentDate]);

    useEffect(() => {
        // Check if current user is super_admin
        const checkAdminRole = async () => {
            const user = auth.currentUser;
            if (user?.email) {
                const admin = await adminService.getByEmail(user.email);
                if (admin?.role === "super_admin") {
                    setIsSuperAdmin(true);
                }
            }
        };
        checkAdminRole();
    }, []);

    const handleDeleteRequest = async (id: string) => {
        try {
            await swapService.delete(id);
            loadData();
            setAlertState({
                isOpen: true,
                title: "สำเร็จ",
                message: "ลบคำขอสลับวันหยุดเรียบร้อยแล้ว",
                type: "success",
            });
        } catch (error) {
            console.error("Error deleting swap request:", error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เกิดข้อผิดพลาดในการลบคำขอ",
                type: "error",
            });
        }
    };

    const handleStatusUpdate = async (id: string, status: SwapRequest["status"]) => {
        try {
            await swapService.updateStatus(id, status);

            // Find the request and employee to send notification
            const request = requests.find((r) => r.id === id);
            if (request) {
                const employee = await employeeService.getById(request.employeeId);
                if (employee && employee.lineUserId) {
                    const isApproved = status === "อนุมัติ";
                    const color = isApproved ? "#1DB446" : "#D32F2F";
                    const title = isApproved ? "อนุมัติคำขอสลับวันหยุด" : "ไม่อนุมัติคำขอสลับวันหยุด";

                    const parseDate = (d: any): Date => {
                        if (d instanceof Date) return d;
                        if (d?.toDate?.()) return d.toDate();
                        return new Date(d);
                    };

                    const workDate = parseDate(request.workDate);
                    const holidayDate = parseDate(request.holidayDate);

                    await sendPushMessage(employee.lineUserId, [
                        {
                            type: "flex",
                            altText: `ผลการพิจารณาสลับวันหยุด: ${status}`,
                            contents: {
                                type: "bubble",
                                header: {
                                    type: "box",
                                    layout: "vertical",
                                    contents: [
                                        {
                                            type: "text",
                                            text: title,
                                            weight: "bold",
                                            color: color,
                                            size: "lg",
                                        },
                                    ],
                                },
                                body: {
                                    type: "box",
                                    layout: "vertical",
                                    contents: [
                                        {
                                            type: "box",
                                            layout: "vertical",
                                            margin: "lg",
                                            spacing: "sm",
                                            contents: [
                                                {
                                                    type: "box",
                                                    layout: "baseline",
                                                    spacing: "sm",
                                                    contents: [
                                                        {
                                                            type: "text",
                                                            text: "มาทำงาน",
                                                            color: "#aaaaaa",
                                                            size: "sm",
                                                            flex: 2,
                                                        },
                                                        {
                                                            type: "text",
                                                            text: workDate.toLocaleDateString("th-TH", {
                                                                weekday: "short",
                                                                day: "numeric",
                                                                month: "short",
                                                            }),
                                                            wrap: true,
                                                            color: "#22c55e",
                                                            size: "sm",
                                                            flex: 5,
                                                            weight: "bold",
                                                        },
                                                    ],
                                                },
                                                {
                                                    type: "box",
                                                    layout: "baseline",
                                                    spacing: "sm",
                                                    contents: [
                                                        {
                                                            type: "text",
                                                            text: "หยุดแทน",
                                                            color: "#aaaaaa",
                                                            size: "sm",
                                                            flex: 2,
                                                        },
                                                        {
                                                            type: "text",
                                                            text: holidayDate.toLocaleDateString("th-TH", {
                                                                weekday: "short",
                                                                day: "numeric",
                                                                month: "short",
                                                            }),
                                                            wrap: true,
                                                            color: "#ef4444",
                                                            size: "sm",
                                                            flex: 5,
                                                            weight: "bold",
                                                        },
                                                    ],
                                                },
                                                {
                                                    type: "box",
                                                    layout: "baseline",
                                                    spacing: "sm",
                                                    contents: [
                                                        {
                                                            type: "text",
                                                            text: "สถานะ",
                                                            color: "#aaaaaa",
                                                            size: "sm",
                                                            flex: 2,
                                                        },
                                                        {
                                                            type: "text",
                                                            text: status,
                                                            wrap: true,
                                                            color: color,
                                                            size: "sm",
                                                            flex: 5,
                                                            weight: "bold",
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            },
                        },
                    ]);
                }
            }

            loadData();
            setAlertState({
                isOpen: true,
                title: "สำเร็จ",
                message: `${status === "อนุมัติ" ? "อนุมัติ" : "ปฏิเสธ"}คำขอเรียบร้อยแล้ว`,
                type: "success",
            });
        } catch (error) {
            console.error("Error updating status:", error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เกิดข้อผิดพลาดในการอัปเดตสถานะ",
                type: "error",
            });
        }
    };

    // Calculate stats
    const stats = {
        pending: requests.filter((r) => r.status === "รออนุมัติ").length,
        approved: requests.filter((r) => r.status === "อนุมัติ").length,
        rejected: requests.filter((r) => r.status === "ไม่อนุมัติ").length,
        total: requests.length,
    };

    // Filter swap requests by status and search query
    const filteredRequests = requests.filter((req) => {
        if (statusFilter !== "all" && req.status !== statusFilter) return false;

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const matchName = req.employeeName?.toLowerCase().includes(query);
            const matchReason = req.reason?.toLowerCase().includes(query);
            if (!matchName && !matchReason) return false;
        }

        return true;
    });

    const isCurrentMonth = format(currentDate, "yyyy-MM") === format(new Date(), "yyyy-MM");

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                            คำขอสลับวันหยุด
                        </h1>
                        <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            Shift Swap Requests
                        </span>
                        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            ประจำเดือน {format(currentDate, "MMMM yyyy", { locale: th })}
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm font-normal text-slate-500 mt-1">
                        จัดการและอนุมัติคำขอสลับวันทำงานและวันหยุดของพนักงาน
                    </p>
                </div>
            </div>

            {/* Compact & Clean Stat Cards (Clickable Status Filters) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                {/* รอการอนุมัติ */}
                <div
                    onClick={() => setStatusFilter(statusFilter === "รออนุมัติ" ? "all" : "รออนุมัติ")}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        statusFilter === "รออนุมัติ"
                            ? "border-amber-500 ring-2 ring-amber-100 bg-amber-50/20"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">รอการอนุมัติ</span>
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">
                        {stats.pending}
                    </div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">รายการ</div>
                </div>

                {/* อนุมัติแล้ว */}
                <div
                    onClick={() => setStatusFilter(statusFilter === "อนุมัติ" ? "all" : "อนุมัติ")}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        statusFilter === "อนุมัติ"
                            ? "border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/20"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">อนุมัติแล้ว</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">
                        {stats.approved}
                    </div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">รายการ</div>
                </div>

                {/* ไม่อนุมัติ */}
                <div
                    onClick={() => setStatusFilter(statusFilter === "ไม่อนุมัติ" ? "all" : "ไม่อนุมัติ")}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        statusFilter === "ไม่อนุมัติ"
                            ? "border-rose-500 ring-2 ring-rose-100 bg-rose-50/20"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">ไม่อนุมัติ</span>
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">
                        {stats.rejected}
                    </div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">รายการ</div>
                </div>

                {/* ทั้งหมด */}
                <div
                    onClick={() => setStatusFilter("all")}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        statusFilter === "all"
                            ? "border-slate-700 ring-2 ring-slate-100 bg-slate-50/50"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">ทั้งหมด</span>
                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">
                        {stats.total}
                    </div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">รายการ</div>
                </div>
            </div>

            {/* Compact Toolbar (Month Selector & Search) */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-2.5 sm:p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Month Picker Group */}
                    <div className="inline-flex items-center bg-slate-50 rounded-lg border border-slate-200 p-0.5">
                        <button
                            type="button"
                            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                            title="เดือนก่อนหน้า"
                            className="p-1.5 hover:bg-white hover:shadow-2xs text-slate-600 hover:text-slate-900 rounded-md transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-1.5 px-2.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="text-xs sm:text-sm font-medium text-slate-800 min-w-[110px] text-center">
                                {format(currentDate, "MMMM yyyy", { locale: th })}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                            title="เดือนถัดไป"
                            className="p-1.5 hover:bg-white hover:shadow-2xs text-slate-600 hover:text-slate-900 rounded-md transition-all"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {!isCurrentMonth && (
                        <button
                            type="button"
                            onClick={() => setCurrentDate(new Date())}
                            className="h-9 px-2.5 text-xs font-medium text-blue-700 bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200 rounded-lg transition-colors"
                        >
                            เดือนนี้
                        </button>
                    )}
                </div>

                {/* Search Input */}
                <div className="relative ml-auto">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="ค้นหาชื่อพนักงาน หรือ เหตุผล..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-9 pl-8 pr-7 py-1 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 w-52 sm:w-64 transition-all"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-0.5"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Table Container */}
            {loading ? (
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-10 text-center text-slate-500 font-normal">
                    <div className="animate-spin w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                    กำลังโหลดข้อมูลคำขอสลับวันหยุด...
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden">
                    <SwapTable
                        requests={filteredRequests}
                        employees={employees}
                        onStatusUpdate={handleStatusUpdate}
                        onDelete={handleDeleteRequest}
                        isSuperAdmin={isSuperAdmin}
                    />

                    {/* Table Footer */}
                    <div className="px-3.5 py-2.5 bg-slate-50/80 border-t border-slate-200 text-xs font-normal text-slate-500 flex flex-wrap items-center justify-between gap-2">
                        <span>
                            แสดงผล <span className="font-semibold text-slate-800">{filteredRequests.length}</span> จากทั้งหมด{" "}
                            <span className="font-semibold text-slate-800">{requests.length}</span> รายการ
                        </span>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                            <span className="text-amber-700">รออนุมัติ: {stats.pending}</span>
                            <span>•</span>
                            <span className="text-emerald-700">อนุมัติ: {stats.approved}</span>
                            <span>•</span>
                            <span className="text-rose-700">ไม่อนุมัติ: {stats.rejected}</span>
                        </div>
                    </div>
                </div>
            )}

            <CustomAlert
                isOpen={alertState.isOpen}
                onClose={() => setAlertState((prev) => ({ ...prev, isOpen: false }))}
                title={alertState.title}
                message={alertState.message}
                type={alertState.type}
            />
        </div>
    );
}
