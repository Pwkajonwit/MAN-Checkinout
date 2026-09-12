"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { employeeService, attendanceService, leaveService, otService, swapService, systemConfigService, type Employee, type Attendance, type LeaveRequest, type OTRequest, type SwapRequest } from "@/lib/firestore";
import { AttendanceTable } from "@/components/dashboard/AttendanceTable";
import { LeaveTable } from "@/components/leave/LeaveTable";
import { OTTable } from "@/components/ot/OTTable";
import { Search, User, Download, Clock, Briefcase, FileText, ChevronRight, ChevronLeft, Phone, Mail, Calendar, MapPin, ArrowLeft } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { th } from "date-fns/locale";
import { sendPushMessage } from "@/app/actions/line";
import { generateAttendancePDF } from "@/lib/pdfGenerator";
import { generateAttendanceCSV } from "@/lib/csvGenerator";
import { getLateMinutes, isLate, formatMinutesToHours } from "@/lib/workTime";
import { Button } from "@/components/ui/button";
import { formatLeaveDayHourUnits, getLeaveDayUnits } from "@/lib/leaveUtils";

function SearchContent() {
    const searchParams = useSearchParams();
    const queryEmployeeId = searchParams.get("employeeId") || searchParams.get("id");
    const queryMonth = searchParams.get("month");
    const querySearch = searchParams.get("q") || searchParams.get("search");

    const [searchQuery, setSearchQuery] = useState(querySearch || "");
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

    const [filterType, setFilterType] = useState<"month" | "week" | "custom">("month");
    const [selectedMonth, setSelectedMonth] = useState(() => {
        if (queryMonth && /^\d{4}-\d{2}$/.test(queryMonth)) {
            return queryMonth;
        }
        return format(new Date(), "yyyy-MM");
    });
    const [selectedWeekDate, setSelectedWeekDate] = useState(() => new Date());
    const [customRange, setCustomRange] = useState(() => {
        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() - 7);
        return { start, end: today };
    });

    const getDateRange = useCallback(() => {
        if (filterType === "month") {
            const [year, month] = selectedMonth.split('-').map(Number);
            const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
            const endDate = new Date(year, month, 0, 23, 59, 59, 999);
            const totalDays = new Date(year, month, 0).getDate();
            return {
                startDate,
                endDate,
                label: format(startDate, "MMMM yyyy", { locale: th }),
                totalDays,
            };
        } else if (filterType === "week") {
            const startDate = startOfWeek(selectedWeekDate, { weekStartsOn: 1 });
            startDate.setHours(0, 0, 0, 0);
            const endDate = endOfWeek(selectedWeekDate, { weekStartsOn: 1 });
            endDate.setHours(23, 59, 59, 999);
            return {
                startDate,
                endDate,
                label: `สัปดาห์ ${format(startDate, "d MMM", { locale: th })} - ${format(endDate, "d MMM yyyy", { locale: th })}`,
                totalDays: 7,
            };
        } else {
            const startDate = new Date(customRange.start);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(customRange.end);
            endDate.setHours(23, 59, 59, 999);
            const diffMs = endDate.getTime() - startDate.getTime();
            const totalDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
            return {
                startDate,
                endDate,
                label: `ช่วงวันที่ ${format(startDate, "d MMM", { locale: th })} - ${format(endDate, "d MMM yyyy", { locale: th })}`,
                totalDays,
            };
        }
    }, [filterType, selectedMonth, selectedWeekDate, customRange]);

    const loadEmployeeData = useCallback(async (employeeId: string, customDates?: { startDate: Date; endDate: Date }) => {
        setLoadingData(true);
        try {
            const { startDate, endDate } = customDates || getDateRange();

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
    }, [getDateRange]);

    useEffect(() => {
        loadEmployees();
        const loadConfig = async () => {
            try {
                const config = await systemConfigService.get();
                if (config?.locationEnabled) {
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
    }, [selectedEmployee?.id, getDateRange, loadEmployeeData]);

    useEffect(() => {
        if (queryMonth && /^\d{4}-\d{2}$/.test(queryMonth) && queryMonth !== selectedMonth) {
            setSelectedMonth(queryMonth);
            setFilterType("month");
        }
    }, [queryMonth]);

    useEffect(() => {
        if (employees.length > 0 && queryEmployeeId) {
            const target = employees.find(
                emp => emp.id === queryEmployeeId || emp.employeeId === queryEmployeeId
            );
            if (target && target.id !== selectedEmployee?.id) {
                setSelectedEmployee(target);
                if (target.id) {
                    loadEmployeeData(target.id);
                }
            }
        } else if (employees.length > 0 && querySearch && !selectedEmployee) {
            setSearchQuery(querySearch);
        }
    }, [employees, queryEmployeeId, querySearch]);

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

    const handleSelectEmployee = (employee: Employee) => {
        setSelectedEmployee(employee);
        setSearchQuery(""); // Clear search to focus on detail
        setFilteredEmployees([]);
        if (employee.id) {
            loadEmployeeData(employee.id);
        }
        if (typeof window !== "undefined") {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set("employeeId", employee.id || employee.employeeId || "");
            window.history.replaceState(null, "", newUrl.toString());
        }
    };

    const handleBackToSearch = () => {
        setSelectedEmployee(null);
        setSearchQuery("");
        setFilteredEmployees([]);
        if (typeof window !== "undefined") {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("employeeId");
            newUrl.searchParams.delete("id");
            window.history.replaceState(null, "", newUrl.pathname);
        }
    };

    const summary = useMemo(() => {
        const { startDate, endDate, totalDays } = getDateRange();
        const attendanceDays = attendances.filter(a => a.status === "เข้างาน" || a.status === "สาย" || a.status === "ออกงาน").length;

        let leaveDays = 0;
        leaves.forEach(l => {
            if (l.status === "อนุมัติ") {
                const lStart = l.startDate instanceof Date ? l.startDate : new Date(l.startDate);
                const lEnd = l.endDate instanceof Date ? l.endDate : new Date(l.endDate);
                if (lStart <= endDate && lEnd >= startDate) {
                    leaveDays += getLeaveDayUnits(l);
                }
            }
        });

        const weeklyHolidays = selectedEmployee?.weeklyHolidays || [0, 6];
        let expectedWorkDays = 0;
        let elapsedWorkDays = 0;
        const now = new Date();
        now.setHours(23, 59, 59, 999);

        const cur = new Date(startDate);
        while (cur <= endDate) {
            if (!weeklyHolidays.includes(cur.getDay())) {
                expectedWorkDays++;
                if (cur <= now) {
                    elapsedWorkDays++;
                }
            }
            cur.setDate(cur.getDate() + 1);
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
            return sum + (a.lateMinutes || 0);
        }, 0);

        const totalOTHours = otRequests
            .filter(ot => {
                const otDate = ot.date instanceof Date ? ot.date : new Date(ot.date);
                return ot.status === "อนุมัติ" && otDate >= startDate && otDate <= endDate;
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
            totalDays,
            attendanceDays,
            leaveDays,
            absentDays,
            expectedWorkDays,
            lateCount,
            lateMinutes,
            totalOTHours,
        };
    }, [attendances, leaves, otRequests, getDateRange, selectedEmployee]);

    const handleExportCSV = () => {
        if (!selectedEmployee) return;
        generateAttendanceCSV(selectedEmployee.name, attendances, otRequests, summary, leaves, swapRequests);
    };

    const handleExportPDF = () => {
        if (!selectedEmployee) return;
        generateAttendancePDF(selectedEmployee.name, attendances, otRequests, summary, leaves, swapRequests);
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
                const days = getLeaveDayUnits(leave);

                if (leave.leaveType === "ลากิจ") used.personal += days;
                else if (leave.leaveType === "ลาป่วย") used.sick += days;
                else if (leave.leaveType === "ลาพักร้อน") used.vacation += days;
            }
        });
        return used;
    };

    return (
        <div className="w-full antialiased">
            <PageHeader
                title="ค้นหาและจัดการข้อมูลพนักงาน"
                subtitle="ดูประวัติการเข้างาน, การลา, OT และจัดการข้อมูลรายบุคคล"
            />

            {/* Search Section */}
            {!selectedEmployee && (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 mb-6 text-center">
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">ค้นหาพนักงาน</h2>
                    <p className="text-slate-700 mb-6">พิมพ์ชื่อ, รหัสพนักงาน หรืออีเมล เพื่อค้นหาข้อมูล</p>

                    <div className="relative max-w-2xl mx-auto">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="ค้นหา..."
                            className="w-full pl-12 pr-4 py-4 border border-slate-300 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />
                    </div>

                    {searchQuery && filteredEmployees.length > 0 && (
                        <div className="mt-6 max-w-2xl mx-auto text-left bg-white border border-slate-200 rounded-xl overflow-hidden">
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
                                        <div className="font-semibold text-slate-900 text-lg">{employee.name}</div>
                                        <div className="text-slate-700 flex items-center gap-2 text-sm">
                                            <span>ID: {employee.employeeId || "-"}</span>
                                            <span>•</span>
                                            <span>{employee.position}</span>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-500" />
                                </button>
                            ))}
                        </div>
                    )}

                    {searchQuery && filteredEmployees.length === 0 && (
                        <div className="mt-8 text-slate-700">
                            ไม่พบข้อมูลพนักงานที่ตรงกับคำค้นหา
                        </div>
                    )}

                    {!searchQuery && (
                        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto opacity-50">
                            <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-slate-300">
                                <Clock className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                                <div className="text-xs">ประวัติเวลา</div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-slate-300">
                                <Briefcase className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                                <div className="text-xs">การลา</div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-slate-300">
                                <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                                <div className="text-xs">โอที</div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-slate-300">
                                <User className="w-8 h-8 mx-auto mb-2 text-slate-600" />
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
                        className="mb-2 text-slate-700 hover:text-slate-900 p-0 hover:bg-transparent"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        กลับไปค้นหา
                    </Button>

                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-6">
                        <div className="p-5">
                            <div className="flex flex-col xl:flex-row gap-8 items-start xl:items-center justify-between">
                                
                                {/* Left Group: Avatar, Name, and Contact Info */}
                                <div className="flex flex-col md:flex-row items-start md:items-center gap-8 w-full xl:w-auto">
                                    {/* Avatar & Name */}
                                    <div className="flex items-center gap-4 min-w-fit">
                                        <div className="w-[72px] h-[72px] rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#4f46e5] flex items-center justify-center text-white font-bold text-3xl shrink-0 shadow-sm overflow-hidden">
                                        {selectedEmployee.avatar ? (
                                            <>
                                                <img
                                                    src={selectedEmployee.avatar}
                                                    alt={selectedEmployee.name}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = "none";
                                                        if (e.currentTarget.nextElementSibling) {
                                                            (e.currentTarget.nextElementSibling as HTMLElement).style.display = "block";
                                                        }
                                                    }}
                                                />
                                                <span className="hidden">
                                                    {selectedEmployee.name.charAt(0)}
                                                </span>
                                            </>
                                        ) : (
                                            <span>{selectedEmployee.name.charAt(0)}</span>
                                        )}
                                    </div>
                                        <div className="flex flex-col justify-center">
                                            <h1 className="text-xl font-bold text-slate-900">{selectedEmployee.name}</h1>
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {selectedEmployee.department && (
                                                    <span className="px-2 py-0.5 bg-slate-50 text-slate-800 rounded-md text-[10px] font-medium">
                                                        {selectedEmployee.department}
                                                    </span>
                                                )}
                                                {selectedEmployee.type && (
                                                    <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-md text-[10px] font-medium">
                                                        {selectedEmployee.type}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Contact Info */}
                                    <div className="flex flex-wrap gap-x-8 gap-y-4 md:border-l md:border-slate-100 md:pl-8">
                                        <div className="flex items-start gap-2.5">
                                            <User className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xs text-slate-500 leading-none">รหัสพนักงาน</span>
                                                <span className="text-sm font-semibold text-slate-800">{selectedEmployee.employeeId || "-"}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2.5">
                                            <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xs text-slate-500 leading-none">เบอร์โทรศัพท์</span>
                                                <span className="text-sm font-semibold text-slate-800">{selectedEmployee.phone || "-"}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2.5">
                                            <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xs text-slate-500 leading-none">อีเมล</span>
                                                <span className="text-sm font-semibold text-slate-800 truncate max-w-[120px]" title={selectedEmployee.email}>{selectedEmployee.email || "-"}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2.5">
                                            <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xs text-slate-500 leading-none">วันที่เริ่มงาน</span>
                                                <span className="text-sm font-semibold text-slate-800">
                                                    {selectedEmployee.registeredDate
                                                        ? format(new Date(selectedEmployee.registeredDate), "d MMM yyyy", { locale: th })
                                                        : "-"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Group: Stats Summary */}
                                <div className="flex divide-x divide-slate-100 bg-gray-50 rounded-xl border border-slate-100 p-2 xl:ml-auto w-full xl:w-auto overflow-x-auto mt-6 xl:mt-0">
                                    {[
                                        {
                                            label: "ลากิจ (คงเหลือ)",
                                            value: formatLeaveDayHourUnits(Math.max(0, (selectedEmployee.leaveQuota?.personal || 0) - getLeaveUsed().personal)),
                                            sub: "",
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
                                        <div key={i} className="py-2 px-6 text-center min-w-[120px]">
                                            <div className="text-xs font-medium text-slate-600 mb-1">{stat.label}</div>
                                            <div className="text-lg font-bold text-slate-900 flex items-baseline justify-center gap-1.5">
                                                {stat.value}
                                                {stat.sub && <span className="text-xs font-normal text-slate-600">{stat.sub}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                            </div>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="flex border-b border-slate-300">
                            <button
                                onClick={() => setActiveTab("attendance")}
                                className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === "attendance"
                                    ? "border-blue-600 text-blue-600 bg-blue-50/50"
                                    : "border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                                    }`}
                            >
                                <Clock className="w-4 h-4" />
                                ประวัติเวลาเข้า-ออก ({attendances.length})
                            </button>
                            <button
                                onClick={() => setActiveTab("leave")}
                                className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === "leave"
                                    ? "border-blue-600 text-blue-600 bg-blue-50/50"
                                    : "border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                                    }`}
                            >
                                <Briefcase className="w-4 h-4" />
                                ประวัติการลา ({leaves.length})
                            </button>
                            <button
                                onClick={() => setActiveTab("ot")}
                                className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === "ot"
                                    ? "border-blue-600 text-blue-600 bg-blue-50/50"
                                    : "border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                                    }`}
                            >
                                <FileText className="w-4 h-4" />
                                ประวัติ OT ({otRequests.length})
                            </button>
                            <button
                                onClick={() => setActiveTab("swap")}
                                className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === "swap"
                                    ? "border-blue-600 text-blue-600 bg-blue-50/50"
                                    : "border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                                    }`}
                            >
                                <Briefcase className="w-4 h-4" />
                                ประวัติสลับวัน ({swapRequests.length})
                            </button>
                        </div>

                        <div className="p-6 min-h-[400px]">
                            {loadingData ? (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-800">
                                    <div className="w-8 h-8 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                                    กำลังโหลดข้อมูล...
                                </div>
                            ) : (
                                <>
                                    {activeTab === "attendance" && (
                                        <div className="space-y-4">
                                            {/* Date Range Filter Bar */}
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                                                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                                    <div className="flex items-center gap-1.5 text-slate-700">
                                                        <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                                                        <span className="text-xs font-semibold">ตัวกรอง:</span>
                                                    </div>

                                                    {/* Filter Mode Toggle Pills */}
                                                    <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                                                        <button
                                                            type="button"
                                                            onClick={() => setFilterType("month")}
                                                            className={`px-3 py-1 rounded-md font-medium transition-all ${
                                                                filterType === "month"
                                                                    ? "bg-white text-slate-900 font-semibold shadow-2xs"
                                                                    : "text-slate-600 hover:text-slate-900"
                                                            }`}
                                                        >
                                                            รายเดือน
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setFilterType("week")}
                                                            className={`px-3 py-1 rounded-md font-medium transition-all ${
                                                                filterType === "week"
                                                                    ? "bg-white text-slate-900 font-semibold shadow-2xs"
                                                                    : "text-slate-600 hover:text-slate-900"
                                                            }`}
                                                        >
                                                            สัปดาห์
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setFilterType("custom")}
                                                            className={`px-3 py-1 rounded-md font-medium transition-all ${
                                                                filterType === "custom"
                                                                    ? "bg-white text-slate-900 font-semibold shadow-2xs"
                                                                    : "text-slate-600 hover:text-slate-900"
                                                            }`}
                                                        >
                                                            กำหนดเอง
                                                        </button>
                                                    </div>

                                                    {/* Month Input */}
                                                    {filterType === "month" && (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="month"
                                                                value={selectedMonth}
                                                                onChange={(e) => setSelectedMonth(e.target.value)}
                                                                className="h-8.5 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-normal text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Week Input & Navigation */}
                                                    {filterType === "week" && (
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedWeekDate(prev => subWeeks(prev, 1))}
                                                                className="h-8.5 w-8.5 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs"
                                                                title="สัปดาห์ก่อนหน้า"
                                                            >
                                                                <ChevronLeft className="w-4 h-4" />
                                                            </button>
                                                            <input
                                                                type="date"
                                                                value={format(selectedWeekDate, "yyyy-MM-dd")}
                                                                onChange={(e) => {
                                                                    if (e.target.value) {
                                                                        const [y, m, d] = e.target.value.split('-').map(Number);
                                                                        setSelectedWeekDate(new Date(y, m - 1, d));
                                                                    }
                                                                }}
                                                                className="h-8.5 px-2.5 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-normal text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedWeekDate(prev => addWeeks(prev, 1))}
                                                                className="h-8.5 w-8.5 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs"
                                                                title="สัปดาห์ถัดไป"
                                                            >
                                                                <ChevronRight className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedWeekDate(new Date())}
                                                                className="h-8.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors border border-slate-200"
                                                            >
                                                                สัปดาห์นี้
                                                            </button>
                                                            <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 hidden sm:inline-block">
                                                                {format(startOfWeek(selectedWeekDate, { weekStartsOn: 1 }), "d MMM", { locale: th })} - {format(endOfWeek(selectedWeekDate, { weekStartsOn: 1 }), "d MMM yyyy", { locale: th })}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Custom Date Range Input */}
                                                    {filterType === "custom" && (
                                                        <div className="flex items-center gap-1.5">
                                                            <input
                                                                type="date"
                                                                value={format(customRange.start, "yyyy-MM-dd")}
                                                                onChange={(e) => {
                                                                    if (e.target.value) {
                                                                        const [y, m, d] = e.target.value.split('-').map(Number);
                                                                        setCustomRange(prev => ({ ...prev, start: new Date(y, m - 1, d) }));
                                                                    }
                                                                }}
                                                                className="h-8.5 px-2 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                                                            />
                                                            <span className="text-slate-400 text-xs font-medium">ถึง</span>
                                                            <input
                                                                type="date"
                                                                value={format(customRange.end, "yyyy-MM-dd")}
                                                                onChange={(e) => {
                                                                    if (e.target.value) {
                                                                        const [y, m, d] = e.target.value.split('-').map(Number);
                                                                        setCustomRange(prev => ({ ...prev, end: new Date(y, m - 1, d) }));
                                                                    }
                                                                }}
                                                                className="h-8.5 px-2 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Export buttons */}
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handleExportCSV}
                                                        className="h-8.5 gap-1.5 text-xs text-green-700 border-green-200 hover:bg-green-50"
                                                    >
                                                        <FileText className="w-3.5 h-3.5" />
                                                        Export CSV
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handleExportPDF}
                                                        className="h-8.5 gap-1.5 text-xs text-slate-700 border-slate-200 hover:bg-slate-50"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                        Export PDF
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Summary Cards */}
                                            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200/90">
                                                <div className="text-center">
                                                    <div className="text-2xl font-bold text-slate-900 tabular-nums">{summary.attendanceDays}</div>
                                                    <div className="text-xs text-slate-600 font-normal mt-0.5">วันมาทำงาน</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-2xl font-bold text-slate-900 tabular-nums">{summary.leaveDays}</div>
                                                    <div className="text-xs text-slate-600 font-normal mt-0.5">วันลา</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-2xl font-bold text-slate-900 tabular-nums">
                                                        {summary.absentDays} <span className="text-base text-slate-500 font-normal">/ {summary.expectedWorkDays}</span>
                                                    </div>
                                                    <div className="text-xs text-slate-600 font-normal mt-0.5">วันขาด (โดยประมาณ)</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-2xl font-bold text-rose-600 tabular-nums">{summary.lateCount}</div>
                                                    <div className="text-xs text-slate-600 font-normal mt-0.5">สาย (ครั้ง)</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-lg font-bold text-rose-600 tabular-nums">{formatMinutesToHours(summary.lateMinutes)}</div>
                                                    <div className="text-xs text-slate-600 font-normal mt-0.5">รวมเวลาสาย</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-lg font-bold text-blue-600 tabular-nums">{formatMinutesToHours(summary.totalOTHours)}</div>
                                                    <div className="text-xs text-slate-600 font-normal mt-0.5">รวม OT (ชม.)</div>
                                                </div>
                                            </div>

                                            {/* Attendance Table Header & Table */}
                                            <div className="pt-2">
                                                <div className="flex items-center justify-between pb-3">
                                                    <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                                                        <span>ประวัติการลงเวลา</span>
                                                        <span className="text-xs font-normal text-slate-500">({getDateRange().label})</span>
                                                    </h3>
                                                    <span className="text-xs text-slate-500">
                                                        พบ <strong className="text-slate-800">{attendances.length}</strong> รายการ
                                                    </span>
                                                </div>
                                                <AttendanceTable attendances={attendances} locationEnabled={locationEnabled} workTimeEnabled={workTimeEnabled} />
                                            </div>
                                        </div>
                                    )}
                                    {activeTab === "leave" && (
                                        <div className="space-y-4">
                                            <h3 className="font-semibold text-slate-900">รายการคำขอลา</h3>
                                            <LeaveTable leaves={leaves} onStatusUpdate={handleLeaveStatusUpdate} />
                                        </div>
                                    )}
                                    {activeTab === "ot" && (
                                        <div className="space-y-4">
                                            <h3 className="font-semibold text-slate-900">รายการคำขอ OT</h3>
                                            <OTTable otRequests={otRequests} onStatusUpdate={handleOTStatusUpdate} />
                                        </div>
                                    )}

                                    {activeTab === "swap" && (
                                        <div className="space-y-4">
                                            <h3 className="font-semibold text-slate-900 mb-4">ประวัติการขอสลับวันหยุด</h3>
                                            {swapRequests.length === 0 ? (
                                                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-slate-300 text-slate-800">
                                                    ไม่มีประวัติการขอสลับวันหยุด
                                                </div>
                                            ) : (
                                                <div className="overflow-hidden rounded-xl border border-slate-300">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="bg-gray-50 text-slate-800 font-medium border-b border-slate-300">
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
                                                                    <td className="px-4 py-3 text-slate-800">
                                                                        {req.createdAt ? format(req.createdAt instanceof Date ? req.createdAt : (req.createdAt as any).toDate(), "d MMM yy HH:mm", { locale: th }) : "-"}
                                                                    </td>
                                                                    <td className="px-4 py-3 font-medium">
                                                                        {format(req.workDate instanceof Date ? req.workDate : (req.workDate as any).toDate(), "d MMM yyyy", { locale: th })}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-blue-600 font-medium">
                                                                        {format(req.holidayDate instanceof Date ? req.holidayDate : (req.holidayDate as any).toDate(), "d MMM yyyy", { locale: th })}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-gray-800 max-w-xs truncate" title={req.reason}>
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

export default function SearchPage() {
    return (
        <Suspense fallback={
            <div className="w-full min-h-[400px] flex items-center justify-center text-slate-500 font-normal">
                <div className="animate-spin w-6 h-6 border-2 border-slate-600 border-t-transparent rounded-full mr-2"></div>
                กำลังโหลด...
            </div>
        }>
            <SearchContent />
        </Suspense>
    );
}
