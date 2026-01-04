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

    const loadData = async () => {
        setLoading(true);
        try {
            const [year, month] = selectedMonth.split("-").map(Number);
            const startDate = startOfMonth(new Date(year, month - 1));
            const endDate = endOfMonth(new Date(year, month - 1));

            // ดึงข้อมูลทั้งปีสำหรับนับครั้งที่ลา
            const yearStart = new Date(year, 0, 1);
            const yearEnd = new Date(year, 11, 31);

            const [otRes, attendanceRes, leaveRes, yearLeaveRes, empRes] = await Promise.all([
                otService.getByDateRange(startDate, endDate),
                attendanceService.getByDateRange(startDate, endDate),
                leaveService.getByDateRange(startDate, endDate),
                leaveService.getByDateRange(yearStart, yearEnd),
                employeeService.getAll(),
            ]);

            // Only approved OT
            setOtData(otRes.filter(o => o.status === "อนุมัติ"));

            // Only late check-ins
            setLateData(attendanceRes.filter(a => a.status === "สาย"));

            // Only approved leaves
            setLeaveData(leaveRes.filter(l => l.status === "อนุมัติ"));
            setAllYearLeaves(yearLeaveRes.filter(l => l.status === "อนุมัติ"));

            setEmployees(empRes);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
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
        return <div className="p-8 text-center">กรุณาเข้าสู่ระบบ</div>;
    }

    return (
        <div className="flex-1 p-8">
            <PageHeader
                title="รายงานละเอียด"
                subtitle="สรุป OT, การมาสาย, และการลา"
            />

            {/* Month Selector */}
            <div className="mb-6 flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">เดือน:</label>
                <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab("ot")}
                    className={`px-4 py-2 rounded-xl font-medium transition-colors ${activeTab === "ot"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                >
                    <Clock className="w-4 h-4 inline mr-2" />
                    OT ({otData.length})
                </button>
                <button
                    onClick={() => setActiveTab("late")}
                    className={`px-4 py-2 rounded-xl font-medium transition-colors ${activeTab === "late"
                        ? "bg-orange-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                >
                    <AlertTriangle className="w-4 h-4 inline mr-2" />
                    มาสาย ({lateData.length})
                </button>
                <button
                    onClick={() => setActiveTab("leave")}
                    className={`px-4 py-2 rounded-xl font-medium transition-colors ${activeTab === "leave"
                        ? "bg-purple-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                >
                    <CalendarX className="w-4 h-4 inline mr-2" />
                    ลา ({leaveData.length})
                </button>
            </div>

            {loading ? (
                <div className="text-center py-8">กำลังโหลด...</div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* OT Report */}
                    {activeTab === "ot" && (
                        <table className="w-full">
                            <thead className="bg-blue-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">วันที่</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">พนักงาน</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">เวลา OT</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">จำนวนชั่วโมง</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">เหตุผล</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {otData.map((ot, idx) => {
                                    const duration = differenceInMinutes(new Date(ot.endTime), new Date(ot.startTime));
                                    return (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 text-sm">
                                                {format(new Date(ot.date), "d MMM yyyy", { locale: th })}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-800">{ot.employeeName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {format(new Date(ot.startTime), "HH:mm")} - {format(new Date(ot.endTime), "HH:mm")}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
                                                    {formatDuration(duration)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{ot.reason || "-"}</td>
                                        </tr>
                                    );
                                })}
                                {otData.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            ไม่มีข้อมูล OT ในเดือนนี้
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}

                    {/* Late Report */}
                    {activeTab === "late" && (
                        <table className="w-full">
                            <thead className="bg-orange-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">วันที่</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">พนักงาน</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">เวลาเข้างาน</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">สายเท่าไร</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {lateData.map((att, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm">
                                            {format(new Date(att.date), "d MMM yyyy", { locale: th })}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-800">{att.employeeName}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {att.checkIn ? format(new Date(att.checkIn), "HH:mm:ss") : "-"}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium">
                                                {att.lateMinutes !== undefined ? formatDuration(att.lateMinutes) : "-"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {lateData.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                            ไม่มีข้อมูลการมาสายในเดือนนี้
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}

                    {/* Leave Report */}
                    {activeTab === "leave" && (
                        <table className="w-full">
                            <thead className="bg-purple-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">พนักงาน</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">ประเภท</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">วันที่</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">จำนวนวัน</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">ครั้งที่ของปีนี้</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">เหตุผล</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {leaveData.map((leave, idx) => {
                                    const days = differenceInDays(new Date(leave.endDate), new Date(leave.startDate)) + 1;
                                    const count = getLeaveCountOfYear(leave.employeeId, leave.leaveType, new Date(leave.startDate));
                                    const total = getTotalLeaveCountOfYear(leave.employeeId, leave.leaveType);
                                    return (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 font-medium text-gray-800">{leave.employeeName}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-lg text-sm font-medium ${leave.leaveType === "ลาป่วย"
                                                    ? "bg-red-100 text-red-700"
                                                    : leave.leaveType === "ลากิจ"
                                                        ? "bg-blue-100 text-blue-700"
                                                        : "bg-green-100 text-green-700"
                                                    }`}>
                                                    {leave.leaveType}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {format(new Date(leave.startDate), "d MMM", { locale: th })} - {format(new Date(leave.endDate), "d MMM yyyy", { locale: th })}
                                            </td>
                                            <td className="px-6 py-4 text-center">{days} วัน</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                                                    {count}/{total}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{leave.reason || "-"}</td>
                                        </tr>
                                    );
                                })}
                                {leaveData.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                            ไม่มีข้อมูลการลาในเดือนนี้
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}
