"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    Legend,
} from "recharts";
import {
    employeeService,
    attendanceService,
    otService,
    leaveService,
    type Employee,
    type Attendance,
    type OTRequest,
    type LeaveRequest
} from "@/lib/firestore";
import { format, subDays, startOfDay, endOfDay, isSameDay, isWithinInterval, eachDayOfInterval, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { isLate, getLateMinutes, formatMinutesToHours } from "@/lib/workTime";
import { Users, UserCheck, Clock, CalendarOff, Download, Filter } from "lucide-react";

const COLORS = ["#EBDACA", "#A8999E", "#553734", "#D4C5C7", "#8D7B7F"];
const LEAVE_COLORS = ["#FF8042", "#00C49F", "#FFBB28", "#0088FE"];

export function AnalyticsCharts() {
    const [loading, setLoading] = useState(true);

    // Filters
    const [startDate, setStartDate] = useState<string>(format(subDays(new Date(), 30), "yyyy-MM-dd"));
    const [endDate, setEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
    const [selectedEmployeeType, setSelectedEmployeeType] = useState<string>("all");

    // Data
    const [employeeTypeData, setEmployeeTypeData] = useState<{ name: string; value: number }[]>([]);
    const [attendanceData, setAttendanceData] = useState<{ name: string; fullDate: string; present: number; late: number; absent: number }[]>([]);
    const [otData, setOtData] = useState<{ name: string; hours: number }[]>([]);
    const [leaveData, setLeaveData] = useState<{ name: string; value: number }[]>([]);

    // Summary Stats
    const [summaryStats, setSummaryStats] = useState({
        totalEmployees: 0,
        avgAttendance: 0,
        totalLate: 0,
        totalLeaves: 0
    });

    // Late Employees List
    const [lateEmployees, setLateEmployees] = useState<{
        id: string;
        name: string;
        date: string;
        time: string;
        lateMinutes: number;
        department?: string;
    }[]>([]);

    useEffect(() => {
        loadData();
    }, [startDate, endDate, selectedEmployeeType]);

    const loadData = async () => {
        setLoading(true);
        try {
            const start = startOfDay(parseISO(startDate));
            const end = endOfDay(parseISO(endDate));

            // 1. Load Employees & Filter
            const allEmployees = await employeeService.getAll();
            const filteredEmployees = selectedEmployeeType === "all"
                ? allEmployees
                : allEmployees.filter(emp => emp.type === selectedEmployeeType);

            const filteredEmployeeIds = new Set(filteredEmployees.map(e => e.id));
            const totalEmployees = filteredEmployees.length;

            // Employee Type Distribution (of filtered set - if filtered by type, this will be single slice, 
            // but usually this chart is useful for "All". If filtered, maybe show subtypes or just 100%)
            // Let's show distribution of the *filtered* result (e.g. if "All", show breakdown. If "Daily", show only Daily)
            const typeCount = filteredEmployees.reduce((acc, emp) => {
                const type = emp.type || "ไม่ระบุ";
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            setEmployeeTypeData(Object.entries(typeCount).map(([name, value]) => ({ name, value })));

            // 2. Load Attendance in Range
            // We use the new service method
            // Note: getByDateRange in firestore.ts needs to be implemented or we fetch all if not available.
            // Assuming we added it as planned.
            const rangeAttendance = await attendanceService.getByDateRange(start, end);

            // Filter attendance by selected employees
            const filteredAttendance = rangeAttendance.filter(a => filteredEmployeeIds.has(a.employeeId));

            // Process Daily Stats
            const daysInterval = eachDayOfInterval({ start, end });
            const dailyStats = daysInterval.map(day => {
                const dayStr = format(day, "yyyy-MM-dd");
                const dayAttendance = filteredAttendance.filter(a =>
                    a.date && format(a.date, "yyyy-MM-dd") === dayStr
                );

                let present = 0;
                let late = 0;

                dayAttendance.forEach(a => {
                    if (a.status === "เข้างาน" || a.status === "สาย") {
                        if (a.checkIn && isLate(a.checkIn)) {
                            late++;
                        } else {
                            present++;
                        }
                    }
                });

                return {
                    name: format(day, "dd MMM", { locale: th }),
                    fullDate: dayStr,
                    present,
                    late,
                    absent: totalEmployees - (present + late) // Rough estimate
                };
            });
            setAttendanceData(dailyStats);

            // Process Late List (from filtered attendance)
            const lateList = filteredAttendance
                .filter(a => (a.status === "เข้างาน" || a.status === "สาย") && a.checkIn && isLate(a.checkIn))
                .map(a => ({
                    id: a.id || Math.random().toString(),
                    name: a.employeeName,
                    date: format(a.date, "dd/MM/yyyy", { locale: th }),
                    time: a.checkIn ? format(a.checkIn, "HH:mm") : "-",
                    lateMinutes: a.checkIn ? getLateMinutes(a.checkIn) : 0,
                    department: filteredEmployees.find(e => e.id === a.employeeId)?.department || "-"
                }))
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort by date desc

            setLateEmployees(lateList);

            // 3. Load Leave Requests in Range
            const rangeLeaves = await leaveService.getByDateRange(start, end);
            const filteredLeaves = rangeLeaves.filter(l => filteredEmployeeIds.has(l.employeeId) && l.status === "อนุมัติ");

            // Leave Type Distribution
            const leaveTypeCount = filteredLeaves.reduce((acc, l) => {
                acc[l.leaveType] = (acc[l.leaveType] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            setLeaveData(Object.entries(leaveTypeCount).map(([name, value]) => ({ name, value })));

            // 4. Load OT Data in Range
            const rangeOT = await otService.getByDateRange(start, end);
            const filteredOT = rangeOT.filter(ot => filteredEmployeeIds.has(ot.employeeId) && ot.status === "อนุมัติ");

            const otStats = daysInterval.map(day => {
                const dayStr = format(day, "yyyy-MM-dd");
                const dailyOT = filteredOT.filter(ot =>
                    ot.date && format(ot.date, "yyyy-MM-dd") === dayStr
                );

                const totalHours = dailyOT.reduce((sum, ot) => {
                    if (ot.startTime && ot.endTime) {
                        const diff = ot.endTime.getTime() - ot.startTime.getTime();
                        return sum + (diff / (1000 * 60 * 60));
                    }
                    return sum;
                }, 0);

                return {
                    name: format(day, "dd MMM", { locale: th }),
                    hours: parseFloat(totalHours.toFixed(2))
                };
            });
            setOtData(otStats);

            // Calculate Summary Stats
            const totalPresent = dailyStats.reduce((sum, day) => sum + day.present + day.late, 0);
            const avgAttendance = daysInterval.length > 0 ? Math.round(totalPresent / daysInterval.length) : 0;
            const totalLateCount = lateList.length;
            const totalLeaveCount = filteredLeaves.length;

            setSummaryStats({
                totalEmployees,
                avgAttendance,
                totalLate: totalLateCount,
                totalLeaves: totalLeaveCount
            });

        } catch (error) {
            console.error("Error loading analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        const headers = ["Date", "Present", "Late", "Absent"];
        const rows = attendanceData.map(d => [d.fullDate, d.present, d.late, d.absent]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `attendance_report_${startDate}_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            {/* Filters Toolbar */}
            <Card className="p-4">
                <div className="flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">
                    <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">ตั้งแต่วันที่</label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full md:w-[180px]"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">ถึงวันที่</label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full md:w-[180px]"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">ประเภทพนักงาน</label>
                            <Select value={selectedEmployeeType} onValueChange={setSelectedEmployeeType}>
                                <SelectTrigger className="w-full md:w-[180px]">
                                    <SelectValue placeholder="ทั้งหมด" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">ทั้งหมด</SelectItem>
                                    <SelectItem value="รายเดือน">รายเดือน</SelectItem>
                                    <SelectItem value="รายวัน">รายวัน</SelectItem>
                                    <SelectItem value="ชั่วคราว">ชั่วคราว</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <Button onClick={handleExport} variant="outline" className="gap-2 w-full md:w-auto">
                        <Download className="w-4 h-4" />
                        Export CSV
                    </Button>
                </div>
            </Card>

            {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <Card key={i} className="p-6 h-[120px] flex items-center justify-center animate-pulse bg-gray-50">
                            <div className="w-full h-full bg-gray-200 rounded-lg"></div>
                        </Card>
                    ))}
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <Card className="p-6 flex items-center gap-4 border-l-4 border-l-blue-500">
                            <div className="p-3 bg-blue-50 rounded-full">
                                <Users className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">พนักงาน (ที่เลือก)</p>
                                <h3 className="text-2xl font-bold text-gray-800">{summaryStats.totalEmployees}</h3>
                            </div>
                        </Card>

                        <Card className="p-6 flex items-center gap-4 border-l-4 border-l-green-500">
                            <div className="p-3 bg-green-50 rounded-full">
                                <UserCheck className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">เข้างานเฉลี่ย/วัน</p>
                                <h3 className="text-2xl font-bold text-gray-800">{summaryStats.avgAttendance}</h3>
                            </div>
                        </Card>

                        <Card className="p-6 flex items-center gap-4 border-l-4 border-l-yellow-500">
                            <div className="p-3 bg-yellow-50 rounded-full">
                                <Clock className="w-6 h-6 text-yellow-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">สาย (ครั้ง)</p>
                                <h3 className="text-2xl font-bold text-gray-800">{summaryStats.totalLate}</h3>
                            </div>
                        </Card>

                        <Card className="p-6 flex items-center gap-4 border-l-4 border-l-purple-500">
                            <div className="p-3 bg-purple-50 rounded-full">
                                <CalendarOff className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">ลา (ครั้ง)</p>
                                <h3 className="text-2xl font-bold text-gray-800">{summaryStats.totalLeaves}</h3>
                            </div>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Attendance Trend */}
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">แนวโน้มการเข้างาน</h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={attendanceData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF' }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            cursor={{ fill: '#F9FAFB' }}
                                        />
                                        <Legend />
                                        <Bar dataKey="present" name="ตรงเวลา" fill="#EBDACA" radius={[4, 4, 0, 0]} stackId="a" />
                                        <Bar dataKey="late" name="สาย" fill="#FBC02D" radius={[4, 4, 0, 0]} stackId="a" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* Employee Distribution */}
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">สัดส่วนพนักงาน</h3>
                            <div className="h-[300px] w-full flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={employeeTypeData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {employeeTypeData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* Leave Analysis */}
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">สถิติการลา (ตามประเภท)</h3>
                            <div className="h-[300px] w-full flex items-center justify-center">
                                {leaveData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={leaveData}
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={100}
                                                fill="#8884d8"
                                                dataKey="value"
                                                label={({ name, percent }: { name?: string | number; percent?: number }) => `${name ?? ''} ${(percent ? percent * 100 : 0).toFixed(0)}%`}
                                            >
                                                {leaveData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={LEAVE_COLORS[index % LEAVE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="text-gray-400 flex flex-col items-center">
                                        <CalendarOff className="w-12 h-12 mb-2 opacity-50" />
                                        <p>ไม่มีข้อมูลการลาในช่วงนี้</p>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Late Employees List */}
                        <Card className="p-6 overflow-hidden">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-800">ประวัติการมาสาย ({lateEmployees.length})</h3>
                            </div>
                            <div className="overflow-y-auto max-h-[300px]">
                                {lateEmployees.length > 0 ? (
                                    <div className="space-y-3">
                                        {lateEmployees.map((emp, index) => (
                                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-xs">
                                                        {emp.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-800 text-sm">{emp.name}</p>
                                                        <p className="text-xs text-gray-500">{emp.date} - {emp.department}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-red-600 font-bold text-sm">{emp.time}</p>
                                                    <p className="text-xs text-gray-500">สาย {formatMinutesToHours(emp.lateMinutes)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                                        <UserCheck className="w-12 h-12 mb-2 opacity-50" />
                                        <p>ไม่มีใครมาสายในช่วงนี้</p>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Monthly Trend */}
                        <Card className="p-6 lg:col-span-2">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">แนวโน้มโอที (ชั่วโมง)</h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={otData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF' }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Line type="monotone" dataKey="hours" name="ชั่วโมงโอที" stroke="#553734" strokeWidth={3} dot={{ r: 4, fill: '#553734', strokeWidth: 2, stroke: '#fff' }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}
