"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { attendanceService, leaveService, otService, employeeService, type Attendance, type LeaveRequest, type OTRequest, type Employee } from "@/lib/firestore";
import { useAdmin } from "@/components/auth/AuthProvider";
import { FileText, Clock, CalendarX, AlertTriangle } from "lucide-react";
import { format, startOfMonth, endOfMonth, differenceInMinutes, differenceInDays } from "date-fns";
import { th } from "date-fns/locale";

export default function ReportsPage() {
    const { user } = useAdmin();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"ot" | "late" | "leave">("ot");

    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
    });

    const [otData, setOtData] = useState<OTRequest[]>([]);
    const [lateData, setLateData] = useState<Attendance[]>([]);
    const [leaveData, setLeaveData] = useState<LeaveRequest[]>([]);
    const [allYearLeaves, setAllYearLeaves] = useState<LeaveRequest[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user, selectedMonth]);

    // Load yearly leave data only when Leave tab is selected (lazy loading)
    useEffect(() => {
        if (activeTab === "leave" && allYearLeaves.length === 0 && !loading) {
            loadYearlyLeaveData();
        }
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [year, month] = selectedMonth.split("-").map(Number);
            const startDate = startOfMonth(new Date(year, month - 1));
            const endDate = endOfMonth(new Date(year, month - 1));

            // Load only current month data on initial load (faster!)
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

            // Reset yearly data when month changes
            setAllYearLeaves([]);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Separate function for loading yearly leave data (expensive operation)
    const loadYearlyLeaveData = async () => {
        try {
            const [year] = selectedMonth.split("-").map(Number);
            const yearStart = new Date(year, 0, 1);
            const yearEnd = new Date(year, 11, 31);

            const yearLeaveRes = await leaveService.getByDateRange(yearStart, yearEnd);
            setAllYearLeaves(yearLeaveRes.filter(l => l.status === "อนุมัติ"));
        } catch (error) {
            console.error("Error loading yearly leave data:", error);
        }
    };

    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) {
            return `${hours} ชม. ${mins} นาที`;
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

    if (!user) {
        return <div className="p-8 text-center text-gray-500">กรุณาเข้าสู่ระบบ</div>;
    }

    return (
        <div className="flex-1 px-8 py-8 space-y-6">
            <PageHeader
                title="รายงานและสถิติ (Reports)"
                subtitle="สรุปข้อมูลการทำงานล่วงเวลา การมาสาย และการลาของพนักงาน"
            />

            {/* Controls */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex flex-col md:flex-row gap-6 justify-between items-end">
                    {/* Month Selector */}
                    <div className="space-y-2 w-full md:w-auto">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">ประจำเดือน</label>
                        <div className="relative">
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="h-10 pl-4 pr-8 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white hover:border-blue-400 transition-colors w-full md:w-[200px]"
                            />
                        </div>
                    </div>

                    {/* View Tabs (Segmented Control) */}
                    <div className="flex bg-gray-100 p-1 rounded-lg w-full md:w-auto">
                        <button
                            onClick={() => setActiveTab("ot")}
                            className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === "ot"
                                ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5"
                                : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            <Clock className="w-4 h-4" />
                            OT <span className="ml-1 text-xs opacity-70">({otData.length})</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("late")}
                            className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === "late"
                                ? "bg-white text-orange-600 shadow-sm ring-1 ring-black/5"
                                : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            <AlertTriangle className="w-4 h-4" />
                            มาสาย <span className="ml-1 text-xs opacity-70">({lateData.length})</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("leave")}
                            className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === "leave"
                                ? "bg-white text-purple-600 shadow-sm ring-1 ring-black/5"
                                : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            <CalendarX className="w-4 h-4" />
                            การลา <span className="ml-1 text-xs opacity-70">({leaveData.length})</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Content */}
            {loading ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-500">
                    <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                    กำลังประมวลผลข้อมูล...
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
                    {/* OT Report Table */}
                    {activeTab === "ot" && (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50/50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">วันที่</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">พนักงาน</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ช่วงเวลา</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ระยะเวลา</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">เหตุผล</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {otData.map((ot, idx) => {
                                        const duration = differenceInMinutes(new Date(ot.endTime), new Date(ot.startTime));
                                        return (
                                            <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                                                <td className="px-6 py-4 text-sm text-gray-600 font-medium whitespace-nowrap">
                                                    {format(new Date(ot.date), "d MMM yyyy", { locale: th })}
                                                </td>
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                    {ot.employeeName}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 tabular-nums">
                                                    {format(new Date(ot.startTime), "HH:mm")} - {format(new Date(ot.endTime), "HH:mm")}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                                        {formatDuration(duration)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate" title={ot.reason}>
                                                    {ot.reason || "-"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {otData.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-16 text-center text-gray-400">
                                                <div className="flex flex-col items-center gap-2">
                                                    <FileText className="w-8 h-8 opacity-20" />
                                                    <span>ไม่มีรายการ OT ในเดือนนี้</span>
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
                            <table className="w-full">
                                <thead className="bg-gray-50/50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">วันที่</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">พนักงาน</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">เวลาเข้างาน</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">สาย (นาที)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {lateData.map((att, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-600 font-medium whitespace-nowrap">
                                                {format(new Date(att.date), "d MMM yyyy", { locale: th })}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                {att.employeeName}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 tabular-nums">
                                                {att.checkIn ? format(new Date(att.checkIn), "HH:mm") : "-"}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                                                    +{att.lateMinutes} นาที
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {lateData.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-16 text-center text-gray-400">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Clock className="w-8 h-8 opacity-20" />
                                                    <span>ไม่มีรายการมาสายในเดือนนี้</span>
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
                            <table className="w-full">
                                <thead className="bg-gray-50/50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">พนักงาน</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ประเภท</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ช่วงวันที่</th>
                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">รวม (วัน)</th>
                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">สถิติปีนี้</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">เหตุผล</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {leaveData.map((leave, idx) => {
                                        const days = differenceInDays(new Date(leave.endDate), new Date(leave.startDate)) + 1;
                                        const count = getLeaveCountOfYear(leave.employeeId, leave.leaveType, new Date(leave.startDate));
                                        const total = getTotalLeaveCountOfYear(leave.employeeId, leave.leaveType);

                                        let typeColorClass = "bg-gray-50 text-gray-700 border-gray-100";
                                        if (leave.leaveType === "ลาป่วย") typeColorClass = "bg-red-50 text-red-700 border-red-100";
                                        else if (leave.leaveType === "ลากิจ") typeColorClass = "bg-blue-50 text-blue-700 border-blue-100";
                                        else if (leave.leaveType === "ลาพักร้อน") typeColorClass = "bg-green-50 text-green-700 border-green-100";

                                        return (
                                            <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                    {leave.employeeName}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium border ${typeColorClass}`}>
                                                        {leave.leaveType}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                                                    {format(new Date(leave.startDate), "d MMM", { locale: th })} - {format(new Date(leave.endDate), "d MMM yyyy", { locale: th })}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-sm font-semibold text-gray-700">{days}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="inline-flex flex-col text-xs text-gray-500">
                                                        <span className="font-medium text-gray-900">ครั้งที่ {count}</span>
                                                        <span className="text-[10px]">รวม {total} ครั้ง</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate" title={leave.reason}>
                                                    {leave.reason || "-"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {leaveData.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-16 text-center text-gray-400">
                                                <div className="flex flex-col items-center gap-2">
                                                    <CalendarX className="w-8 h-8 opacity-20" />
                                                    <span>ไม่มีรายการลาในเดือนนี้</span>
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
