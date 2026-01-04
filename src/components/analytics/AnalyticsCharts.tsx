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
import { format, subDays, subMonths, subYears, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, isSameDay, isWithinInterval, eachDayOfInterval, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { isLate, getLateMinutes, formatMinutesToHours } from "@/lib/workTime";
import { Users, UserCheck, Clock, CalendarOff, Download, Filter, CheckSquare, Square, X, FileSpreadsheet, Calendar } from "lucide-react";

const COLORS = ["#059669", "#10B981", "#34D399", "#6EE7B7", "#C6F6D5"];
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

    // Export Modal State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportOptions, setExportOptions] = useState({
        attendance: true,
        lateList: true,
        leaveData: true,
        otData: true,
        summary: true
    });

    // Raw Attendance Data for export
    const [rawAttendanceData, setRawAttendanceData] = useState<Attendance[]>([]);

    // Raw Export Modal State
    const [showRawExportModal, setShowRawExportModal] = useState(false);
    const [rawExportDateType, setRawExportDateType] = useState<'custom' | 'today' | 'week' | 'month' | 'year'>('month');
    const [rawExportStartDate, setRawExportStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [rawExportEndDate, setRawExportEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [rawExportLoading, setRawExportLoading] = useState(false);
    const [rawExportData, setRawExportData] = useState<Attendance[]>([]);
    // Map: Firestore Employee ID -> Employee employeeId (รหัสพนักงาน)
    const [employeeIdMap, setEmployeeIdMap] = useState<Record<string, string>>({});

    // Column selection for raw export
    const [rawExportColumns, setRawExportColumns] = useState({
        employeeId: true,
        employeeName: true,
        status: true,
        date: true,
        checkIn: true,
        checkOut: true,
        location: true,
        latitude: false,
        longitude: false,
        distance: true,
        note: true
    });

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

            // Store raw attendance for export
            setRawAttendanceData(filteredAttendance);

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
        const sheets: string[] = [];
        const timestamp = format(new Date(), "yyyyMMdd_HHmmss");

        // Header for the combined CSV
        let csvContent = "";

        // 1. Summary Stats
        if (exportOptions.summary) {
            csvContent += "=== สรุปภาพรวม ===\n";
            csvContent += "รายการ,จำนวน\n";
            csvContent += `พนักงานทั้งหมด,${summaryStats.totalEmployees}\n`;
            csvContent += `เข้างานเฉลี่ย/วัน,${summaryStats.avgAttendance}\n`;
            csvContent += `มาสาย (ครั้ง),${summaryStats.totalLate}\n`;
            csvContent += `ลางาน (ครั้ง),${summaryStats.totalLeaves}\n`;
            csvContent += "\n";
        }

        // 2. Attendance Data
        if (exportOptions.attendance) {
            csvContent += "=== ข้อมูลการเข้างานรายวัน ===\n";
            csvContent += "วันที่,ตรงเวลา,มาสาย,ขาด\n";
            attendanceData.forEach(d => {
                csvContent += `${d.fullDate},${d.present},${d.late},${d.absent}\n`;
            });
            csvContent += "\n";
        }

        // 3. Late List
        if (exportOptions.lateList && lateEmployees.length > 0) {
            csvContent += "=== รายชื่อพนักงานมาสาย ===\n";
            csvContent += "ชื่อ,วันที่,เวลาเข้างาน,สายกี่นาที,แผนก\n";
            lateEmployees.forEach(emp => {
                csvContent += `${emp.name},${emp.date},${emp.time},${emp.lateMinutes},${emp.department}\n`;
            });
            csvContent += "\n";
        }

        // 4. Leave Data
        if (exportOptions.leaveData && leaveData.length > 0) {
            csvContent += "=== สถิติการลาตามประเภท ===\n";
            csvContent += "ประเภทการลา,จำนวน (ครั้ง)\n";
            leaveData.forEach(l => {
                csvContent += `${l.name},${l.value}\n`;
            });
            csvContent += "\n";
        }

        // 5. OT Data
        if (exportOptions.otData) {
            csvContent += "=== ข้อมูลโอทีรายวัน ===\n";
            csvContent += "วันที่,ชั่วโมงโอที\n";
            otData.forEach(ot => {
                csvContent += `${ot.name},${ot.hours}\n`;
            });
            csvContent += "\n";
        }

        // Add BOM for UTF-8 encoding (important for Thai characters in Excel)
        const BOM = "\uFEFF";
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `analytics_report_${startDate}_${endDate}_${timestamp}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setShowExportModal(false);
    };

    const toggleExportOption = (key: keyof typeof exportOptions) => {
        setExportOptions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const selectAllExportOptions = (value: boolean) => {
        setExportOptions({
            attendance: value,
            lateList: value,
            leaveData: value,
            otData: value,
            summary: value
        });
    };

    // Handle Raw Export Date Type Change
    const handleRawExportDateTypeChange = (type: typeof rawExportDateType) => {
        setRawExportDateType(type);
        const today = new Date();

        switch (type) {
            case 'today':
                setRawExportStartDate(format(today, 'yyyy-MM-dd'));
                setRawExportEndDate(format(today, 'yyyy-MM-dd'));
                break;
            case 'week':
                setRawExportStartDate(format(subDays(today, 7), 'yyyy-MM-dd'));
                setRawExportEndDate(format(today, 'yyyy-MM-dd'));
                break;
            case 'month':
                setRawExportStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
                setRawExportEndDate(format(today, 'yyyy-MM-dd'));
                break;
            case 'year':
                setRawExportStartDate(format(startOfYear(today), 'yyyy-MM-dd'));
                setRawExportEndDate(format(today, 'yyyy-MM-dd'));
                break;
            case 'custom':
                // Keep current dates
                break;
        }
    };

    // Load Raw Export Data
    const loadRawExportData = async () => {
        setRawExportLoading(true);
        try {
            const start = startOfDay(parseISO(rawExportStartDate));
            const end = endOfDay(parseISO(rawExportEndDate));

            // Load both attendance and employees
            const [data, allEmployees] = await Promise.all([
                attendanceService.getByDateRange(start, end),
                employeeService.getAll()
            ]);

            // Create map: Firestore ID -> employeeId (รหัสพนักงาน)
            const idMap: Record<string, string> = {};
            allEmployees.forEach(emp => {
                if (emp.id) {
                    idMap[emp.id] = emp.employeeId || emp.id; // Use employeeId if exists, otherwise use firestore ID
                }
            });

            setEmployeeIdMap(idMap);
            setRawExportData(data);
        } catch (error) {
            console.error('Error loading raw export data:', error);
            setRawExportData([]);
        } finally {
            setRawExportLoading(false);
        }
    };

    // Effect to load data when modal opens or dates change
    useEffect(() => {
        if (showRawExportModal) {
            loadRawExportData();
        }
    }, [showRawExportModal, rawExportStartDate, rawExportEndDate]);

    // Handle Raw Data Export
    const handleRawExport = () => {
        if (rawExportData.length === 0) {
            alert('ไม่มีข้อมูลในช่วงเวลาที่เลือก');
            return;
        }

        const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
        let csvContent = '';

        // Build header based on selected columns
        const columnDefs = [
            { key: 'employeeId', label: 'รหัสพนักงาน' },
            { key: 'employeeName', label: 'ชื่อพนักงาน' },
            { key: 'status', label: 'สถานะ' },
            { key: 'date', label: 'วันที่' },
            { key: 'checkIn', label: 'เวลาเข้างาน' },
            { key: 'checkOut', label: 'เวลาออกงาน' },
            { key: 'location', label: 'สถานที่' },
            { key: 'latitude', label: 'ละติจูด' },
            { key: 'longitude', label: 'ลองจิจูด' },
            { key: 'distance', label: 'ระยะห่าง(เมตร)' },
            { key: 'note', label: 'หมายเหตุ' }
        ];

        const selectedColumns = columnDefs.filter(col => rawExportColumns[col.key as keyof typeof rawExportColumns]);
        csvContent += selectedColumns.map(col => col.label).join(',') + '\n';

        rawExportData.forEach(a => {
            const values: string[] = [];
            // Get real employeeId from map
            const realEmployeeId = employeeIdMap[a.employeeId] || a.employeeId || '-';

            if (rawExportColumns.employeeId) values.push(realEmployeeId);
            if (rawExportColumns.employeeName) values.push(a.employeeName);
            if (rawExportColumns.status) values.push(a.status);
            if (rawExportColumns.date) values.push(a.date ? format(a.date, 'yyyy-MM-dd') : '-');
            if (rawExportColumns.checkIn) values.push(a.checkIn ? format(a.checkIn, 'HH:mm:ss') : '-');
            if (rawExportColumns.checkOut) values.push(a.checkOut ? format(a.checkOut, 'HH:mm:ss') : '-');
            if (rawExportColumns.location) values.push((a.location || '-').replace(/,/g, ' '));
            if (rawExportColumns.latitude) values.push(a.latitude?.toFixed(6) || '-');
            if (rawExportColumns.longitude) values.push(a.longitude?.toFixed(6) || '-');
            if (rawExportColumns.distance) values.push(a.distance !== undefined ? a.distance.toFixed(0) : '-');
            if (rawExportColumns.note) values.push((a.locationNote || '-').replace(/,/g, ' ').replace(/\n/g, ' '));

            csvContent += values.join(',') + '\n';
        });

        // Add BOM for UTF-8
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `attendance_raw_${rawExportStartDate}_${rawExportEndDate}_${timestamp}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setShowRawExportModal(false);
    };

    // Toggle raw export column
    const toggleRawExportColumn = (key: keyof typeof rawExportColumns) => {
        setRawExportColumns(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Select all/none columns
    const selectAllRawColumns = (value: boolean) => {
        setRawExportColumns({
            employeeId: value,
            employeeName: value,
            status: value,
            date: value,
            checkIn: value,
            checkOut: value,
            location: value,
            latitude: value,
            longitude: value,
            distance: value,
            note: value
        });
    };

    // Handle Time Clock Export (สำหรับเครื่องลงเวลา)
    const handleTimeClockExport = () => {
        if (rawExportData.length === 0) {
            alert('ไม่มีข้อมูลในช่วงเวลาที่เลือก');
            return;
        }

        const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
        let csvContent = '';

        // Header
        csvContent += 'รหัส,วัน/เวลา\n';

        // Process data - create rows for both check-in and check-out
        rawExportData.forEach(a => {
            // Get real employeeId from map
            const realEmployeeId = employeeIdMap[a.employeeId] || a.employeeId || a.employeeName;

            // Check-in record
            if (a.checkIn) {
                const dateTimeStr = format(a.checkIn, 'dd-MM-yyyy HH:mm');
                csvContent += `${realEmployeeId},${dateTimeStr}\n`;
            }

            // Check-out record (separate row)
            if (a.checkOut) {
                const dateTimeStr = format(a.checkOut, 'dd-MM-yyyy HH:mm');
                csvContent += `${realEmployeeId},${dateTimeStr}\n`;
            }
        });

        // Add BOM for UTF-8
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `timeclock_${rawExportStartDate}_${rawExportEndDate}_${timestamp}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setShowRawExportModal(false);
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
                    <div className="flex gap-2 w-full md:w-auto">
                        <Button onClick={() => setShowExportModal(true)} variant="outline" className="gap-2 flex-1 md:flex-none bg-primary hover:bg-primary text-white">
                            <Download className="w-4 h-4" />
                            Export CSV
                        </Button>
                        <Button onClick={() => setShowRawExportModal(true)} className="gap-2 flex-1 md:flex-none  bg-primary-dark hover:bg-primary-dark text-white">
                            <FileSpreadsheet className="w-4 h-4" />
                            Export ข้อมูลดิบ
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-gray-800">เลือกข้อมูลที่ต้องการ Export</h3>
                                <button
                                    onClick={() => setShowExportModal(false)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Select All / Deselect All */}
                            <div className="flex gap-2 mb-4">
                                <button
                                    onClick={() => selectAllExportOptions(true)}
                                    className="flex-1 py-2 px-3 bg-green-50 text-primary rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
                                >
                                    เลือกทั้งหมด
                                </button>
                                <button
                                    onClick={() => selectAllExportOptions(false)}
                                    className="flex-1 py-2 px-3 bg-gray-50 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                                >
                                    ยกเลิกทั้งหมด
                                </button>
                            </div>

                            {/* Export Options */}
                            <div className="space-y-3">
                                <button
                                    onClick={() => toggleExportOption('summary')}
                                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                                >
                                    {exportOptions.summary ? (
                                        <CheckSquare className="w-5 h-5 text-primary" />
                                    ) : (
                                        <Square className="w-5 h-5 text-gray-400" />
                                    )}
                                    <div>
                                        <p className="font-medium text-gray-800">📊 สรุปภาพรวม</p>
                                        <p className="text-xs text-gray-500">จำนวนพนักงาน, เข้างานเฉลี่ย, สถิติสาย/ลา</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => toggleExportOption('attendance')}
                                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                                >
                                    {exportOptions.attendance ? (
                                        <CheckSquare className="w-5 h-5 text-primary" />
                                    ) : (
                                        <Square className="w-5 h-5 text-gray-400" />
                                    )}
                                    <div>
                                        <p className="font-medium text-gray-800">📅 ข้อมูลการเข้างานรายวัน</p>
                                        <p className="text-xs text-gray-500">ตรงเวลา, สาย, ขาด ของแต่ละวัน ({attendanceData.length} วัน)</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => toggleExportOption('lateList')}
                                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                                >
                                    {exportOptions.lateList ? (
                                        <CheckSquare className="w-5 h-5 text-primary" />
                                    ) : (
                                        <Square className="w-5 h-5 text-gray-400" />
                                    )}
                                    <div>
                                        <p className="font-medium text-gray-800">⏰ รายชื่อพนักงานมาสาย</p>
                                        <p className="text-xs text-gray-500">ชื่อ, วันที่, เวลา, นาทีที่สาย ({lateEmployees.length} รายการ)</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => toggleExportOption('leaveData')}
                                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                                >
                                    {exportOptions.leaveData ? (
                                        <CheckSquare className="w-5 h-5 text-primary" />
                                    ) : (
                                        <Square className="w-5 h-5 text-gray-400" />
                                    )}
                                    <div>
                                        <p className="font-medium text-gray-800">🏖️ สถิติการลา</p>
                                        <p className="text-xs text-gray-500">จำนวนการลาแยกตามประเภท ({leaveData.length} ประเภท)</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => toggleExportOption('otData')}
                                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                                >
                                    {exportOptions.otData ? (
                                        <CheckSquare className="w-5 h-5 text-primary" />
                                    ) : (
                                        <Square className="w-5 h-5 text-gray-400" />
                                    )}
                                    <div>
                                        <p className="font-medium text-gray-800">💼 ข้อมูลโอทีรายวัน</p>
                                        <p className="text-xs text-gray-500">ชั่วโมงโอทีของแต่ละวัน ({otData.length} วัน)</p>
                                    </div>
                                </button>
                            </div>

                            {/* Separator */}
                            <div className="border-t border-gray-200 my-4"></div>

                            {/* Raw Export Button */}
                            <button
                                onClick={() => {
                                    setShowExportModal(false);
                                    setShowRawExportModal(true);
                                }}
                                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-primary/20 bg-green-50 hover:bg-green-100 transition-colors text-left"
                            >
                                <FileSpreadsheet className="w-6 h-6 text-primary" />
                                <div className="flex-1">
                                    <p className="font-semibold text-gray-800"> Export ข้อมูลดิบแบบละเอียด</p>
                                    <p className="text-xs text-gray-500">ชื่อ, Status, วันที่, เข้า/ออก, สถานที่, พิกัด, หมายเหตุ (เลือกช่วงเวลาได้)</p>
                                </div>
                                <span className="px-2 py-1 bg-primary text-white text-xs font-medium rounded">เปิด</span>
                            </button>
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
                            <Button
                                onClick={() => setShowExportModal(false)}
                                variant="outline"
                                className="flex-1"
                            >
                                ยกเลิก
                            </Button>
                            <Button
                                onClick={handleExport}
                                disabled={!Object.values(exportOptions).some(v => v)}
                                className="flex-1 bg-primary hover:bg-primary-dark text-white gap-2"
                            >
                                <Download className="w-4 h-4" />
                                ดาวน์โหลด CSV
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Raw Export Modal */}
            {showRawExportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-50 rounded-xl">
                                        <FileSpreadsheet className="w-6 h-6 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800">Export ข้อมูลดิบ</h3>
                                        <p className="text-sm text-gray-500">เลือกช่วงเวลาที่ต้องการ</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowRawExportModal(false)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh]">
                            {/* Quick Date Selection */}
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-3 block">ช่วงเวลา</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {[
                                        { value: 'today', label: 'วันนี้' },
                                        { value: 'week', label: '7 วัน' },
                                        { value: 'month', label: 'เดือนนี้' },
                                        { value: 'year', label: 'ปีนี้' },
                                        { value: 'custom', label: 'กำหนดเอง' }
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => handleRawExportDateTypeChange(opt.value as typeof rawExportDateType)}
                                            className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${rawExportDateType === opt.value
                                                ? 'bg-primary text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Custom Date Range */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">ตั้งแต่วันที่</label>
                                    <Input
                                        type="date"
                                        value={rawExportStartDate}
                                        onChange={(e) => {
                                            setRawExportStartDate(e.target.value);
                                            setRawExportDateType('custom');
                                        }}
                                        className="w-full"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">ถึงวันที่</label>
                                    <Input
                                        type="date"
                                        value={rawExportEndDate}
                                        onChange={(e) => {
                                            setRawExportEndDate(e.target.value);
                                            setRawExportDateType('custom');
                                        }}
                                        className="w-full"
                                    />
                                </div>
                            </div>

                            {/* Data Preview */}
                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">ข้อมูลที่พบ:</span>
                                    {rawExportLoading ? (
                                        <span className="text-sm text-gray-500 animate-pulse">กำลังโหลด...</span>
                                    ) : (
                                        <span className="text-lg font-bold text-green-600">{rawExportData.length} รายการ</span>
                                    )}
                                </div>
                            </div>

                            {/* Column Selection */}
                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-sm font-medium text-blue-800"> เลือก Column ที่ต้องการ Export:</p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => selectAllRawColumns(true)}
                                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                                        >
                                            เลือกทั้งหมด
                                        </button>
                                        <button
                                            onClick={() => selectAllRawColumns(false)}
                                            className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                        >
                                            ยกเลิกทั้งหมด
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { key: 'employeeId', label: 'รหัสพนักงาน' },
                                        { key: 'employeeName', label: 'ชื่อพนักงาน' },
                                        { key: 'status', label: 'สถานะ' },
                                        { key: 'date', label: 'วันที่' },
                                        { key: 'checkIn', label: 'เวลาเข้างาน' },
                                        { key: 'checkOut', label: 'เวลาออกงาน' },
                                        { key: 'location', label: 'สถานที่' },
                                        { key: 'latitude', label: 'ละติจูด' },
                                        { key: 'longitude', label: 'ลองจิจูด' },
                                        { key: 'distance', label: 'ระยะห่าง' },
                                        { key: 'note', label: 'หมายเหตุ' }
                                    ].map(col => (
                                        <button
                                            key={col.key}
                                            onClick={() => toggleRawExportColumn(col.key as keyof typeof rawExportColumns)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${rawExportColumns[col.key as keyof typeof rawExportColumns]
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            {rawExportColumns[col.key as keyof typeof rawExportColumns] ? (
                                                <CheckSquare className="w-4 h-4" />
                                            ) : (
                                                <Square className="w-4 h-4" />
                                            )}
                                            {col.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-blue-600 mt-2">
                                    เลือกแล้ว {Object.values(rawExportColumns).filter(v => v).length} จาก 11 columns
                                </p>
                            </div>

                            {/* Time Clock Export Section */}
                            <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-orange-800">🕐 Export สำหรับเครื่องลงเวลา</p>
                                        <p className="text-xs text-orange-600">รูปแบบ: รหัส, วัน/เวลา (แยกแต่ละรายการเข้า/ออก)</p>
                                    </div>
                                    <Button
                                        onClick={handleTimeClockExport}
                                        disabled={rawExportLoading || rawExportData.length === 0}
                                        className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                                        size="sm"
                                    >
                                        <Clock className="w-4 h-4" />
                                        Export
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
                            <Button
                                onClick={() => setShowRawExportModal(false)}
                                variant="outline"
                                className="flex-1"
                            >
                                ยกเลิก
                            </Button>
                            <Button
                                onClick={handleRawExport}
                                disabled={rawExportLoading || rawExportData.length === 0 || !Object.values(rawExportColumns).some(v => v)}
                                className="flex-1  bg-green-600 hover:bg-green-700 text-white gap-2"
                            >
                                <Download className="w-4 h-4" />
                                {rawExportLoading ? 'กำลังโหลด...' : `ดาวน์โหลด (${rawExportData.length} รายการ)`}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

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
                                        <Bar dataKey="present" name="ตรงเวลา" fill="#7bd4abff" radius={[4, 4, 0, 0]} stackId="a" />
                                        <Bar dataKey="late" name="สาย" fill="#1c7a56ff" radius={[4, 4, 0, 0]} stackId="a" />
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
