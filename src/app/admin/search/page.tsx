"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { employeeService, attendanceService, leaveService, otService, swapService, systemConfigService, type Employee, type Attendance, type LeaveRequest, type OTRequest, type SwapRequest } from "@/lib/firestore";
import { AttendanceTable } from "@/components/dashboard/AttendanceTable";
import { LeaveTable } from "@/components/leave/LeaveTable";
import { OTTable } from "@/components/ot/OTTable";
import { Search, User, Download, Clock, Briefcase, FileText, ChevronRight, Phone, Mail, Calendar, MapPin, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { sendPushMessage } from "@/app/actions/line";
import { generateAttendancePDF } from "@/lib/pdfGenerator";
import { generateAttendanceCSV } from "@/lib/csvGenerator";
import { getLateMinutes, isLate, formatMinutesToHours } from "@/lib/workTime";
import { Button } from "@/components/ui/button";

export default function SearchPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [attendances, setAttendances] = useState<Attendance[]>([]);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [otRequests, setOTRequests] = useState<OTRequest[]>([]);
    const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingData, setLoadingData] = useState(false);
    const [activeTab, setActiveTab] = useState<"attendance" | "leave" | "ot" | "swap">("attendance");
    const [locationEnabled, setLocationEnabled] = useState(false);
    const [workTimeEnabled, setWorkTimeEnabled] = useState(true);

    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

    useEffect(() => {
        loadEmployees();
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
    }, []);

    useEffect(() => {
        if (selectedEmployee?.id) {
            loadEmployeeData(selectedEmployee.id);
        }
    }, [selectedMonth]);

    useEffect(() => {
        if (searchQuery.trim() === "") {
            setFilteredEmployees([]);
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = employees.filter(emp =>
                emp.name.toLowerCase().includes(query) ||
                emp.email?.toLowerCase().includes(query) ||
                emp.employeeId?.toLowerCase().includes(query)
            );
            setFilteredEmployees(filtered);
        }
    }, [searchQuery, employees]);

    const loadEmployees = async () => {
        try {
            const data = await employeeService.getAll();
            setEmployees(data);
        } catch (error) {
            console.error("Error loading employees:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadEmployeeData = async (employeeId: string) => {
        setLoadingData(true);
        try {
            const [year, month] = selectedMonth.split('-').map(Number);
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0); // Last day of month
            endDate.setHours(23, 59, 59, 999);

            const [attendanceData, leaveData, otData, swapData] = await Promise.all([
                attendanceService.getHistory(employeeId, startDate, endDate),
                leaveService.getByEmployeeId(employeeId),
                otService.getByEmployeeId(employeeId),
                swapService.getByEmployeeId(employeeId)
            ]);

            setAttendances(attendanceData);
            setLeaves(leaveData);
            setOTRequests(otData);
            setSwapRequests(swapData);
        } catch (error) {
            console.error("Error loading employee data:", error);
        } finally {
            setLoadingData(false);
        }
    };

    const handleSelectEmployee = (employee: Employee) => {
        setSelectedEmployee(employee);
        setSearchQuery(""); // Clear search to focus on detail
        setFilteredEmployees([]);
        if (employee.id) {
            loadEmployeeData(employee.id);
        }
    };

    const handleBackToSearch = () => {
        setSelectedEmployee(null);
        setSearchQuery("");
        setFilteredEmployees([]);
    };

    const handleLeaveStatusUpdate = async (id: string, status: LeaveRequest["status"]) => {
        try {
            await leaveService.updateStatus(id, status);
            if (selectedEmployee?.id) {
                loadEmployeeData(selectedEmployee.id);
            }
        } catch (error) {
            console.error("Error updating leave status:", error);
            alert("เกิดข้อผิดพลาดในการอัพเดทสถานะ");
        }
    };

    const handleOTStatusUpdate = async (id: string, status: OTRequest["status"]) => {
        try {
            await otService.updateStatus(id, status);
            if (selectedEmployee?.id) {
                loadEmployeeData(selectedEmployee.id);
            }
        } catch (error) {
            console.error("Error updating OT status:", error);
            alert("เกิดข้อผิดพลาดในการอัพเดทสถานะ");
        }
    };

    const getLeaveUsed = () => {
        const used = { personal: 0, sick: 0, vacation: 0 };
        leaves.forEach(leave => {
            if (leave.status === "อนุมัติ") {
                const start = leave.startDate instanceof Date ? leave.startDate : new Date(leave.startDate);
                const end = leave.endDate instanceof Date ? leave.endDate : new Date(leave.endDate);
                const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

                if (leave.leaveType === "ลากิจ") used.personal += days;
                else if (leave.leaveType === "ลาป่วย") used.sick += days;
                else if (leave.leaveType === "ลาพักร้อน") used.vacation += days;
            }
        });
        return used;
    };

    return (
        <div className="flex-1  max-w-5xl mx-auto">
            <PageHeader
                title="ค้นหาและจัดการข้อมูลพนักงาน"
                subtitle="ดูประวัติการเข้างาน, การลา, OT และจัดการข้อมูลรายบุคคล"
            />

            {/* Search Section */}
            {!selectedEmployee && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6 text-center">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">ค้นหาพนักงาน</h2>
                    <p className="text-gray-500 mb-6">พิมพ์ชื่อ, รหัสพนักงาน หรืออีเมล เพื่อค้นหาข้อมูล</p>

                    <div className="relative max-w-xl mx-auto">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="ค้นหา..."
                            className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                            autoFocus
                        />
                    </div>

                    {searchQuery && filteredEmployees.length > 0 && (
                        <div className="mt-6 max-w-xl mx-auto text-left bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
                            {filteredEmployees.map((employee) => (
                                <button
                                    key={employee.id}
                                    onClick={() => handleSelectEmployee(employee)}
                                    className="w-full p-4 hover:bg-blue-50 flex items-center gap-4 transition-colors border-b border-gray-50 last:border-0"
                                >
                                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                                        {employee.name.charAt(0)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-gray-800 text-lg">{employee.name}</div>
                                        <div className="text-gray-500 flex items-center gap-2 text-sm">
                                            <span>ID: {employee.employeeId || "-"}</span>
                                            <span>•</span>
                                            <span>{employee.position}</span>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                </button>
                            ))}
                        </div>
                    )}

                    {searchQuery && filteredEmployees.length === 0 && (
                        <div className="mt-8 text-gray-400">
                            ไม่พบข้อมูลพนักงานที่ตรงกับคำค้นหา
                        </div>
                    )}

                    {!searchQuery && (
                        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto opacity-50">
                            <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <Clock className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                <div className="text-xs">ประวัติเวลา</div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <Briefcase className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                <div className="text-xs">การลา</div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                <div className="text-xs">โอที</div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <User className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                <div className="text-xs">ข้อมูลส่วนตัว</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Selected Employee Detail View */}
            {selectedEmployee && (
                <div className="space-y-6">
                    <Button
                        variant="ghost"
                        onClick={handleBackToSearch}
                        className="mb-2 text-gray-500 hover:text-gray-800 p-0 hover:bg-transparent"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        กลับไปค้นหา
                    </Button>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-8 border-b border-gray-100 bg-gradient-to-r from-blue-50/50 to-transparent">
                            <div className="flex flex-col md:flex-row gap-6 items-start">
                                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-4xl shadow-lg shrink-0">
                                    {selectedEmployee.name.charAt(0)}
                                </div>
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <h1 className="text-3xl font-bold text-gray-900 mb-2">{selectedEmployee.name}</h1>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                                {selectedEmployee.position}
                                            </span>
                                            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                                                {selectedEmployee.department || "ไม่ระบุแผนก"}
                                            </span>
                                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                                                {selectedEmployee.type}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600 pt-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                                                <User className="w-4 h-4 text-gray-400" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-400">รหัสพนักงาน</div>
                                                <div className="font-medium">{selectedEmployee.employeeId || "-"}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                                                <Phone className="w-4 h-4 text-gray-400" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-400">เบอร์โทรศัพท์</div>
                                                <div className="font-medium">{selectedEmployee.phone || "-"}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                                                <Mail className="w-4 h-4 text-gray-400" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-400">อีเมล</div>
                                                <div className="font-medium">{selectedEmployee.email}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                                                <Calendar className="w-4 h-4 text-gray-400" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-400">วันที่เริ่มงาน</div>
                                                <div className="font-medium">
                                                    {selectedEmployee.registeredDate
                                                        ? format(new Date(selectedEmployee.registeredDate), "d MMM yyyy", { locale: th })
                                                        : "-"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stats Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 border-b border-gray-100">
                            {[
                                {
                                    label: "ลากิจ (คงเหลือ)",
                                    value: Math.max(0, (selectedEmployee.leaveQuota?.personal || 0) - getLeaveUsed().personal),
                                    sub: "วัน"
                                },
                                {
                                    label: "ลาป่วย (คงเหลือ)",
                                    value: Math.max(0, (selectedEmployee.leaveQuota?.sick || 0) - getLeaveUsed().sick),
                                    sub: "วัน"
                                },
                                {
                                    label: "ลาพักร้อน (คงเหลือ)",
                                    value: Math.max(0, (selectedEmployee.leaveQuota?.vacation || 0) - getLeaveUsed().vacation),
                                    sub: "วัน"
                                },
                            ].map((stat, i) => (
                                <div key={i} className="p-6 text-center hover:bg-gray-50 transition-colors">
                                    <div className="text-sm text-gray-500 mb-1">{stat.label}</div>
                                    <div className="text-2xl font-bold text-gray-800">
                                        {stat.value}
                                        <span className="text-sm font-normal text-gray-400 ml-1">{stat.sub}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Tabs Navigation */}
                        <div className="flex border-b border-gray-200">
                            <button
                                onClick={() => setActiveTab("attendance")}
                                className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === "attendance"
                                    ? "border-blue-600 text-blue-600 bg-blue-50/50"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                    }`}
                            >
                                <Clock className="w-4 h-4" />
                                ประวัติเวลาเข้า-ออก ({attendances.length})
                            </button>
                            <button
                                onClick={() => setActiveTab("leave")}
                                className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === "leave"
                                    ? "border-blue-600 text-blue-600 bg-blue-50/50"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                    }`}
                            >
                                <Briefcase className="w-4 h-4" />
                                ประวัติการลา ({leaves.length})
                            </button>
                            <button
                                onClick={() => setActiveTab("ot")}
                                className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === "ot"
                                    ? "border-blue-600 text-blue-600 bg-blue-50/50"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                    }`}
                            >
                                <FileText className="w-4 h-4" />
                                ประวัติ OT ({otRequests.length})
                            </button>
                            <button
                                onClick={() => setActiveTab("swap")}
                                className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === "swap"
                                    ? "border-blue-600 text-blue-600 bg-blue-50/50"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                    }`}
                            >
                                <Briefcase className="w-4 h-4" />
                                ประวัติสลับวัน ({swapRequests.length})
                            </button>
                        </div>

                        <div className="p-6 min-h-[400px]">
                            {loadingData ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                                    <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                                    กำลังโหลดข้อมูล...
                                </div>
                            ) : (
                                <>
                                    {activeTab === "attendance" && (
                                        <div className="space-y-4">

                                            <div className="flex flex-col gap-4">
                                                {/* Summary Cards */}
                                                {(() => {
                                                    const summary = (() => {
                                                        const [year, month] = selectedMonth.split('-').map(Number);
                                                        const daysInMonth = new Date(year, month, 0).getDate();

                                                        // Filter attendances for selected month only (redundant if API filters, but safe)
                                                        const monthlyAttendances = attendances;

                                                        const attendanceDays = monthlyAttendances.filter(a => a.status === "เข้างาน" || a.status === "สาย" || a.status === "ออกงาน").length;

                                                        // Leaves
                                                        let leaveDays = 0;
                                                        leaves.forEach(l => {
                                                            if (l.status === "อนุมัติ") {
                                                                // Simple overlap check logic could be added here if needed
                                                                // For now, assume leaves are vetted
                                                                const start = new Date(l.startDate);
                                                                const end = new Date(l.endDate);
                                                                // Calculate days overlapping with selected month
                                                                // Simplified: use pre-calculated days if available or 1
                                                                const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                                                                leaveDays += days;
                                                            }
                                                        });

                                                        // Absent Logic (Time Sensitive)
                                                        const now = new Date();
                                                        const currentYear = now.getFullYear();
                                                        const currentMonth = now.getMonth() + 1;
                                                        const currentDay = now.getDate();

                                                        let daysElapsed = daysInMonth;
                                                        if (year === currentYear && month === currentMonth) {
                                                            daysElapsed = currentDay;
                                                        } else if (year > currentYear || (year === currentYear && month > currentMonth)) {
                                                            daysElapsed = 0;
                                                        }

                                                        // Calculate expected work days based on employee settings
                                                        const weeklyHolidays = selectedEmployee.weeklyHolidays || [0, 6]; // Default to Sunday (0) and Saturday (6)
                                                        let expectedWorkDays = 0;
                                                        for (let d = 1; d <= daysInMonth; d++) {
                                                            const date = new Date(year, month - 1, d);
                                                            if (!weeklyHolidays.includes(date.getDay())) {
                                                                expectedWorkDays++;
                                                            }
                                                        }

                                                        // Calculate absent days based on elapsed working days
                                                        let elapsedWorkDays = 0;
                                                        for (let d = 1; d <= daysElapsed; d++) {
                                                            const date = new Date(year, month - 1, d);
                                                            if (!weeklyHolidays.includes(date.getDay())) {
                                                                elapsedWorkDays++;
                                                            }
                                                        }
                                                        const absentDays = Math.max(0, elapsedWorkDays - attendanceDays - leaveDays);

                                                        const lateCount = monthlyAttendances.filter(a => (a.lateMinutes || 0) > 0).length;
                                                        const lateMinutes = monthlyAttendances.reduce((sum, a) => sum + (a.lateMinutes || 0), 0);

                                                        const totalOTHours = otRequests
                                                            .filter(ot => {
                                                                const otDate = new Date(ot.date);
                                                                return ot.status === "อนุมัติ" &&
                                                                    otDate.getMonth() === (month - 1) &&
                                                                    otDate.getFullYear() === year;
                                                            })
                                                            .reduce((sum, ot) => {
                                                                if (ot.startTime && ot.endTime) {
                                                                    const start = ot.startTime instanceof Date ? ot.startTime : new Date(ot.startTime);
                                                                    const end = ot.endTime instanceof Date ? ot.endTime : new Date(ot.endTime);
                                                                    const minutes = (end.getTime() - start.getTime()) / (1000 * 60);
                                                                    return sum + minutes;
                                                                }
                                                                return sum;
                                                            }, 0);

                                                        return {
                                                            totalDays: daysInMonth,
                                                            attendanceDays,
                                                            leaveDays,
                                                            absentDays,
                                                            expectedWorkDays,
                                                            lateCount,
                                                            lateMinutes,
                                                            totalOTHours
                                                        };
                                                    })();

                                                    return (
                                                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                                            <div className="text-center">
                                                                <div className="text-2xl font-bold text-gray-800">{summary.attendanceDays}</div>
                                                                <div className="text-xs text-gray-500">วันมาทำงาน</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="text-2xl font-bold text-gray-800">{summary.leaveDays}</div>
                                                                <div className="text-xs text-gray-500">วันลา</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="text-2xl font-bold text-gray-800">
                                                                    {summary.absentDays} <span className="text-lg text-gray-400 font-normal">/ {summary.expectedWorkDays}</span>
                                                                </div>
                                                                <div className="text-xs text-gray-500">วันขาด (โดยประมาณ)</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="text-2xl font-bold text-red-600">{summary.lateCount}</div>
                                                                <div className="text-xs text-gray-500">สาย (ครั้ง)</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="text-lg font-bold text-red-600">{formatMinutesToHours(summary.lateMinutes)}</div>
                                                                <div className="text-xs text-gray-500">รวมเวลาสาย</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="text-lg font-bold text-blue-600">{formatMinutesToHours(summary.totalOTHours)}</div>
                                                                <div className="text-xs text-gray-500">รวม OT (ชม.)</div>
                                                            </div>

                                                            {/* Hidden CSV/PDF Logic Trigger - keeping clean structure */}
                                                        </div>
                                                    );
                                                })()}

                                                <div className="flex justify-between items-center flex-wrap gap-4">
                                                    <div className="flex items-center gap-4">
                                                        <h3 className="font-semibold text-gray-800">ประวัติการลงเวลา</h3>
                                                        <input
                                                            type="month"
                                                            value={selectedMonth}
                                                            onChange={(e) => setSelectedMonth(e.target.value)}
                                                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                // Re-calculate summary for export (cleaner to extract function but inline for now)
                                                                const [year, month] = selectedMonth.split('-').map(Number);
                                                                const daysInMonth = new Date(year, month, 0).getDate();
                                                                const attendanceDays = attendances.filter(a => a.status === "เข้างาน" || a.status === "สาย" || a.status === "ออกงาน").length;
                                                                let leaveDays = 0; leaves.forEach(l => { if (l.status === "อนุมัติ") leaveDays += 1; }); // Simplified
                                                                const weeklyHolidays = selectedEmployee.weeklyHolidays || [0, 6];
                                                                const now = new Date();
                                                                const currentYear = now.getFullYear();
                                                                const currentMonth = now.getMonth() + 1;
                                                                const currentDay = now.getDate();
                                                                let daysElapsed = daysInMonth;
                                                                if (year === currentYear && month === currentMonth) daysElapsed = currentDay;
                                                                else if (year > currentYear || (year === currentYear && month > currentMonth)) daysElapsed = 0;

                                                                let expectedWorkDays = 0;
                                                                for (let d = 1; d <= daysInMonth; d++) {
                                                                    const date = new Date(year, month - 1, d);
                                                                    if (!weeklyHolidays.includes(date.getDay())) expectedWorkDays++;
                                                                }

                                                                let elapsedWorkDays = 0;
                                                                for (let d = 1; d <= daysElapsed; d++) {
                                                                    const date = new Date(year, month - 1, d);
                                                                    if (!weeklyHolidays.includes(date.getDay())) elapsedWorkDays++;
                                                                }
                                                                const absentDays = Math.max(0, elapsedWorkDays - attendanceDays - leaveDays);

                                                                const lateCount = attendances.filter(a => (a.lateMinutes || 0) > 0).length;
                                                                const lateMinutes = attendances.reduce((sum, a) => sum + (a.lateMinutes || 0), 0);

                                                                const totalOTHours = otRequests.filter(ot => {
                                                                    const otDate = new Date(ot.date);
                                                                    return ot.status === "อนุมัติ" && otDate.getMonth() === (month - 1) && otDate.getFullYear() === year;
                                                                }).reduce((sum, ot) => {
                                                                    if (ot.startTime && ot.endTime) {
                                                                        const start = ot.startTime instanceof Date ? ot.startTime : new Date(ot.startTime);
                                                                        const end = ot.endTime instanceof Date ? ot.endTime : new Date(ot.endTime);
                                                                        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                                                                        return sum + hours;
                                                                    }
                                                                    return sum;
                                                                }, 0);

                                                                const summary = { totalDays: daysInMonth, attendanceDays, leaveDays, absentDays, lateCount, lateMinutes, totalOTHours };
                                                                generateAttendanceCSV(selectedEmployee.name, attendances, otRequests, summary, leaves, swapRequests);
                                                            }}
                                                            className="gap-2 text-green-600 border-green-200 hover:bg-green-50"
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                            Export CSV
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                const [year, month] = selectedMonth.split('-').map(Number);
                                                                const daysInMonth = new Date(year, month, 0).getDate();
                                                                const attendanceDays = attendances.filter(a => a.status === "เข้างาน" || a.status === "สาย" || a.status === "ออกงาน").length;
                                                                let leaveDays = 0; leaves.forEach(l => { if (l.status === "อนุมัติ") leaveDays += 1; });
                                                                const weeklyHolidays = selectedEmployee.weeklyHolidays || [0, 6];
                                                                const now = new Date();
                                                                const currentYear = now.getFullYear();
                                                                const currentMonth = now.getMonth() + 1;
                                                                const currentDay = now.getDate();
                                                                let daysElapsed = daysInMonth;
                                                                if (year === currentYear && month === currentMonth) daysElapsed = currentDay;
                                                                else if (year > currentYear || (year === currentYear && month > currentMonth)) daysElapsed = 0;

                                                                let expectedWorkDays = 0;
                                                                for (let d = 1; d <= daysInMonth; d++) {
                                                                    const date = new Date(year, month - 1, d);
                                                                    if (!weeklyHolidays.includes(date.getDay())) expectedWorkDays++;
                                                                }

                                                                let elapsedWorkDays = 0;
                                                                for (let d = 1; d <= daysElapsed; d++) {
                                                                    const date = new Date(year, month - 1, d);
                                                                    if (!weeklyHolidays.includes(date.getDay())) elapsedWorkDays++;
                                                                }
                                                                const absentDays = Math.max(0, elapsedWorkDays - attendanceDays - leaveDays);

                                                                const lateCount = attendances.filter(a => {
                                                                    if (a.status === "สาย") return true;
                                                                    if (a.status === "เข้างาน" && a.checkIn && isLate(new Date(a.checkIn))) return true;
                                                                    return false;
                                                                }).length;
                                                                const lateMinutes = attendances.reduce((sum, a) => {
                                                                    if (a.status === "สาย") return sum + (a.lateMinutes || 0);
                                                                    if (a.status === "เข้างาน" && a.checkIn && isLate(new Date(a.checkIn))) {
                                                                        return sum + getLateMinutes(new Date(a.checkIn));
                                                                    }
                                                                    return sum;
                                                                }, 0);
                                                                const totalOTHours = otRequests.filter(ot => {
                                                                    const otDate = new Date(ot.date);
                                                                    return ot.status === "อนุมัติ" && otDate.getMonth() === (month - 1) && otDate.getFullYear() === year;
                                                                }).reduce((sum, ot) => {
                                                                    if (ot.startTime && ot.endTime) {
                                                                        const start = ot.startTime instanceof Date ? ot.startTime : new Date(ot.startTime);
                                                                        const end = ot.endTime instanceof Date ? ot.endTime : new Date(ot.endTime);
                                                                        const minutes = (end.getTime() - start.getTime()) / (1000 * 60);
                                                                        return sum + minutes;
                                                                    }
                                                                    return sum;
                                                                }, 0);

                                                                const summary = { totalDays: daysInMonth, attendanceDays, leaveDays, absentDays, lateCount, lateMinutes, totalOTHours };
                                                                generateAttendancePDF(selectedEmployee.name, attendances, otRequests, summary, leaves, swapRequests);
                                                            }}
                                                            className="gap-2"
                                                        >
                                                            <Download className="w-4 h-4" />
                                                            Export PDF
                                                        </Button>
                                                    </div>
                                                </div>
                                                <AttendanceTable attendances={attendances} locationEnabled={locationEnabled} workTimeEnabled={workTimeEnabled} />
                                            </div>
                                        </div>
                                    )}
                                    {activeTab === "leave" && (
                                        <div className="space-y-4">
                                            <h3 className="font-semibold text-gray-800">รายการคำขอลา</h3>
                                            <LeaveTable leaves={leaves} onStatusUpdate={handleLeaveStatusUpdate} />
                                        </div>
                                    )}
                                    {activeTab === "ot" && (
                                        <div className="space-y-4">
                                            <h3 className="font-semibold text-gray-800">รายการคำขอ OT</h3>
                                            <OTTable otRequests={otRequests} onStatusUpdate={handleOTStatusUpdate} />
                                        </div>
                                    )}

                                    {activeTab === "swap" && (
                                        <div className="space-y-4">
                                            <h3 className="font-semibold text-gray-800 mb-4">ประวัติการขอสลับวันหยุด</h3>
                                            {swapRequests.length === 0 ? (
                                                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500">
                                                    ไม่มีประวัติการขอสลับวันหยุด
                                                </div>
                                            ) : (
                                                <div className="overflow-hidden rounded-xl border border-gray-200">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                                            <tr>
                                                                <th className="px-4 py-3">วันที่ยื่น</th>
                                                                <th className="px-4 py-3">วันหยุดเดิม (มาทำ)</th>
                                                                <th className="px-4 py-3">วันหยุดใหม่ (ขอหยุด)</th>
                                                                <th className="px-4 py-3">เหตุผล</th>
                                                                <th className="px-4 py-3 text-right">สถานะ</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100 bg-white">
                                                            {swapRequests.map((req) => (
                                                                <tr key={req.id} className="hover:bg-gray-50">
                                                                    <td className="px-4 py-3 text-gray-500">
                                                                        {req.createdAt ? format(req.createdAt instanceof Date ? req.createdAt : (req.createdAt as any).toDate(), "d MMM yy HH:mm", { locale: th }) : "-"}
                                                                    </td>
                                                                    <td className="px-4 py-3 font-medium">
                                                                        {format(req.workDate instanceof Date ? req.workDate : (req.workDate as any).toDate(), "d MMM yyyy", { locale: th })}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-blue-600 font-medium">
                                                                        {format(req.holidayDate instanceof Date ? req.holidayDate : (req.holidayDate as any).toDate(), "d MMM yyyy", { locale: th })}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={req.reason}>
                                                                        {req.reason}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${req.status === "อนุมัติ" ? "bg-green-50 text-green-700 border-green-200" :
                                                                            req.status === "ไม่อนุมัติ" ? "bg-red-50 text-red-700 border-red-200" :
                                                                                "bg-yellow-50 text-yellow-700 border-yellow-200"
                                                                            }`}>
                                                                            {req.status}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
