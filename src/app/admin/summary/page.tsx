"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { attendanceService, employeeService, swapService, systemConfigService, type Employee } from "@/lib/firestore";
import { useAdmin } from "@/components/auth/AuthProvider";
import { Users, Calendar, Download, Search, Send, ChevronLeft, ChevronRight, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatMinutesToHours } from "@/lib/workTime";
import { format } from "date-fns";
import { th } from "date-fns/locale";

interface DailySummary {
    date: Date;
    employee: Employee;
    checkIn?: Date | null;
    checkOut?: Date | null;
    isLate: boolean;
    lateMinutes?: number;
    offsiteCount: number;
    status: "ปกติ" | "สาย" | "ไม่มาทำงาน" | "ลา" | "วันหยุด";
}

export default function DailySummaryPage() {
    const { user } = useAdmin();
    const [loading, setLoading] = useState(true);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [summaries, setSummaries] = useState<DailySummary[]>([]);
    const [sendingNotification, setSendingNotification] = useState(false);

    const [selectedDate, setSelectedDate] = useState(() => {
        return format(new Date(), "yyyy-MM-dd");
    });

    const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const date = new Date(selectedDate);
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);

            const [empData, attData, configData, allSwaps] = await Promise.all([
                employeeService.getAll(),
                attendanceService.getByDateRange(startDate, endDate),
                systemConfigService.get(),
                swapService.getAll()
            ]);

            const activeEmployees = empData.filter(e => e.status === "ทำงาน");
            setEmployees(activeEmployees);

            const dateStr = format(date, "yyyy-MM-dd");

            // Filter approved swaps that affect the selected date
            const approvedSwaps = allSwaps.filter(s => s.status === "อนุมัติ");

            // Build summaries
            const daySummaries: DailySummary[] = activeEmployees.map(emp => {
                const empAttendances = attData.filter(a => a.employeeId === emp.id);

                const checkInRec = empAttendances.find(a => a.status === "เข้างาน");
                const checkOutRec = empAttendances.find(a => a.status === "ออกงาน");
                const lateRec = empAttendances.find(a => a.status === "สาย");
                const offsiteRecs = empAttendances.filter(a =>
                    a.status === "ออกนอกพื้นที่ขาไป" || a.status === "ออกนอกพื้นที่ขากลับ"
                );

                const hasCheckedIn = checkInRec || lateRec;

                // Determine weekly holidays based on useIndividualHolidays setting
                const useIndividualHolidays = configData?.useIndividualHolidays ?? false;
                const globalHolidays = configData?.weeklyHolidays || [0, 6];
                const employeeHolidays = emp.weeklyHolidays || globalHolidays;

                // Use individual or global based on setting
                const applicableHolidays = useIndividualHolidays ? employeeHolidays : globalHolidays;

                // Check if this day is a weekly holiday for this employee
                const isWeeklyHoliday = applicableHolidays.includes(date.getDay());

                // Check swap status for this employee on this date
                const employeeSwaps = approvedSwaps.filter(s => s.employeeId === emp.id);
                let effectiveHoliday = isWeeklyHoliday;

                employeeSwaps.forEach(swap => {
                    const workDate = swap.workDate instanceof Date ? swap.workDate : new Date(swap.workDate);
                    const holidayDate = swap.holidayDate instanceof Date ? swap.holidayDate : new Date(swap.holidayDate);

                    if (format(workDate, "yyyy-MM-dd") === dateStr) {
                        effectiveHoliday = false;
                    }
                    if (format(holidayDate, "yyyy-MM-dd") === dateStr) {
                        effectiveHoliday = true;
                    }
                });

                const actualLateMinutes = lateRec?.lateMinutes || checkInRec?.lateMinutes || 0;
                const isActuallyLate = actualLateMinutes > 0;

                let status: DailySummary["status"] = "ไม่มาทำงาน";
                if (effectiveHoliday) {
                    status = "วันหยุด";
                } else if (lateRec || isActuallyLate) {
                    status = "สาย";
                } else if (hasCheckedIn) {
                    status = "ปกติ";
                }

                return {
                    date,
                    employee: emp,
                    checkIn: checkInRec?.checkIn || lateRec?.checkIn,
                    checkOut: checkOutRec?.checkOut,
                    isLate: isActuallyLate,
                    lateMinutes: actualLateMinutes > 0 ? actualLateMinutes : undefined,
                    offsiteCount: offsiteRecs.length,
                    status,
                };
            });

            setSummaries(daySummaries);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user, loadData]);

    const changeDate = (days: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        setSelectedDate(format(d, "yyyy-MM-dd"));
    };

    const formatThaiDate = (dateString: string) => {
        try {
            const [y, m, d] = dateString.split("-").map(Number);
            const dateObj = new Date(y, m - 1, d);
            const thaiYear = dateObj.getFullYear() + 543;
            return `${format(dateObj, "EEEEที่ d MMMM", { locale: th })} ${thaiYear}`;
        } catch {
            return dateString;
        }
    };

    const formatTime = (date?: Date | null) => {
        if (!date) return "-";
        return format(new Date(date), "HH:mm");
    };

    const getStatusBadge = (status: DailySummary["status"]) => {
        switch (status) {
            case "ปกติ":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-xs font-normal">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        ปกติ
                    </span>
                );
            case "สาย":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-full text-xs font-normal">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        สาย
                    </span>
                );
            case "ไม่มาทำงาน":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200/80 rounded-full text-xs font-normal">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        ไม่มา
                    </span>
                );
            case "ลา":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-full text-xs font-normal">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        ลา
                    </span>
                );
            case "วันหยุด":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-full text-xs font-normal">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        วันหยุด
                    </span>
                );
        }
    };

    // Filter by employee and search query
    const filteredSummaries = summaries.filter(s => {
        const matchesEmployee = selectedEmployee === "all" || s.employee.id === selectedEmployee;
        const matchesSearch = searchQuery === "" ||
            s.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.employee.department || "").toLowerCase().includes(searchQuery.toLowerCase());
        return matchesEmployee && matchesSearch;
    });

    // Stats
    const stats = {
        total: filteredSummaries.length,
        normal: filteredSummaries.filter(s => s.status === "ปกติ").length,
        late: filteredSummaries.filter(s => s.status === "สาย").length,
        absent: filteredSummaries.filter(s => s.status === "ไม่มาทำงาน").length,
        holiday: filteredSummaries.filter(s => s.status === "วันหยุด").length,
    };

    // Export CSV
    const exportCSV = () => {
        const headers = ["พนักงาน", "แผนก", "สถานะ", "เข้างาน", "ออกงาน", "ออกพื้นที่", "สาย(นาที)"];
        const rows = filteredSummaries.map(s => [
            s.employee.name,
            s.employee.department || "-",
            s.status,
            formatTime(s.checkIn),
            formatTime(s.checkOut),
            s.offsiteCount > 0 ? `${s.offsiteCount} ครั้ง` : "-",
            s.lateMinutes ? s.lateMinutes.toString() : "-",
        ]);

        const csvContent = "\uFEFF" + [headers, ...rows].map(row => row.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `สรุปรายวัน_${selectedDate}.csv`;
        link.click();
    };

    const sendDailyReportNotification = async () => {
        setSendingNotification(true);
        try {
            const response = await fetch(`/api/cron/daily-report?date=${encodeURIComponent(selectedDate)}`);
            const result = await response.json().catch(() => null);

            if (!response.ok || result?.success === false) {
                throw new Error(result?.message || "ส่งแจ้งเตือนไม่สำเร็จ");
            }

            alert("ส่งแจ้งเตือนสรุปรายวันแล้ว");
        } catch (error) {
            console.error("Error sending daily report notification:", error);
            alert(error instanceof Error ? error.message : "ส่งแจ้งเตือนไม่สำเร็จ");
        } finally {
            setSendingNotification(false);
        }
    };

    if (!user) {
        return <div className="py-12 text-center text-slate-500 font-normal">กรุณาเข้าสู่ระบบ</div>;
    }

    const isToday = selectedDate === format(new Date(), "yyyy-MM-dd");

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl sm:text-2xl font-semibold text-slate-800 tracking-tight">สรุปรายวัน</h1>
                        <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            Daily Summary
                        </span>
                        {isToday && (
                            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                วันนี้
                            </span>
                        )}
                    </div>
                    <p className="text-xs sm:text-sm font-normal text-slate-500 mt-1">
                        สรุปการลงเวลารายบุคคล • {formatThaiDate(selectedDate)}
                    </p>
                </div>
            </div>

            {/* Compact Filters & Controls */}
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
                            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
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
                            onClick={() => setSelectedDate(format(new Date(), "yyyy-MM-dd"))}
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
                            placeholder="ค้นหาชื่อ หรือ แผนก..."
                            className="h-9 pl-8 pr-7 py-1 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-normal text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 w-44 sm:w-56 transition-all"
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

                    {/* Employee Dropdown */}
                    <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-500 hidden sm:inline shrink-0" />
                        <select
                            value={selectedEmployee}
                            onChange={(e) => setSelectedEmployee(e.target.value)}
                            className="h-9 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-normal text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 max-w-[190px] transition-all"
                        >
                            <option value="all">พนักงานทั้งหมด ({employees.length})</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Actions: Export & Send Notification */}
                <div className="flex items-center gap-2 ml-auto">
                    <button
                        onClick={exportCSV}
                        disabled={filteredSummaries.length === 0}
                        className="h-9 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export CSV</span>
                    </button>

                    <button
                        onClick={sendDailyReportNotification}
                        disabled={sendingNotification || loading}
                        className="h-9 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-medium rounded-lg shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Send className={`w-3.5 h-3.5 ${sendingNotification ? "animate-pulse" : ""}`} />
                        <span>{sendingNotification ? "กำลังส่ง..." : "ส่งแจ้งเตือน"}</span>
                    </button>
                </div>
            </div>

            {/* Compact & Clean Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-2.5">
                {/* ทั้งหมด */}
                <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">ทั้งหมด</span>
                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">{stats.total}</div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">พนักงาน</div>
                </div>

                {/* ปกติ */}
                <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">ตรงเวลา (ปกติ)</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">{stats.normal}</div>
                    <div className="text-[11px] font-normal text-emerald-600 mt-0.5">
                        {stats.total > 0 ? `${Math.round((stats.normal / stats.total) * 100)}% ของทั้งหมด` : "-"}
                    </div>
                </div>

                {/* สาย */}
                <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">มาสาย</span>
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">{stats.late}</div>
                    <div className="text-[11px] font-normal text-amber-600 mt-0.5">
                        {stats.total > 0 ? `${Math.round((stats.late / stats.total) * 100)}% ของทั้งหมด` : "-"}
                    </div>
                </div>

                {/* ไม่มา */}
                <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">ไม่มาทำงาน</span>
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">{stats.absent}</div>
                    <div className="text-[11px] font-normal text-rose-600 mt-0.5">
                        {stats.total > 0 ? `${Math.round((stats.absent / stats.total) * 100)}% ของทั้งหมด` : "-"}
                    </div>
                </div>

                {/* วันหยุด */}
                <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all col-span-2 sm:col-span-1 md:col-span-1">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">วันหยุด</span>
                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">{stats.holiday}</div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">วันหยุดสัปดาห์ / สลับวัน</div>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-10 text-center text-slate-500 font-normal">
                    <div className="animate-spin w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                    กำลังโหลดข้อมูลสรุป...
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50/80 border-b border-slate-200">
                                <tr>
                                    <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">พนักงาน</th>
                                    <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">สถานะ</th>
                                    <th className="px-3.5 py-2.5 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">เข้างาน</th>
                                    <th className="px-3.5 py-2.5 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">ออกงาน</th>
                                    <th className="px-3.5 py-2.5 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">ออกพื้นที่</th>
                                    <th className="px-3.5 py-2.5 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">หมายเหตุ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredSummaries.map((summary, idx) => (
                                    <tr key={summary.employee.id || idx} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="px-3.5 py-2.5">
                                            <Link
                                                href={`/admin/search?employeeId=${encodeURIComponent(summary.employee.id || summary.employee.employeeId || "")}&month=${selectedDate.substring(0, 7)}`}
                                                className="group flex items-center gap-2.5 hover:opacity-95 transition-opacity"
                                                title={`ดูประวัติและจัดการข้อมูล ${summary.employee.name}`}
                                            >
                                                <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-medium text-xs flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-slate-200 group-hover:ring-blue-400 group-hover:ring-2 transition-all">
                                                    {summary.employee.avatar ? (
                                                        <img
                                                            src={summary.employee.avatar}
                                                            alt={summary.employee.name}
                                                            className="h-full w-full object-cover"
                                                            onError={(event) => {
                                                                event.currentTarget.style.display = "none";
                                                            }}
                                                        />
                                                    ) : (
                                                        summary.employee.name.charAt(0)
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-medium text-slate-800 text-sm leading-tight truncate group-hover:text-blue-600 group-hover:underline transition-colors">
                                                        {summary.employee.name}
                                                    </div>
                                                    <div className="text-xs font-normal text-slate-500 leading-tight">
                                                        {summary.employee.department || "-"}
                                                    </div>
                                                </div>
                                            </Link>
                                        </td>
                                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                                            {getStatusBadge(summary.status)}
                                        </td>
                                        <td className="px-3.5 py-2.5 text-center text-sm whitespace-nowrap">
                                            {summary.isLate ? (
                                                <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-normal tabular-nums">
                                                    {formatTime(summary.checkIn)}
                                                </span>
                                            ) : (
                                                <span className={`tabular-nums font-normal ${summary.checkIn ? "text-slate-800" : "text-slate-400"}`}>
                                                    {formatTime(summary.checkIn)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3.5 py-2.5 text-center text-sm whitespace-nowrap">
                                            <span className={`tabular-nums font-normal ${summary.checkOut ? "text-slate-800" : "text-slate-400"}`}>
                                                {formatTime(summary.checkOut)}
                                            </span>
                                        </td>
                                        <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                            {summary.offsiteCount > 0 ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200/80 rounded-full text-xs font-normal">
                                                    {summary.offsiteCount} ครั้ง
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 font-normal text-sm">-</span>
                                            )}
                                        </td>
                                        <td className="px-3.5 py-2.5 text-center text-sm whitespace-nowrap">
                                            {summary.isLate && summary.lateMinutes ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-xs font-normal">
                                                    <Clock className="w-3 h-3 text-amber-600" />
                                                    สาย {formatMinutesToHours(summary.lateMinutes)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 font-normal text-sm">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredSummaries.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center text-slate-500 font-normal">
                                            ไม่พบข้อมูลพนักงานที่ตรงกับเงื่อนไขการค้นหา
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Table Summary Footer */}
                    <div className="px-3.5 py-2.5 bg-slate-50/80 border-t border-slate-200 text-xs font-normal text-slate-500 flex flex-wrap items-center justify-between gap-2">
                        <span>
                            แสดงผล <span className="text-slate-800 font-medium">{filteredSummaries.length}</span> จากทั้งหมด <span className="text-slate-800 font-medium">{summaries.length}</span> คน
                        </span>
                        <div className="flex items-center gap-3 text-xs">
                            <span className="text-emerald-700">✓ ปกติ: {stats.normal}</span>
                            <span className="text-amber-700">⏰ สาย: {stats.late}</span>
                            <span className="text-rose-700">✗ ไม่มา: {stats.absent}</span>
                            <span className="text-slate-600">🏖 วันหยุด: {stats.holiday}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
