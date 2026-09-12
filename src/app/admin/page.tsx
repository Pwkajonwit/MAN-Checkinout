"use client";

import { useEffect, useState } from "react";
import { AttendanceTable } from "@/components/dashboard/AttendanceTable";
import { AttendanceFormModal } from "@/components/dashboard/AttendanceFormModal";
import { Plus, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Search, Users, CheckCircle2, Clock, Coffee, MapPin } from "lucide-react";
import { attendanceService, type Attendance, adminService, systemConfigService } from "@/lib/firestore";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { auth } from "@/lib/firebase";
import { CustomAlert } from "@/components/ui/custom-alert";

export default function DashboardPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAttendance, setSelectedAttendance] = useState<Attendance | null>(null);
    const [attendances, setAttendances] = useState<Attendance[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [locationEnabled, setLocationEnabled] = useState(false);
    const [workTimeEnabled, setWorkTimeEnabled] = useState(true);
    const [enableBreak, setEnableBreak] = useState(true);
    const [enableOffsite, setEnableOffsite] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
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
        type: "info"
    });

    const loadAttendances = async (date: Date) => {
        setLoading(true);
        try {
            const data = await attendanceService.getByDate(date);
            setAttendances(data);
        } catch (error) {
            console.error("Error loading attendances:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAttendances(selectedDate);
    }, [selectedDate]);

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

        // Load location and work time config
        const loadConfig = async () => {
            try {
                const config = await systemConfigService.get();
                if (config?.locationEnabled) {
                    setLocationEnabled(true);
                }
                setWorkTimeEnabled(config?.workTimeEnabled ?? true);
                setEnableBreak(config?.enableBreak ?? true);
                setEnableOffsite(config?.enableOffsite ?? true);
            } catch (error) {
                console.error("Error loading config:", error);
            }
        };
        loadConfig();
    }, []);

    const changeDate = (days: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        setSelectedDate(d);
    };

    const formatThaiDate = (date: Date) => {
        try {
            const thaiYear = date.getFullYear() + 543;
            return `${format(date, "EEEEที่ d MMMM", { locale: th })} ${thaiYear}`;
        } catch {
            return format(date, "d MMM yyyy");
        }
    };

    const handleAddAttendance = () => {
        setSelectedAttendance(null);
        setIsModalOpen(true);
    };

    const handleEditAttendance = (attendance: Attendance) => {
        setSelectedAttendance(attendance);
        setIsModalOpen(true);
    };

    const handleDeleteAttendance = async (id: string) => {
        try {
            await attendanceService.delete(id);
            loadAttendances(selectedDate);
        } catch (error) {
            console.error("Error deleting attendance:", error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เกิดข้อผิดพลาดในการลบบันทึกการลงเวลา",
                type: "error"
            });
        }
    };

    const handleSuccess = () => {
        loadAttendances(selectedDate);
    };

    const uniqueEmployeeIds = new Set<string>();
    const lateEmployeeIds = new Set<string>();
    const checkedOutEmployeeIds = new Set<string>();
    const offsiteEmployeeIds = new Set<string>();
    const breakEmployeeIds = new Set<string>();

    attendances.forEach(a => {
        if (a.status === "เข้างาน" || a.status === "สาย") {
            uniqueEmployeeIds.add(a.employeeId);
        }
        if (a.status === "สาย") {
            lateEmployeeIds.add(a.employeeId);
        }
        if (a.status === "ออกงาน") {
            checkedOutEmployeeIds.add(a.employeeId);
        }

        if (a.status === "ออกนอกพื้นที่ขาไป" || a.status === "ออกนอกพื้นที่ขากลับ") {
            offsiteEmployeeIds.add(a.employeeId);
        }

        if (a.status === "ก่อนพัก" || a.status === "หลังพัก") {
            breakEmployeeIds.add(a.employeeId);
        }
    });

    const stats = {
        checkedIn: uniqueEmployeeIds.size,
        checkedOut: checkedOutEmployeeIds.size,
        late: lateEmployeeIds.size,
        break: breakEmployeeIds.size,
        offsite: offsiteEmployeeIds.size,
        total: attendances.length,
    };

    // Filter attendances by status and search query
    const filteredAttendances = attendances.filter(a => {
        if (statusFilter === "เข้างาน" && !(a.status === "เข้างาน" || a.status === "สาย")) return false;
        if (statusFilter === "ออกงาน" && a.status !== "ออกงาน") return false;
        if (statusFilter === "สาย" && a.status !== "สาย") return false;
        if (statusFilter === "พัก" && !(a.status === "ก่อนพัก" || a.status === "หลังพัก")) return false;
        if (statusFilter === "นอกพื้นที่" && !(a.status === "ออกนอกพื้นที่ขาไป" || a.status === "ออกนอกพื้นที่ขากลับ")) return false;

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const matchName = a.employeeName?.toLowerCase().includes(query);
            const matchLocation = a.location?.toLowerCase().includes(query);
            const matchNote = a.locationNote?.toLowerCase().includes(query);
            if (!matchName && !matchLocation && !matchNote) return false;
        }

        return true;
    });

    const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl sm:text-2xl font-semibold text-slate-800 tracking-tight">
                            บันทึกการลงเวลา
                        </h1>
                        <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            Attendance Log
                        </span>
                        {isToday && (
                            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                วันนี้
                            </span>
                        )}
                    </div>
                    <p className="text-xs sm:text-sm font-normal text-slate-500 mt-1">
                        ประวัติการลงเวลารายวัน • {formatThaiDate(selectedDate)}
                    </p>
                </div>
            </div>

            {/* Compact Filters & Controls Bar */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-2.5 sm:p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Date Selector with prev/next buttons */}
                    <div className="inline-flex items-center bg-slate-50 rounded-lg border border-slate-200 p-0.5">
                        <button
                            type="button"
                            onClick={() => changeDate(-1)}
                            title="วันก่อนหน้า"
                            className="p-1.5 hover:bg-white hover:shadow-2xs text-slate-600 hover:text-slate-900 rounded-md transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-1.5 px-2">
                            <CalendarIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <input
                                type="date"
                                value={selectedDate instanceof Date && !isNaN(selectedDate.getTime()) ? format(selectedDate, "yyyy-MM-dd") : ""}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        const date = new Date(e.target.value);
                                        if (!isNaN(date.getTime())) {
                                            setSelectedDate(date);
                                        }
                                    }
                                }}
                                className="bg-transparent text-xs sm:text-sm font-normal text-slate-800 focus:outline-none cursor-pointer"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => changeDate(1)}
                            title="วันถัดไป"
                            className="p-1.5 hover:bg-white hover:shadow-2xs text-slate-600 hover:text-slate-900 rounded-md transition-all"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Today Button */}
                    {!isToday && (
                        <button
                            type="button"
                            onClick={() => setSelectedDate(new Date())}
                            className="h-9 px-2.5 text-xs font-medium text-blue-700 bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200 rounded-lg transition-colors"
                        >
                            กลับไปวันนี้
                        </button>
                    )}

                    {/* Search Input */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="ค้นหาชื่อ, สถานที่, หรือหมายเหตุ..."
                            className="h-9 pl-8 pr-7 py-1 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-normal text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 w-48 sm:w-64 transition-all"
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

                {/* Add Attendance Button */}
                <div className="flex items-center gap-2 ml-auto">
                    <button
                        onClick={handleAddAttendance}
                        className="h-9 inline-flex items-center gap-1.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-medium shadow-xs transition-all"
                    >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>บันทึกลงเวลา</span>
                    </button>
                </div>
            </div>

            {/* Compact & Clean Stat Cards (Clickable status filters) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
                {/* เข้างาน */}
                <div
                    onClick={() => setStatusFilter(statusFilter === "เข้างาน" ? null : "เข้างาน")}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        statusFilter === "เข้างาน"
                            ? "border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/20"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">เข้างาน</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">{stats.checkedIn}</div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">คน</div>
                </div>

                {/* ออกงาน */}
                <div
                    onClick={() => setStatusFilter(statusFilter === "ออกงาน" ? null : "ออกงาน")}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        statusFilter === "ออกงาน"
                            ? "border-blue-500 ring-2 ring-blue-100 bg-blue-50/20"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">ออกงาน</span>
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">{stats.checkedOut}</div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">คน</div>
                </div>

                {/* สาย */}
                <div
                    onClick={() => setStatusFilter(statusFilter === "สาย" ? null : "สาย")}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        statusFilter === "สาย"
                            ? "border-rose-500 ring-2 ring-rose-100 bg-rose-50/20"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">สาย</span>
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">{stats.late}</div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">คน</div>
                </div>

                {/* พัก */}
                {enableBreak && (
                    <div
                        onClick={() => setStatusFilter(statusFilter === "พัก" ? null : "พัก")}
                        className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                            statusFilter === "พัก"
                                ? "border-amber-500 ring-2 ring-amber-100 bg-amber-50/20"
                                : "border-slate-200/90 hover:border-slate-300"
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-700">พัก</span>
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        </div>
                        <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">{stats.break}</div>
                        <div className="text-[11px] font-normal text-slate-400 mt-0.5">คน</div>
                    </div>
                )}

                {/* นอกพื้นที่ */}
                {enableOffsite && (
                    <div
                        onClick={() => setStatusFilter(statusFilter === "นอกพื้นที่" ? null : "นอกพื้นที่")}
                        className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                            statusFilter === "นอกพื้นที่"
                                ? "border-purple-500 ring-2 ring-purple-100 bg-purple-50/20"
                            : "border-slate-200/90 hover:border-slate-300"
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-700">นอกพื้นที่</span>
                            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                        </div>
                        <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">{stats.offsite}</div>
                        <div className="text-[11px] font-normal text-slate-400 mt-0.5">คน</div>
                    </div>
                )}

                {/* ทั้งหมด */}
                <div
                    onClick={() => setStatusFilter(null)}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        statusFilter === null
                            ? "border-slate-700 ring-2 ring-slate-100 bg-slate-50/50"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">ทั้งหมด</span>
                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">{stats.total}</div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">รายการ</div>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-10 text-center text-slate-500 font-normal">
                    <div className="animate-spin w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                    กำลังโหลดข้อมูลการลงเวลา...
                </div>
            ) : (
                <AttendanceTable
                    attendances={filteredAttendances}
                    onEdit={handleEditAttendance}
                    onDelete={handleDeleteAttendance}
                    isSuperAdmin={isSuperAdmin}
                    locationEnabled={locationEnabled}
                    workTimeEnabled={workTimeEnabled}
                />
            )}

            <AttendanceFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                attendance={selectedAttendance}
                onSuccess={handleSuccess}
            />

            <CustomAlert
                isOpen={alertState.isOpen}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
                title={alertState.title}
                message={alertState.message}
                type={alertState.type}
            />
        </div>
    );
}
