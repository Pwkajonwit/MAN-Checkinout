"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { AttendanceTable } from "@/components/dashboard/AttendanceTable";
import { AttendanceFormModal } from "@/components/dashboard/AttendanceFormModal";
import { Button } from "@/components/ui/button";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
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
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
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
                if (config?.locationConfig?.enabled) {
                    setLocationEnabled(true);
                }
                setWorkTimeEnabled(config?.workTimeEnabled ?? true);
            } catch (error) {
                console.error("Error loading config:", error);
            }
        };
        loadConfig();
    }, [selectedDate]);

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
    });

    const stats = {
        checkedIn: uniqueEmployeeIds.size,
        checkedOut: checkedOutEmployeeIds.size,
        late: lateEmployeeIds.size,

        offsite: offsiteEmployeeIds.size,
        total: attendances.length,
    };

    // Filter attendances
    const filteredAttendances = statusFilter
        ? attendances.filter(a => {
            if (statusFilter === "เข้างาน") return a.status === "เข้างาน" || a.status === "สาย";
            if (statusFilter === "ออกงาน") return a.status === "ออกงาน";
            if (statusFilter === "สาย") return a.status === "สาย";

            if (statusFilter === "นอกพื้นที่") return a.status === "ออกนอกพื้นที่ขาไป" || a.status === "ออกนอกพื้นที่ขากลับ";
            return true;
        })
        : attendances;

    return (
        <div>
            <PageHeader
                title="บันทึก"
                subtitle={`${attendances.length} results found`}
                searchPlaceholder="Employee |"
                action={
                    <div className="grid grid-cols-2 gap-3 w-full">
                        {/* Date Picker */}
                        <input
                            type="date"
                            value={format(selectedDate, "yyyy-MM-dd")}
                            onChange={(e) => setSelectedDate(new Date(e.target.value))}
                            className="w-full h-11 px-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer shadow-sm hover:shadow-md transition-all duration-200"
                        />

                        {/* Add Button */}
                        <Button
                            onClick={handleAddAttendance}
                            className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl px-3 gap-1.5 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all duration-200 font-medium text-sm"
                        >
                            <Plus className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">บันทึกลงเวลา</span>
                        </Button>
                    </div>
                }
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                <div
                    onClick={() => setStatusFilter(statusFilter === "เข้างาน" ? null : "เข้างาน")}
                    className={`bg-white p-4 rounded-xl border cursor-pointer transition-all ${statusFilter === "เข้างาน" ? "border-green-500 ring-2 ring-green-200" : "border-gray-100 hover:border-gray-300"}`}
                >
                    <div className="text-xs text-gray-500">เข้างาน</div>
                    <div className={`text-2xl font-bold ${statusFilter === "เข้างาน" ? "text-green-600" : "text-gray-800"}`}>{stats.checkedIn}</div>
                </div>
                <div
                    onClick={() => setStatusFilter(statusFilter === "ออกงาน" ? null : "ออกงาน")}
                    className={`bg-white p-4 rounded-xl border cursor-pointer transition-all ${statusFilter === "ออกงาน" ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-100 hover:border-gray-300"}`}
                >
                    <div className="text-xs text-gray-500">ออกงาน</div>
                    <div className={`text-2xl font-bold ${statusFilter === "ออกงาน" ? "text-blue-600" : "text-gray-800"}`}>{stats.checkedOut}</div>
                </div>
                <div
                    onClick={() => setStatusFilter(statusFilter === "สาย" ? null : "สาย")}
                    className={`bg-white p-4 rounded-xl border cursor-pointer transition-all ${statusFilter === "สาย" ? "border-red-500 ring-2 ring-red-200" : "border-gray-100 hover:border-gray-300"}`}
                >
                    <div className="text-xs text-gray-500">สาย</div>
                    <div className={`text-2xl font-bold ${statusFilter === "สาย" ? "text-red-600" : "text-gray-800"}`}>{stats.late}</div>
                </div>

                <div
                    onClick={() => setStatusFilter(statusFilter === "นอกพื้นที่" ? null : "นอกพื้นที่")}
                    className={`bg-white p-4 rounded-xl border cursor-pointer transition-all ${statusFilter === "นอกพื้นที่" ? "border-purple-500 ring-2 ring-purple-200" : "border-gray-100 hover:border-gray-300"}`}
                >
                    <div className="text-xs text-gray-500">นอกพื้นที่</div>
                    <div className={`text-2xl font-bold ${statusFilter === "นอกพื้นที่" ? "text-purple-600" : "text-gray-800"}`}>{stats.offsite}</div>
                </div>
                <div
                    onClick={() => setStatusFilter(null)}
                    className={`bg-white p-4 rounded-xl border cursor-pointer transition-all ${statusFilter === null ? "border-gray-500 ring-2 ring-gray-200" : "border-gray-100 hover:border-gray-300"}`}
                >
                    <div className="text-xs text-gray-500">ทั้งหมด</div>
                    <div className={`text-2xl font-bold ${statusFilter === null ? "text-gray-600" : "text-gray-800"}`}>{stats.total}</div>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="w-12 h-12 border-4 border-gray-100 border-t-primary rounded-full animate-spin mx-auto"></div>
                    <p className="text-gray-600 mt-4">กำลังโหลดข้อมูล...</p>
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
