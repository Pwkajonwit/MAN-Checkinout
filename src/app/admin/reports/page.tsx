"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
    attendanceService,
    leaveService,
    otService,
    employeeService,
    type Attendance,
    type LeaveRequest,
    type OTRequest,
    type Employee
} from "@/lib/firestore";
import { useAdmin } from "@/components/auth/AuthProvider";
import {
    FileText,
    Clock,
    CalendarX,
    AlertTriangle,
    Search,
    ChevronLeft,
    ChevronRight
} from "lucide-react";
import {
    format,
    startOfMonth,
    endOfMonth,
    differenceInMinutes,
    startOfWeek,
    endOfWeek,
    addWeeks,
    subWeeks
} from "date-fns";
import { th } from "date-fns/locale";
import {
    formatLeaveDateRange,
    formatLeaveDuration,
    formatLeaveDayHourUnits,
    getLeaveDayUnits
} from "@/lib/leaveUtils";

export default function ReportsPage() {
    const { user } = useAdmin();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"ot" | "late" | "leave">("ot");

    // Period filter state: month | week | custom
    const [filterType, setFilterType] = useState<"month" | "week" | "custom">("month");
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
    });
    const [selectedWeekDate, setSelectedWeekDate] = useState(() => new Date());
    const [customRange, setCustomRange] = useState(() => {
        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() - 7);
        return {
            start: format(start, "yyyy-MM-dd"),
            end: format(today, "yyyy-MM-dd")
        };
    });

    const [searchQuery, setSearchQuery] = useState("");
    const [otData, setOtData] = useState<OTRequest[]>([]);
    const [lateData, setLateData] = useState<Attendance[]>([]);
    const [leaveData, setLeaveData] = useState<LeaveRequest[]>([]);
    const [allYearLeaves, setAllYearLeaves] = useState<LeaveRequest[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);

    // Date Range calculation
    const getDateRange = useCallback(() => {
        if (filterType === "month") {
            const [year, month] = selectedMonth.split("-").map(Number);
            const startDate = startOfMonth(new Date(year, month - 1));
            const endDate = endOfMonth(new Date(year, month - 1));
            return {
                startDate,
                endDate,
                label: `ประจำเดือน ${format(startDate, "MMMM yyyy", { locale: th })}`,
            };
        } else if (filterType === "week") {
            const startDate = startOfWeek(selectedWeekDate, { weekStartsOn: 1 });
            startDate.setHours(0, 0, 0, 0);
            const endDate = endOfWeek(selectedWeekDate, { weekStartsOn: 1 });
            endDate.setHours(23, 59, 59, 999);
            return {
                startDate,
                endDate,
                label: `สัปดาห์ ${format(startDate, "d MMM", { locale: th })} - ${format(endDate, "d MMM yyyy", { locale: th })}`,
            };
        } else {
            const [sy, sm, sd] = (customRange.start || format(new Date(), "yyyy-MM-dd")).split("-").map(Number);
            const [ey, em, ed] = (customRange.end || format(new Date(), "yyyy-MM-dd")).split("-").map(Number);
            const startDate = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
            const endDate = new Date(ey, em - 1, ed, 23, 59, 59, 999);
            return {
                startDate,
                endDate,
                label: `ช่วง ${format(startDate, "d MMM", { locale: th })} - ${format(endDate, "d MMM yyyy", { locale: th })}`,
            };
        }
    }, [filterType, selectedMonth, selectedWeekDate, customRange]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const { startDate, endDate } = getDateRange();

            const [otRes, attendanceRes, leaveRes, empRes] = await Promise.all([
                otService.getByDateRange(startDate, endDate),
                attendanceService.getByDateRange(startDate, endDate),
                leaveService.getByDateRange(startDate, endDate),
                employeeService.getAll(),
            ]);

            // Only approved OT
            setOtData(otRes.filter(o => o.status === "อนุมัติ"));

            // Only late check-ins
            setLateData(attendanceRes.filter(a => a.status === "สาย"));

            // Only approved leaves
            setLeaveData(leaveRes.filter(l => l.status === "อนุมัติ"));

            setEmployees(empRes);

            // Reset yearly data when range changes
            setAllYearLeaves([]);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    }, [getDateRange]);

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user, loadData]);

    // Load yearly leave data only when Leave tab is selected (lazy loading)
    const loadYearlyLeaveData = useCallback(async () => {
        try {
            const { startDate } = getDateRange();
            const year = startDate.getFullYear();
            const yearStart = new Date(year, 0, 1);
            const yearEnd = new Date(year, 11, 31);

            const yearLeaveRes = await leaveService.getByDateRange(yearStart, yearEnd);
            setAllYearLeaves(yearLeaveRes.filter(l => l.status === "อนุมัติ"));
        } catch (error) {
            console.error("Error loading yearly leave data:", error);
        }
    }, [getDateRange]);

    useEffect(() => {
        if (activeTab === "leave" && allYearLeaves.length === 0 && !loading) {
            loadYearlyLeaveData();
        }
    }, [activeTab, allYearLeaves.length, loading, loadYearlyLeaveData]);

    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0 && mins > 0) {
            return `${hours} ชม. ${mins} นาที`;
        }
        if (hours > 0) {
            return `${hours} ชม.`;
        }
        return `${mins} นาที`;
    };

    // นับครั้งที่ลาของพนักงานทั้งปี (เรียงตามวันที่)
    const getLeaveCountOfYear = (employeeId: string, leaveType: string, currentLeaveDate: Date) => {
        const employeeLeaves = allYearLeaves
            .filter(l => l.employeeId === employeeId && l.leaveType === leaveType)
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

        const index = employeeLeaves.findIndex(l =>
            new Date(l.startDate).getTime() === new Date(currentLeaveDate).getTime()
        );

        return index + 1; // ครั้งที่ (1-based)
    };

    // นับจำนวนครั้งทั้งหมดของปี
    const getTotalLeaveCountOfYear = (employeeId: string, leaveType: string) => {
        return allYearLeaves.filter(l =>
            l.employeeId === employeeId && l.leaveType === leaveType
        ).length;
    };

    // Month Navigation Helpers
    const handlePrevMonth = () => {
        const [y, m] = selectedMonth.split("-").map(Number);
        const prev = new Date(y, m - 2, 1);
        setSelectedMonth(`${prev.getFullYear()}-${(prev.getMonth() + 1).toString().padStart(2, "0")}`);
    };

    const handleNextMonth = () => {
        const [y, m] = selectedMonth.split("-").map(Number);
        const next = new Date(y, m, 1);
        setSelectedMonth(`${next.getFullYear()}-${(next.getMonth() + 1).toString().padStart(2, "0")}`);
    };

    const handleCurrentMonth = () => {
        const now = new Date();
        setSelectedMonth(`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`);
    };

    const isCurrentMonth = selectedMonth === format(new Date(), "yyyy-MM");

    // Summary Totals
    const totalOTMinutes = useMemo(() => {
        return otData.reduce((sum, ot) => {
            if (ot.startTime && ot.endTime) {
                return sum + differenceInMinutes(new Date(ot.endTime), new Date(ot.startTime));
            }
            return sum;
        }, 0);
    }, [otData]);

    const totalLateMinutes = useMemo(() => {
        return lateData.reduce((sum, att) => sum + (att.lateMinutes || 0), 0);
    }, [lateData]);

    const totalLeaveDays = useMemo(() => {
        return leaveData.reduce((sum, l) => sum + getLeaveDayUnits(l), 0);
    }, [leaveData]);

    // Search Filtering
    const filteredOT = useMemo(() => {
        if (!searchQuery.trim()) return otData;
        const q = searchQuery.toLowerCase();
        return otData.filter(ot =>
            ot.employeeName?.toLowerCase().includes(q) ||
            ot.reason?.toLowerCase().includes(q)
        );
    }, [otData, searchQuery]);

    const filteredLate = useMemo(() => {
        if (!searchQuery.trim()) return lateData;
        const q = searchQuery.toLowerCase();
        return lateData.filter(att =>
            att.employeeName?.toLowerCase().includes(q)
        );
    }, [lateData, searchQuery]);

    const filteredLeave = useMemo(() => {
        if (!searchQuery.trim()) return leaveData;
        const q = searchQuery.toLowerCase();
        return leaveData.filter(l =>
            l.employeeName?.toLowerCase().includes(q) ||
            l.leaveType?.toLowerCase().includes(q) ||
            l.reason?.toLowerCase().includes(q)
        );
    }, [leaveData, searchQuery]);

    const activeRange = getDateRange();

    if (!user) {
        return (
            <div className="py-12 text-center text-slate-700 font-normal">
                กรุณาเข้าสู่ระบบ
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                            รายงานและสถิติ
                        </h1>
                        <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            Reports & Analytics
                        </span>
                        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            {activeRange.label}
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm font-normal text-slate-500 mt-1">
                        สรุปข้อมูลการทำงานล่วงเวลา การมาสาย และการลาของพนักงาน
                    </p>
                </div>
            </div>

            {/* Interactive Stat Cards (mini-Compact Layout & High Contrast) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* OT Card */}
                <div
                    onClick={() => setActiveTab("ot")}
                    className={`bg-white rounded-xl p-3.5 border transition-all cursor-pointer shadow-xs ${
                        activeTab === "ot"
                            ? "border-blue-500 ring-2 ring-blue-100 bg-blue-50/20"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60">
                                <Clock className="w-4 h-4" />
                            </span>
                            <span className="text-xs font-semibold text-slate-700">การทำ OT (ล่วงเวลา)</span>
                        </div>
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    </div>
                    <div className="flex items-baseline justify-between mt-2.5">
                        <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                            {otData.length} <span className="text-xs font-normal text-slate-500">รายการ</span>
                        </div>
                        <div className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                            รวม {formatDuration(totalOTMinutes)}
                        </div>
                    </div>
                </div>

                {/* Late Card */}
                <div
                    onClick={() => setActiveTab("late")}
                    className={`bg-white rounded-xl p-3.5 border transition-all cursor-pointer shadow-xs ${
                        activeTab === "late"
                            ? "border-amber-500 ring-2 ring-amber-100 bg-amber-50/20"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60">
                                <AlertTriangle className="w-4 h-4" />
                            </span>
                            <span className="text-xs font-semibold text-slate-700">การมาสาย</span>
                        </div>
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    </div>
                    <div className="flex items-baseline justify-between mt-2.5">
                        <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                            {lateData.length} <span className="text-xs font-normal text-slate-500">ครั้ง</span>
                        </div>
                        <div className="text-xs font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 tabular-nums">
                            รวม {totalLateMinutes.toLocaleString()} นาที
                        </div>
                    </div>
                </div>

                {/* Leave Card */}
                <div
                    onClick={() => setActiveTab("leave")}
                    className={`bg-white rounded-xl p-3.5 border transition-all cursor-pointer shadow-xs ${
                        activeTab === "leave"
                            ? "border-purple-500 ring-2 ring-purple-100 bg-purple-50/20"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200/60">
                                <CalendarX className="w-4 h-4" />
                            </span>
                            <span className="text-xs font-semibold text-slate-700">การลางาน (อนุมัติ)</span>
                        </div>
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    </div>
                    <div className="flex items-baseline justify-between mt-2.5">
                        <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                            {leaveData.length} <span className="text-xs font-normal text-slate-500">รายการ</span>
                        </div>
                        <div className="text-xs font-medium text-purple-800 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/60 tabular-nums">
                            รวม {totalLeaveDays} วัน
                        </div>
                    </div>
                </div>
            </div>

            {/* Compact Toolbar (Filters, Mode Switcher, Tab Switcher & Search h-9) */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-2.5 sm:p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Period Mode Switcher (รายเดือน | สัปดาห์ | กำหนดเอง) */}
                    <div className="inline-flex items-center h-9 p-0.5 bg-slate-100 rounded-lg border border-slate-200/80">
                        <button
                            type="button"
                            onClick={() => setFilterType("month")}
                            className={`h-7 px-2.5 rounded-md text-xs transition-all ${
                                filterType === "month"
                                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                                    : "text-slate-600 hover:text-slate-900 font-normal"
                            }`}
                        >
                            รายเดือน
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterType("week")}
                            className={`h-7 px-2.5 rounded-md text-xs transition-all ${
                                filterType === "week"
                                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                                    : "text-slate-600 hover:text-slate-900 font-normal"
                            }`}
                        >
                            สัปดาห์
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterType("custom")}
                            className={`h-7 px-2.5 rounded-md text-xs transition-all ${
                                filterType === "custom"
                                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                                    : "text-slate-600 hover:text-slate-900 font-normal"
                            }`}
                        >
                            กำหนดเอง
                        </button>
                    </div>

                    {/* Month Picker: clean without duplicate icon */}
                    {filterType === "month" && (
                        <div className="inline-flex items-center gap-1.5">
                            <div className="inline-flex items-center h-9 bg-slate-50 rounded-lg border border-slate-200 px-1">
                                <button
                                    type="button"
                                    onClick={handlePrevMonth}
                                    title="เดือนก่อนหน้า"
                                    className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-all"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="bg-transparent h-7 px-2 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none cursor-pointer"
                                />
                                <button
                                    type="button"
                                    onClick={handleNextMonth}
                                    title="เดือนถัดไป"
                                    className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-all"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>

                            {!isCurrentMonth && (
                                <button
                                    type="button"
                                    onClick={handleCurrentMonth}
                                    className="h-9 px-2.5 text-xs font-medium text-blue-700 bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200 rounded-lg transition-colors"
                                >
                                    เดือนนี้
                                </button>
                            )}
                        </div>
                    )}

                    {/* Week Picker */}
                    {filterType === "week" && (
                        <div className="inline-flex items-center gap-1.5">
                            <div className="inline-flex items-center h-9 bg-slate-50 rounded-lg border border-slate-200 px-1">
                                <button
                                    type="button"
                                    onClick={() => setSelectedWeekDate(prev => subWeeks(prev, 1))}
                                    title="สัปดาห์ก่อนหน้า"
                                    className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-all"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <input
                                    type="date"
                                    value={format(selectedWeekDate, "yyyy-MM-dd")}
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            const [y, m, d] = e.target.value.split('-').map(Number);
                                            setSelectedWeekDate(new Date(y, m - 1, d));
                                        }
                                    }}
                                    className="bg-transparent h-7 px-2 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none cursor-pointer"
                                />
                                <button
                                    type="button"
                                    onClick={() => setSelectedWeekDate(prev => addWeeks(prev, 1))}
                                    title="สัปดาห์ถัดไป"
                                    className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-all"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedWeekDate(new Date())}
                                className="h-9 px-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
                            >
                                สัปดาห์นี้
                            </button>
                            <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-md border border-blue-100 hidden sm:inline-block">
                                {format(startOfWeek(selectedWeekDate, { weekStartsOn: 1 }), "d MMM", { locale: th })} - {format(endOfWeek(selectedWeekDate, { weekStartsOn: 1 }), "d MMM yyyy", { locale: th })}
                            </span>
                        </div>
                    )}

                    {/* Custom Date Range Picker (กำหนดวัน ถึงวัน) */}
                    {filterType === "custom" && (
                        <div className="inline-flex items-center h-9 gap-1.5">
                            <input
                                type="date"
                                value={customRange.start}
                                onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                                className="h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-normal text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer"
                            />
                            <span className="text-slate-500 text-xs font-normal">ถึง</span>
                            <input
                                type="date"
                                value={customRange.end}
                                onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                                className="h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-normal text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer"
                            />
                        </div>
                    )}

                    {/* View Switcher Tabs (h-9) */}
                    <div className="inline-flex items-center h-9 bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
                        <button
                            onClick={() => setActiveTab("ot")}
                            className={`h-7 px-3 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                activeTab === "ot"
                                    ? "bg-white text-blue-700 shadow-2xs"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            <Clock className="w-3.5 h-3.5" />
                            OT ({otData.length})
                        </button>
                        <button
                            onClick={() => setActiveTab("late")}
                            className={`h-7 px-3 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                activeTab === "late"
                                    ? "bg-white text-amber-700 shadow-2xs"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            สาย ({lateData.length})
                        </button>
                        <button
                            onClick={() => setActiveTab("leave")}
                            className={`h-7 px-3 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                activeTab === "leave"
                                    ? "bg-white text-purple-700 shadow-2xs"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            <CalendarX className="w-3.5 h-3.5" />
                            ลา ({leaveData.length})
                        </button>
                    </div>
                </div>

                {/* Search Input (h-9) */}
                <div className="relative w-full sm:w-60 ml-auto">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="ค้นหาชื่อพนักงาน, เหตุผล..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-9 pl-9 pr-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                </div>
            </div>

            {/* Content Table Container */}
            {loading ? (
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-12 text-center text-slate-600">
                    <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                    <span className="text-sm font-normal">กำลังประมวลผลข้อมูล...</span>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
                    {/* Header Bar above table */}
                    <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between text-xs">
                        <div className="font-semibold text-slate-800">
                            {activeTab === "ot" && "รายการคำขอทำ OT ที่อนุมัติแล้ว"}
                            {activeTab === "late" && "ประวัติการมาสายของพนักงาน"}
                            {activeTab === "leave" && "รายการการลางานที่อนุมัติแล้ว"}
                        </div>
                        <div className="text-slate-500 font-normal">
                            พบ{" "}
                            <span className="font-semibold text-slate-800 tabular-nums">
                                {activeTab === "ot" ? filteredOT.length : activeTab === "late" ? filteredLate.length : filteredLeave.length}
                            </span>{" "}
                            รายการ
                        </div>
                    </div>

                    {/* OT Report Table */}
                    {activeTab === "ot" && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-800">
                                    <tr>
                                        <th className="px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider">วันที่</th>
                                        <th className="px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider">พนักงาน</th>
                                        <th className="px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider">ช่วงเวลา</th>
                                        <th className="px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider">ระยะเวลา</th>
                                        <th className="px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider">เหตุผล</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredOT.map((ot, idx) => {
                                        const duration = differenceInMinutes(new Date(ot.endTime), new Date(ot.startTime));
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="px-3.5 py-2.5 text-xs sm:text-sm font-normal text-slate-700 whitespace-nowrap tabular-nums">
                                                    {format(new Date(ot.date), "d MMM yyyy", { locale: th })}
                                                </td>
                                                <td className="px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900">
                                                    {ot.employeeName}
                                                </td>
                                                <td className="px-3.5 py-2.5 text-xs sm:text-sm font-normal text-slate-700 tabular-nums whitespace-nowrap">
                                                    {format(new Date(ot.startTime), "HH:mm")} - {format(new Date(ot.endTime), "HH:mm")}
                                                </td>
                                                <td className="px-3.5 py-2.5">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 tabular-nums">
                                                        {formatDuration(duration)}
                                                    </span>
                                                </td>
                                                <td className="px-3.5 py-2.5 text-xs sm:text-sm font-normal text-slate-600 max-w-[280px] truncate" title={ot.reason}>
                                                    {ot.reason || "-"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredOT.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <FileText className="w-7 h-7 text-slate-300" />
                                                    <span className="text-xs sm:text-sm font-normal">ไม่มีรายการ OT ในช่วงเวลานี้</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Late Report Table */}
                    {activeTab === "late" && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-800">
                                    <tr>
                                        <th className="px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider">วันที่</th>
                                        <th className="px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider">พนักงาน</th>
                                        <th className="px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider">เวลาเข้างานจริง</th>
                                        <th className="px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider">สาย (นาที)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredLate.map((att, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-3.5 py-2.5 text-xs sm:text-sm font-normal text-slate-700 whitespace-nowrap tabular-nums">
                                                {format(new Date(att.date), "d MMM yyyy", { locale: th })}
                                            </td>
                                            <td className="px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900">
                                                {att.employeeName}
                                            </td>
                                            <td className="px-3.5 py-2.5 text-xs sm:text-sm font-normal text-slate-700 tabular-nums">
                                                {att.checkIn ? format(new Date(att.checkIn), "HH:mm") : "-"}
                                            </td>
                                            <td className="px-3.5 py-2.5">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 tabular-nums">
                                                    +{att.lateMinutes} นาที
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredLate.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <Clock className="w-7 h-7 text-slate-300" />
                                                    <span className="text-xs sm:text-sm font-normal">ไม่มีรายการมาสายในช่วงเวลานี้</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Leave Report Table */}
                    {activeTab === "leave" && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-800">
                                    <tr>
                                        <th className="px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider">พนักงาน</th>
                                        <th className="px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider">ประเภทการลา</th>
                                        <th className="px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider">ช่วงวันที่</th>
                                        <th className="px-3.5 py-2.5 text-center text-xs font-semibold uppercase tracking-wider">ระยะเวลา</th>
                                        <th className="px-3.5 py-2.5 text-center text-xs font-semibold uppercase tracking-wider">สถิติปีนี้</th>
                                        <th className="px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider">เหตุผล</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredLeave.map((leave, idx) => {
                                        const days = getLeaveDayUnits(leave);
                                        const count = getLeaveCountOfYear(leave.employeeId, leave.leaveType, new Date(leave.startDate));
                                        const total = getTotalLeaveCountOfYear(leave.employeeId, leave.leaveType);

                                        let typeColorClass = "bg-slate-50 text-slate-700 border-slate-200";
                                        if (leave.leaveType === "ลาป่วย") typeColorClass = "bg-rose-50 text-rose-700 border-rose-200/80";
                                        else if (leave.leaveType === "ลากิจ") typeColorClass = "bg-blue-50 text-blue-700 border-blue-200/80";
                                        else if (leave.leaveType === "ลาพักร้อน") typeColorClass = "bg-emerald-50 text-emerald-700 border-emerald-200/80";

                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900">
                                                    {leave.employeeName}
                                                </td>
                                                <td className="px-3.5 py-2.5">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${typeColorClass}`}>
                                                        {leave.leaveType}
                                                    </span>
                                                </td>
                                                <td className="px-3.5 py-2.5 text-xs sm:text-sm font-normal text-slate-700 whitespace-nowrap">
                                                    {formatLeaveDateRange(leave)}
                                                </td>
                                                <td className="px-3.5 py-2.5 text-center">
                                                    <span className="text-xs sm:text-sm font-semibold text-slate-800 tabular-nums">
                                                        {leave.leaveType === "ลากิจ" ? formatLeaveDayHourUnits(days) : formatLeaveDuration(leave)}
                                                    </span>
                                                </td>
                                                <td className="px-3.5 py-2.5 text-center">
                                                    <div className="inline-flex flex-col text-xs text-slate-500">
                                                        <span className="font-semibold text-slate-900">ครั้งที่ {count}</span>
                                                        <span className="text-[10px] font-normal text-slate-500">รวม {total} ครั้ง</span>
                                                    </div>
                                                </td>
                                                <td className="px-3.5 py-2.5 text-xs sm:text-sm font-normal text-slate-600 max-w-[280px] truncate" title={leave.reason}>
                                                    {leave.reason || "-"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredLeave.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <CalendarX className="w-7 h-7 text-slate-300" />
                                                    <span className="text-xs sm:text-sm font-normal">ไม่มีรายการลาในช่วงเวลานี้</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
