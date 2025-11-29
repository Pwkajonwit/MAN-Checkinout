"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
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
} from "recharts";
import { employeeService, attendanceService, otService, type Employee, type Attendance, type OTRequest } from "@/lib/firestore";
import { format, subDays, startOfDay, endOfDay, isSameDay } from "date-fns";
import { th } from "date-fns/locale";
import { isLate } from "@/lib/workTime";

const COLORS = ["#EBDACA", "#A8999E", "#553734"];

export function AnalyticsCharts() {
    const [loading, setLoading] = useState(true);
    const [employeeTypeData, setEmployeeTypeData] = useState<{ name: string; value: number }[]>([]);
    const [attendanceData, setAttendanceData] = useState<{ name: string; present: number; late: number; absent: number }[]>([]);
    const [otData, setOtData] = useState<{ name: string; hours: number }[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            // 1. Load Employees for Pie Chart
            const employees = await employeeService.getAll();
            const typeCount = employees.reduce((acc, emp) => {
                const type = emp.type || "ไม่ระบุ";
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const pieData = Object.entries(typeCount).map(([name, value]) => ({ name, value }));
            setEmployeeTypeData(pieData);

            // 2. Load Attendance for Bar Chart (Last 7 days)
            const today = new Date();
            const last7Days = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i));
            const startDate = startOfDay(last7Days[0]);
            const endDate = endOfDay(today);

            // We need to fetch all attendance for date range. 
            // Since getHistory is by employeeId, we might need a new service method or fetch all and filter.
            // For now, let's fetch all employees' attendance individually (not efficient but works for small scale)
            // OR better: add getAttendanceByDateRange to attendanceService.
            // Let's assume we iterate days and fetch by date (we have getByDate)

            const dailyStats = await Promise.all(last7Days.map(async (date) => {
                const attendances = await attendanceService.getByDate(date);

                // Count stats
                let present = 0;
                let late = 0;
                // Absent is tricky without knowing schedule, assume total employees - present
                // But for now let's just show present vs late

                attendances.forEach(a => {
                    if (a.status === "เข้างาน" || a.status === "สาย") {
                        if (a.checkIn && isLate(a.checkIn)) {
                            late++;
                        } else {
                            present++;
                        }
                    }
                });

                return {
                    name: format(date, "EEE", { locale: th }),
                    present,
                    late,
                    absent: 0 // Placeholder
                };
            }));

            setAttendanceData(dailyStats);

            // 3. Load Real OT Data
            const allOT = await otService.getAll();
            const otStats = last7Days.map(date => {
                const dayStr = format(date, "yyyy-MM-dd");
                const dailyOT = allOT.filter(ot =>
                    ot.status === "อนุมัติ" &&
                    ot.date &&
                    format(ot.date, "yyyy-MM-dd") === dayStr
                );

                const totalHours = dailyOT.reduce((sum, ot) => {
                    if (ot.startTime && ot.endTime) {
                        const diff = ot.endTime.getTime() - ot.startTime.getTime();
                        return sum + (diff / (1000 * 60 * 60));
                    }
                    return sum;
                }, 0);

                return {
                    name: format(date, "EEE", { locale: th }),
                    hours: parseFloat(totalHours.toFixed(2))
                };
            });

            setOtData(otStats);

        } catch (error) {
            console.error("Error loading analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6 h-[300px] flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                </Card>
                <Card className="p-6 h-[300px] flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                </Card>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Attendance */}
            <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">การเข้างาน 7 วันล่าสุด</h3>
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
                            <Bar dataKey="present" name="ตรงเวลา" fill="#EBDACA" radius={[4, 4, 0, 0]} stackId="a" />
                            <Bar dataKey="late" name="สาย" fill="#FBC02D" radius={[4, 4, 0, 0]} stackId="a" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Employee Distribution */}
            <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">ประเภทพนักงาน</h3>
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
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-4">
                    {employeeTypeData.map((entry, index) => (
                        <div key={entry.name} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                            <span className="text-sm text-gray-600">{entry.name} ({entry.value})</span>
                        </div>
                    ))}
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
    );
}
