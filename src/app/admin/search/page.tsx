"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { employeeService, attendanceService, leaveService, otService, type Employee, type Attendance, type LeaveRequest, type OTRequest } from "@/lib/firestore";
import { AttendanceTable } from "@/components/dashboard/AttendanceTable";
import { LeaveTable } from "@/components/leave/LeaveTable";
import { OTTable } from "@/components/ot/OTTable";
import { Search, User, Calendar, Clock, TrendingUp, Copy, Check, ChevronDown, ChevronUp, Briefcase, FileText, Download } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { isLate, getLateMinutes, isEligibleForOT, getOTMinutes, formatMinutesToHours } from "@/lib/workTime";
import { sendPushMessage } from "@/app/actions/line";
import { generateAttendancePDF } from "@/lib/pdfGenerator";

export default function SearchPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [attendances, setAttendances] = useState<Attendance[]>([]);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [otRequests, setOTRequests] = useState<OTRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingData, setLoadingData] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        loadEmployees();
    }, []);

    useEffect(() => {
        if (searchQuery.trim() === "") {
            setFilteredEmployees([]);
            setSelectedEmployee(null);
            setShowDetails(false);
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = employees.filter(emp =>
                emp.name.toLowerCase().includes(query) ||
                emp.email.toLowerCase().includes(query) ||
                emp.employeeId?.toLowerCase().includes(query) ||
                emp.lineUserId?.toLowerCase().includes(query)
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
            // Get attendance for the last 30 days
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);

            const [attendanceData, leaveData, otData] = await Promise.all([
                attendanceService.getHistory(employeeId, startDate, endDate),
                leaveService.getByEmployeeId(employeeId),
                otService.getByEmployeeId(employeeId)
            ]);

            setAttendances(attendanceData);
            setLeaves(leaveData);
            setOTRequests(otData);
        } catch (error) {
            console.error("Error loading employee data:", error);
        } finally {
            setLoadingData(false);
        }
    };

    const handleSelectEmployee = (employee: Employee) => {
        setSelectedEmployee(employee);
        setShowDetails(true);
        if (employee.id) {
            loadEmployeeData(employee.id);
        }
    };

    const handleCopyLineId = async (lineUserId: string) => {
        try {
            await navigator.clipboard.writeText(lineUserId);
            setCopiedId(lineUserId);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    const handleLeaveStatusUpdate = async (id: string, status: LeaveRequest["status"]) => {
        try {
            await leaveService.updateStatus(id, status);

            // Send notification
            if (selectedEmployee && selectedEmployee.lineUserId) {
                const request = leaves.find(l => l.id === id);
                if (request) {
                    const isApproved = status === "อนุมัติ";
                    const color = isApproved ? "#1DB446" : "#D32F2F";
                    const title = isApproved ? "อนุมัติคำขอลา" : "ไม่อนุมัติคำขอลา";

                    const startDate = request.startDate instanceof Date ? request.startDate : new Date(request.startDate);
                    const endDate = request.endDate instanceof Date ? request.endDate : new Date(request.endDate);
                    const dateStr = `${startDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - ${endDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`;

                    await sendPushMessage(selectedEmployee.lineUserId, [
                        {
                            type: "flex",
                            altText: `ผลการพิจารณาการลา: ${status}`,
                            contents: {
                                type: "bubble",
                                header: {
                                    type: "box",
                                    layout: "vertical",
                                    contents: [
                                        {
                                            type: "text",
                                            text: title,
                                            weight: "bold",
                                            color: color,
                                            size: "lg"
                                        }
                                    ]
                                },
                                body: {
                                    type: "box",
                                    layout: "vertical",
                                    contents: [
                                        {
                                            type: "box",
                                            layout: "vertical",
                                            margin: "lg",
                                            spacing: "sm",
                                            contents: [
                                                {
                                                    type: "box",
                                                    layout: "baseline",
                                                    spacing: "sm",
                                                    contents: [
                                                        {
                                                            type: "text",
                                                            text: "ประเภท",
                                                            color: "#aaaaaa",
                                                            size: "sm",
                                                            flex: 1
                                                        },
                                                        {
                                                            type: "text",
                                                            text: request.leaveType,
                                                            wrap: true,
                                                            color: "#666666",
                                                            size: "sm",
                                                            flex: 5
                                                        }
                                                    ]
                                                },
                                                {
                                                    type: "box",
                                                    layout: "baseline",
                                                    spacing: "sm",
                                                    contents: [
                                                        {
                                                            type: "text",
                                                            text: "วันที่",
                                                            color: "#aaaaaa",
                                                            size: "sm",
                                                            flex: 1
                                                        },
                                                        {
                                                            type: "text",
                                                            text: dateStr,
                                                            wrap: true,
                                                            color: "#666666",
                                                            size: "sm",
                                                            flex: 5
                                                        }
                                                    ]
                                                },
                                                {
                                                    type: "box",
                                                    layout: "baseline",
                                                    spacing: "sm",
                                                    contents: [
                                                        {
                                                            type: "text",
                                                            text: "สถานะ",
                                                            color: "#aaaaaa",
                                                            size: "sm",
                                                            flex: 1
                                                        },
                                                        {
                                                            type: "text",
                                                            text: status,
                                                            wrap: true,
                                                            color: color,
                                                            size: "sm",
                                                            flex: 5,
                                                            weight: "bold"
                                                        }
                                                    ]
                                                }
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    ]);
                }
            }

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

            // Send notification
            if (selectedEmployee && selectedEmployee.lineUserId) {
                const request = otRequests.find(r => r.id === id);
                if (request) {
                    const isApproved = status === "อนุมัติ";
                    const color = isApproved ? "#1DB446" : "#D32F2F";
                    const title = isApproved ? "อนุมัติคำขอ OT" : "ไม่อนุมัติคำขอ OT";

                    const dateStr = request.date instanceof Date
                        ? request.date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
                        : new Date(request.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

                    const startTime = request.startTime instanceof Date ? request.startTime : new Date(request.startTime);
                    const endTime = request.endTime instanceof Date ? request.endTime : new Date(request.endTime);
                    const timeStr = `${startTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - ${endTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;

                    await sendPushMessage(selectedEmployee.lineUserId, [
                        {
                            type: "flex",
                            altText: `ผลการพิจารณา OT: ${status}`,
                            contents: {
                                type: "bubble",
                                header: {
                                    type: "box",
                                    layout: "vertical",
                                    contents: [
                                        {
                                            type: "text",
                                            text: title,
                                            weight: "bold",
                                            color: color,
                                            size: "lg"
                                        }
                                    ]
                                },
                                body: {
                                    type: "box",
                                    layout: "vertical",
                                    contents: [
                                        {
                                            type: "box",
                                            layout: "vertical",
                                            margin: "lg",
                                            spacing: "sm",
                                            contents: [
                                                {
                                                    type: "box",
                                                    layout: "baseline",
                                                    spacing: "sm",
                                                    contents: [
                                                        {
                                                            type: "text",
                                                            text: "วันที่",
                                                            color: "#aaaaaa",
                                                            size: "sm",
                                                            flex: 1
                                                        },
                                                        {
                                                            type: "text",
                                                            text: dateStr,
                                                            wrap: true,
                                                            color: "#666666",
                                                            size: "sm",
                                                            flex: 5
                                                        }
                                                    ]
                                                },
                                                {
                                                    type: "box",
                                                    layout: "baseline",
                                                    spacing: "sm",
                                                    contents: [
                                                        {
                                                            type: "text",
                                                            text: "เวลา",
                                                            color: "#aaaaaa",
                                                            size: "sm",
                                                            flex: 1
                                                        },
                                                        {
                                                            type: "text",
                                                            text: timeStr,
                                                            wrap: true,
                                                            color: "#666666",
                                                            size: "sm",
                                                            flex: 5
                                                        }
                                                    ]
                                                },
                                                {
                                                    type: "box",
                                                    layout: "baseline",
                                                    spacing: "sm",
                                                    contents: [
                                                        {
                                                            type: "text",
                                                            text: "สถานะ",
                                                            color: "#aaaaaa",
                                                            size: "sm",
                                                            flex: 1
                                                        },
                                                        {
                                                            type: "text",
                                                            text: status,
                                                            wrap: true,
                                                            color: color,
                                                            size: "sm",
                                                            flex: 5,
                                                            weight: "bold"
                                                        }
                                                    ]
                                                }
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    ]);
                }
            }

            if (selectedEmployee?.id) {
                loadEmployeeData(selectedEmployee.id);
            }
        } catch (error) {
            console.error("Error updating OT status:", error);
            alert("เกิดข้อผิดพลาดในการอัพเดทสถานะ");
        }
    };

    // Calculate statistics
    // Calculate statistics
    const stats = selectedEmployee ? {
        totalDays: new Set(attendances.map(a => a.date ? format(a.date, 'yyyy-MM-dd') : '')).size,
        late: attendances.filter(a => a.status === "เข้างาน" && a.checkIn && isLate(a.checkIn)).length,
        onTime: attendances.filter(a => a.status === "เข้างาน" && a.checkIn && !isLate(a.checkIn)).length,
        totalOT: otRequests
            .filter(ot => ot.status === "อนุมัติ")
            .reduce((sum, ot) => {
                const start = ot.startTime instanceof Date ? ot.startTime : new Date(ot.startTime);
                const end = ot.endTime instanceof Date ? ot.endTime : new Date(ot.endTime);
                const minutes = (end.getTime() - start.getTime()) / (1000 * 60);
                return sum + minutes;
            }, 0),
        leave: leaves
            .filter(l => l.status === "อนุมัติ")
            .reduce((sum, l) => {
                const start = l.startDate instanceof Date ? l.startDate : new Date(l.startDate);
                const end = l.endDate instanceof Date ? l.endDate : new Date(l.endDate);
                const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                return sum + days;
            }, 0),
    } : null;

    return (
        <div>
            <PageHeader
                title="ค้นหาข้อมูลพนักงาน"
                subtitle="ค้นหาและดูรายละเอียดพนักงานแต่ละคน"
            />

            {/* Search Box */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ค้นหาด้วย ชื่อ, รหัสพนักงาน, อีเมล, หรือ LINE User ID..."
                        className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 placeholder:text-gray-400"
                    />
                </div>

                {/* Search Results */}
                {searchQuery && filteredEmployees.length > 0 && (
                    <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                        <p className="text-sm text-gray-500 mb-2">พบ {filteredEmployees.length} รายการ</p>
                        {filteredEmployees.map((employee) => (
                            <button
                                key={employee.id}
                                onClick={() => handleSelectEmployee(employee)}
                                className={`w-full text-left p-4 rounded-xl border transition-all ${selectedEmployee?.id === employee.id
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                                        {employee.name.charAt(0)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-800">{employee.name}</div>
                                        <div className="text-sm text-gray-500">
                                            {employee.employeeId && `รหัส: ${employee.employeeId}`}
                                            {employee.position && ` | ${employee.position}`}
                                        </div>
                                    </div>
                                    {selectedEmployee?.id === employee.id && (
                                        <div className="text-blue-600">
                                            {showDetails ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                        </div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {searchQuery && filteredEmployees.length === 0 && (
                    <div className="mt-4 text-center py-8 text-gray-500">
                        <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>ไม่พบพนักงานที่ค้นหา</p>
                    </div>
                )}
            </div>

            {/* Employee Details */}
            {selectedEmployee && showDetails && (
                <div className="space-y-6">
                    {/* Employee Info Card */}
                    <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border border-blue-100 p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                                    {selectedEmployee.name.charAt(0)}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-800">{selectedEmployee.name}</h2>
                                    <p className="text-gray-600">{selectedEmployee.position}</p>
                                </div>
                            </div>
                            <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                                {selectedEmployee.type}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white/60 rounded-lg p-3">
                                <div className="text-sm text-gray-600 mb-1">รหัสพนักงาน</div>
                                <div className="font-medium text-gray-800">{selectedEmployee.employeeId || "-"}</div>
                            </div>
                            <div className="bg-white/60 rounded-lg p-3">
                                <div className="text-sm text-gray-600 mb-1">อีเมล</div>
                                <div className="font-medium text-gray-800">{selectedEmployee.email}</div>
                            </div>
                            <div className="bg-white/60 rounded-lg p-3">
                                <div className="text-sm text-gray-600 mb-1">เบอร์โทร</div>
                                <div className="font-medium text-gray-800">{selectedEmployee.phone || "-"}</div>
                            </div>
                            <div className="bg-white/60 rounded-lg p-3">
                                <div className="text-sm text-gray-600 mb-1">วันที่เริ่มงาน</div>
                                <div className="font-medium text-gray-800">
                                    {selectedEmployee.registeredDate
                                        ? format(selectedEmployee.registeredDate, "d MMMM yyyy", { locale: th })
                                        : "-"}
                                </div>
                            </div>
                            {selectedEmployee.lineUserId && (
                                <div className="bg-white/60 rounded-lg p-3 md:col-span-2">
                                    <div className="text-sm text-gray-600 mb-2">LINE User ID</div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-2 rounded-lg border border-green-200 flex-1">
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                                            </svg>
                                            <span className="text-sm font-mono">{selectedEmployee.lineUserId}</span>
                                        </div>
                                        <button
                                            onClick={() => handleCopyLineId(selectedEmployee.lineUserId!)}
                                            className="p-2 hover:bg-white rounded-lg transition-colors"
                                            title="คัดลอก"
                                        >
                                            {copiedId === selectedEmployee.lineUserId ? (
                                                <Check className="w-5 h-5 text-green-600" />
                                            ) : (
                                                <Copy className="w-5 h-5 text-gray-400" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Leave Quota */}
                        <div className="mt-4 bg-white/60 rounded-lg p-4">
                            <div className="text-sm text-gray-600 mb-3">โควต้าการลา (คงเหลือ / ทั้งหมด)</div>
                            <div className="grid grid-cols-3 gap-4">
                                {(() => {
                                    const used = {
                                        personal: 0,
                                        sick: 0,
                                        vacation: 0
                                    };

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

                                    return (
                                        <>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-blue-600">
                                                    {Math.max(0, selectedEmployee.leaveQuota.personal - used.personal)}/{selectedEmployee.leaveQuota.personal}
                                                </div>
                                                <div className="text-xs text-gray-600">ลากิจ</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-orange-600">
                                                    {Math.max(0, selectedEmployee.leaveQuota.sick - used.sick)}/{selectedEmployee.leaveQuota.sick}
                                                </div>
                                                <div className="text-xs text-gray-600">ลาป่วย</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-purple-600">
                                                    {Math.max(0, selectedEmployee.leaveQuota.vacation - used.vacation)}/{selectedEmployee.leaveQuota.vacation}
                                                </div>
                                                <div className="text-xs text-gray-600">ลาพักร้อน</div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Statistics */}
                    {stats && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                        <Calendar className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div className="text-sm text-gray-600">เข้างานทั้งหมด</div>
                                </div>
                                <div className="text-3xl font-bold text-gray-800">{stats.totalDays}</div>
                                <div className="text-xs text-gray-500 mt-1">30 วันที่ผ่านมา</div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                                        <Clock className="w-5 h-5 text-red-600" />
                                    </div>
                                    <div className="text-sm text-gray-600">มาสาย</div>
                                </div>
                                <div className="text-3xl font-bold text-red-600">{stats.late}</div>
                                <div className="text-xs text-gray-500 mt-1">ครั้ง</div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                                        <TrendingUp className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div className="text-sm text-gray-600">โอที</div>
                                </div>
                                <div className="text-3xl font-bold text-purple-600">{Math.floor(stats.totalOT / 60)}</div>
                                <div className="text-xs text-gray-500 mt-1">ชั่วโมง</div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
                                        <User className="w-5 h-5 text-yellow-600" />
                                    </div>
                                    <div className="text-sm text-gray-600">ลางาน</div>
                                </div>
                                <div className="text-3xl font-bold text-yellow-600">{stats.leave}</div>
                                <div className="text-xs text-gray-500 mt-1">วัน</div>
                            </div>
                        </div>
                    )}

                    {/* Attendance History */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Clock className="w-5 h-5 text-blue-600" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-800">ประวัติการเข้า-ออกงาน (30 วันล่าสุด)</h3>
                            </div>
                            <button
                                onClick={() => generateAttendancePDF(selectedEmployee.name, attendances)}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                ดาวน์โหลดรายงาน
                            </button>
                        </div>

                        {loadingData ? (
                            <div className="text-center py-12">
                                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                                <p className="text-gray-600 mt-4">กำลังโหลดข้อมูล...</p>
                            </div>
                        ) : (
                            <AttendanceTable attendances={attendances} />
                        )}
                    </div>

                    {/* Leave History */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-yellow-100 rounded-lg">
                                <Briefcase className="w-5 h-5 text-yellow-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800">ประวัติการลา</h3>
                        </div>

                        {loadingData ? (
                            <div className="text-center py-12">
                                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                                <p className="text-gray-600 mt-4">กำลังโหลดข้อมูล...</p>
                            </div>
                        ) : (
                            <LeaveTable leaves={leaves} onStatusUpdate={handleLeaveStatusUpdate} />
                        )}
                    </div>

                    {/* OT History */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <FileText className="w-5 h-5 text-purple-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800">ประวัติการขอ OT</h3>
                        </div>

                        {loadingData ? (
                            <div className="text-center py-12">
                                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                                <p className="text-gray-600 mt-4">กำลังโหลดข้อมูล...</p>
                            </div>
                        ) : (
                            <OTTable otRequests={otRequests} onStatusUpdate={handleOTStatusUpdate} />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
