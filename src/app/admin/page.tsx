"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { AttendanceTable } from "@/components/dashboard/AttendanceTable";
import { AttendanceFormModal } from "@/components/dashboard/AttendanceFormModal";
import { Button } from "@/components/ui/button";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import { attendanceService, type Attendance } from "@/lib/firestore";
import { format } from "date-fns";
import { th } from "date-fns/locale";

export default function DashboardPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAttendance, setSelectedAttendance] = useState<Attendance | null>(null);
    const [attendances, setAttendances] = useState<Attendance[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

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

    const handleAddAttendance = () => {
        setSelectedAttendance(null);
        setIsModalOpen(true);
    };

    const handleSuccess = () => {
        loadAttendances(selectedDate);
    };

    // Calculate stats - count unique employees
    const uniqueEmployeeIds = new Set<string>();
    const lateEmployeeIds = new Set<string>();
    const leaveEmployeeIds = new Set<string>();

    attendances.forEach(a => {
        // Count unique employees who checked in (any status except leave)
        if (a.status === "เข้างาน" || a.status === "ออกงาน" || a.status === "สาย" || a.status === "ระหว่างวัน") {
            uniqueEmployeeIds.add(a.employeeId);
        }

        // Count unique employees who are late
        if (a.status === "สาย") {
            lateEmployeeIds.add(a.employeeId);
        }

        // Count unique employees on leave
        if (a.status === "ลางาน") {
            leaveEmployeeIds.add(a.employeeId);
        }
    });

    const stats = {
        checkedIn: uniqueEmployeeIds.size,
        onLeave: leaveEmployeeIds.size,
        late: lateEmployeeIds.size,
        total: uniqueEmployeeIds.size + leaveEmployeeIds.size,
    };

    return (
        <div>
            <PageHeader
                title="บันทึก"
                subtitle={`${attendances.length} results found`}
                searchPlaceholder="Employee |"
                action={
                    <div className="flex gap-3">
                        <div className="relative">
                            <input
                                type="date"
                                value={format(selectedDate, "yyyy-MM-dd")}
                                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                                className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            />
                            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                        <Button
                            onClick={handleAddAttendance}
                            className="bg-[#5C6BC0] hover:bg-[#5C6BC0]/90 text-white rounded-xl px-6 gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            บันทึกการลงเวลา
                        </Button>
                    </div>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatsCard
                    title={`เข้างาน (${format(selectedDate, "d MMM", { locale: th })})`}
                    value={stats.checkedIn}
                />
                <StatsCard
                    title="ลางาน"
                    value={stats.onLeave}
                />
                <StatsCard
                    title="สาย"
                    value={stats.late}
                />
                <StatsCard
                    title="ทั้งหมด"
                    value={stats.total}
                />
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="w-12 h-12 border-4 border-[#EBDACA] border-t-[#553734] rounded-full animate-spin mx-auto"></div>
                    <p className="text-gray-600 mt-4">กำลังโหลดข้อมูล...</p>
                </div>
            ) : (
                <AttendanceTable attendances={attendances} />
            )}

            <AttendanceFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                attendance={selectedAttendance}
                onSuccess={handleSuccess}
            />
        </div>
    );
}
