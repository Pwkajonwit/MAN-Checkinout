"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { attendanceService, employeeService, swapService, systemConfigService, type Attendance, type Employee, type SwapRequest } from "@/lib/firestore";
import { useAdmin } from "@/components/auth/AuthProvider";
import { Users, Calendar, Clock, CheckCircle, XCircle, AlertTriangle, Download, Search } from "lucide-react";
import { formatMinutesToHours } from "@/lib/workTime";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
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
    const [attendances, setAttendances] = useState<Attendance[]>([]);
    const [summaries, setSummaries] = useState<DailySummary[]>([]);

    const [selectedDate, setSelectedDate] = useState(() => {
        return format(new Date(), "yyyy-MM-dd");
    });

    const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user, selectedDate]);

    const loadData = async () => {
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
            setAttendances(attData);

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
                const employeeHolidays = emp.weeklyHolidays || globalHolidays; // Fallback to global if employee doesn't have

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

                    // ถ้าวันนี้เป็นวันที่ขอมาทำงาน (workDate) → ไม่ใช่วันหยุด
                    if (format(workDate, "yyyy-MM-dd") === dateStr) {
                        effectiveHoliday = false;
                    }
                    // ถ้าวันนี้เป็นวันที่ขอหยุดแทน (holidayDate) → เป็นวันหยุด
                    if (format(holidayDate, "yyyy-MM-dd") === dateStr) {
                        effectiveHoliday = true;
                    }
                });

                // ดึง lateMinutes จาก record (อาจอยู่ใน checkInRec หรือ lateRec)
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
    };

    const formatTime = (date?: Date | null) => {
        if (!date) return "-";
        return format(new Date(date), "HH:mm");
    };

    const getStatusBadge = (status: DailySummary["status"]) => {
        switch (status) {
            case "ปกติ":
                return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">✓ ปกติ</span>;
            case "สาย":
                return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">⏰ สาย</span>;
            case "ไม่มาทำงาน":
                return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">✗ ไม่มา</span>;
            case "ลา":
                return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">📝 ลา</span>;
            case "วันหยุด":
                return <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">🏖 วันหยุด</span>;
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

    if (!user) {
        return <div className="p-8 text-center">กรุณาเข้าสู่ระบบ</div>;
    }

    return (
        <div className="flex-1 p-8">
            <PageHeader
                title="สรุปรายวัน"
                subtitle="สรุปการลงเวลารายบุคคลในแต่ละวัน"
            />

            {/* Filters */}
            <div className="mb-6 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-gray-500" />
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Search className="w-5 h-5 text-gray-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ค้นหาชื่อ หรือ แผนก..."
                        className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-gray-500" />
                    <select
                        value={selectedEmployee}
                        onChange={(e) => setSelectedEmployee(e.target.value)}
                        className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">พนักงานทั้งหมด</option>
                        {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={exportCSV}
                    disabled={filteredSummaries.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Download className="w-4 h-4" />
                    Export CSV
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
                    <div className="text-sm text-gray-500">ทั้งหมด</div>
                </div>
                <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                    <div className="text-2xl font-bold text-green-700">{stats.normal}</div>
                    <div className="text-sm text-green-600">ปกติ</div>
                </div>
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                    <div className="text-2xl font-bold text-orange-700">{stats.late}</div>
                    <div className="text-sm text-orange-600">สาย</div>
                </div>
                <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                    <div className="text-2xl font-bold text-red-700">{stats.absent}</div>
                    <div className="text-sm text-red-600">ไม่มา</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="text-2xl font-bold text-gray-700">{stats.holiday}</div>
                    <div className="text-sm text-gray-500">วันหยุด</div>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="text-center py-8">กำลังโหลด...</div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">พนักงาน</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">สถานะ</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">เข้างาน</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">ออกงาน</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">ออกพื้นที่</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">หมายเหตุ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredSummaries.map((summary, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-sm">
                                                    {summary.employee.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-800 text-sm">{summary.employee.name}</div>
                                                    <div className="text-xs text-gray-500">{summary.employee.department}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">{getStatusBadge(summary.status)}</td>
                                        <td className="px-4 py-3 text-center text-sm">
                                            <span className={summary.isLate ? "text-orange-600 font-medium" : "text-gray-700"}>
                                                {formatTime(summary.checkIn)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm text-gray-700">{formatTime(summary.checkOut)}</td>
                                        <td className="px-4 py-3 text-center">
                                            {summary.offsiteCount > 0 ? (
                                                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                                                    {summary.offsiteCount} ครั้ง
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-sm">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm">
                                            {summary.isLate && summary.lateMinutes && (
                                                <span className="text-orange-600">สาย {formatMinutesToHours(summary.lateMinutes)}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredSummaries.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                                            ไม่มีข้อมูล
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
