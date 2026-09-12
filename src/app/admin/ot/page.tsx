"use client";

import { useEffect, useState } from "react";
import { OTTable } from "@/components/ot/OTTable";
import { OTFormModal } from "@/components/ot/OTFormModal";
import { Plus, ChevronLeft, ChevronRight, Search, Calendar } from "lucide-react";
import { startOfMonth, endOfMonth, format, subMonths, addMonths } from "date-fns";
import { th } from "date-fns/locale";
import { otService, type OTRequest, employeeService, type Employee, adminService } from "@/lib/firestore";
import { sendPushMessage } from "@/app/actions/line";
import { auth } from "@/lib/firebase";
import { CustomAlert } from "@/components/ui/custom-alert";

export default function OTPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedOT, setSelectedOT] = useState<OTRequest | null>(null);
    const [otRequests, setOTRequests] = useState<OTRequest[]>([]);
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
            const [otData, empData] = await Promise.all([
                otService.getByDateRange(startOfMonth(currentDate), endOfMonth(currentDate)),
                employeeService.getAll(),
            ]);
            setOTRequests(otData);
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

    const handleAddOT = () => {
        setSelectedOT(null);
        setIsModalOpen(true);
    };

    const handleEditOT = (ot: OTRequest) => {
        setSelectedOT(ot);
        setIsModalOpen(true);
    };

    const handleDeleteOT = async (id: string) => {
        try {
            await otService.delete(id);
            setAlertState({
                isOpen: true,
                title: "สำเร็จ",
                message: "ลบคำขอ OT เรียบร้อยแล้ว",
                type: "success",
            });
            loadData();
        } catch (error) {
            console.error("Error deleting OT:", error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เกิดข้อผิดพลาดในการลบคำขอ OT",
                type: "error",
            });
        }
    };

    const handleSuccess = () => {
        loadData();
    };

    const handleStatusUpdate = async (id: string, status: OTRequest["status"]) => {
        try {
            await otService.updateStatus(id, status);

            // Find the request and employee to send notification
            const request = otRequests.find((r) => r.id === id);
            if (request) {
                const employee = await employeeService.getById(request.employeeId);
                if (employee && employee.lineUserId) {
                    const isApproved = status === "อนุมัติ";
                    const color = isApproved ? "#1DB446" : "#D32F2F";
                    const title = isApproved ? "อนุมัติคำขอ OT" : "ไม่อนุมัติคำขอ OT";

                    const dateObj =
                        request.date instanceof Date
                            ? request.date
                            : (request.date as any)?.toDate?.()
                            ? (request.date as any).toDate()
                            : new Date(request.date);

                    const dateStr = dateObj.toLocaleDateString("th-TH", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                    });

                    const parseTime = (t: any) =>
                        t instanceof Date
                            ? t
                            : (t as any)?.toDate?.()
                            ? (t as any).toDate()
                            : new Date(t);

                    const startTime = parseTime(request.startTime);
                    const endTime = parseTime(request.endTime);
                    const timeStr = `${startTime.toLocaleTimeString("th-TH", {
                        hour: "2-digit",
                        minute: "2-digit",
                    })} - ${endTime.toLocaleTimeString("th-TH", {
                        hour: "2-digit",
                        minute: "2-digit",
                    })}`;

                    await sendPushMessage(employee.lineUserId, [
                        {
                            type: "flex",
                            altText: `ผลการพิจารณา OT: ${status}`,
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
                                                            text: "วันที่",
                                                            color: "#aaaaaa",
                                                            size: "sm",
                                                            flex: 1,
                                                        },
                                                        {
                                                            type: "text",
                                                            text: dateStr,
                                                            wrap: true,
                                                            color: "#666666",
                                                            size: "sm",
                                                            flex: 5,
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
                                                            text: "เวลา",
                                                            color: "#aaaaaa",
                                                            size: "sm",
                                                            flex: 1,
                                                        },
                                                        {
                                                            type: "text",
                                                            text: timeStr,
                                                            wrap: true,
                                                            color: "#666666",
                                                            size: "sm",
                                                            flex: 5,
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
                                                            flex: 1,
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

            setAlertState({
                isOpen: true,
                title: "สำเร็จ",
                message: `อัปเดตสถานะเป็น "${status}" เรียบร้อยแล้ว`,
                type: "success",
            });

            loadData();
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
        pending: otRequests.filter((ot) => ot.status === "รออนุมัติ").length,
        approved: otRequests.filter((ot) => ot.status === "อนุมัติ").length,
        rejected: otRequests.filter((ot) => ot.status === "ไม่อนุมัติ").length,
        total: otRequests.length,
        totalHours: otRequests
            .filter((ot) => ot.status === "อนุมัติ")
            .reduce((sum, ot) => {
                const parseTime = (t: any) =>
                    t instanceof Date
                        ? t
                        : (t as any)?.toDate?.()
                        ? (t as any).toDate()
                        : new Date(t);
                const start = parseTime(ot.startTime);
                const end = parseTime(ot.endTime);
                const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                return sum + (hours > 0 ? hours : 0);
            }, 0),
    };

    // Filter OT requests by status and search query
    const filteredOTRequests = otRequests.filter((ot) => {
        if (statusFilter !== "all" && ot.status !== statusFilter) return false;

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const matchName = ot.employeeName?.toLowerCase().includes(query);
            const matchReason = ot.reason?.toLowerCase().includes(query);
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
                            ข้อมูลการขอ OT
                        </h1>
                        <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            Overtime Requests
                        </span>
                        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            ประจำเดือน {format(currentDate, "MMMM yyyy", { locale: th })}
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm font-normal text-slate-500 mt-1">
                        จัดการและอนุมัติคำขอทำงานล่วงเวลา (OT) ของพนักงาน
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

                {/* ชั่วโมง OT รวม */}
                <div
                    onClick={() => setStatusFilter("all")}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        statusFilter === "all"
                            ? "border-slate-700 ring-2 ring-slate-100 bg-slate-50/50"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">ชั่วโมง OT อนุมัติ</span>
                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">
                        {stats.totalHours.toFixed(1)} <span className="text-sm font-medium">ชม.</span>
                    </div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">
                        ทั้งหมด {stats.total} รายการ
                    </div>
                </div>
            </div>

            {/* Compact Toolbar (Month Selector, Search, & Add Button) */}
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

                    {/* Search Input */}
                    <div className="relative">
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

                {/* Add OT Button */}
                <div className="flex items-center gap-2 ml-auto">
                    <button
                        onClick={handleAddOT}
                        className="h-9 inline-flex items-center gap-1.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-medium shadow-xs transition-all"
                    >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>เพิ่มข้อมูลโอที</span>
                    </button>
                </div>
            </div>

            {/* Table Container */}
            {loading ? (
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-10 text-center text-slate-500 font-normal">
                    <div className="animate-spin w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                    กำลังโหลดข้อมูลการขอ OT...
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden">
                    <OTTable
                        otRequests={filteredOTRequests}
                        employees={employees}
                        onStatusUpdate={handleStatusUpdate}
                        onEdit={handleEditOT}
                        onDelete={handleDeleteOT}
                        isSuperAdmin={isSuperAdmin}
                    />

                    {/* Table Footer */}
                    <div className="px-3.5 py-2.5 bg-slate-50/80 border-t border-slate-200 text-xs font-normal text-slate-500 flex flex-wrap items-center justify-between gap-2">
                        <span>
                            แสดงผล <span className="font-semibold text-slate-800">{filteredOTRequests.length}</span> จากทั้งหมด{" "}
                            <span className="font-semibold text-slate-800">{otRequests.length}</span> รายการ
                        </span>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                            <span className="text-amber-700">รออนุมัติ: {stats.pending}</span>
                            <span>•</span>
                            <span className="text-emerald-700">อนุมัติ: {stats.approved}</span>
                            <span>•</span>
                            <span className="text-rose-700">ไม่อนุมัติ: {stats.rejected}</span>
                            <span>•</span>
                            <span className="text-slate-700 font-medium">ชั่วโมงที่อนุมัติ: {stats.totalHours.toFixed(1)} ชม.</span>
                        </div>
                    </div>
                </div>
            )}

            <OTFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                ot={selectedOT}
                onSuccess={handleSuccess}
            />

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
