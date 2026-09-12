"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAdmin } from "@/components/auth/AuthProvider";
import {
    attendanceService,
    employeeService,
    installmentService,
    leaveService,
    otService,
    payrollService,
    type Employee,
} from "@/lib/firestore";
import {
    Download,
    RefreshCw,
    Search,
    ChevronLeft,
    ChevronRight,
    Users,
    Clock,
    Wallet,
    CreditCard
} from "lucide-react";
import { differenceInMinutes, endOfYear, format, startOfYear } from "date-fns";
import { getLeaveDayUnits } from "@/lib/leaveUtils";

type PayrollSnapshotItem = {
    employeeDocId?: string;
    employeeId?: string;
    name?: string;
    totalIncome?: number;
    totalDeduction?: number;
    netTotal?: number;
    payrollBaseIncome?: number;
};

type YearlySummaryItem = {
    employeeKey: string;
    employeeCode: string;
    employeeName: string;
    department: string;
    workDays: number;
    leaveDays: number;
    lateCount: number;
    lateMinutes: number;
    otHours: number;
    grossIncome: number;
    totalDeduction: number;
    netPay: number;
    installmentPaid: number;
    installmentRemaining: number;
};

const money = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 0 });
const decimal = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });
const toNumber = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

const escapeCsvValue = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
};

const getYearFromDate = (date?: Date) => date instanceof Date ? date.getFullYear() : null;

const getEmployeeKeys = (employee: Employee) =>
    [employee.id, employee.employeeId].filter(Boolean) as string[];

const getPayrollItemKey = (item: PayrollSnapshotItem) =>
    item.employeeDocId || item.employeeId || item.name || "";

export default function YearlySummaryPage() {
    const { user } = useAdmin();
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedDepartment, setSelectedDepartment] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [summaryItems, setSummaryItems] = useState<YearlySummaryItem[]>([]);

    const departments = useMemo(() => {
        return Array.from(new Set(employees.map(employee => employee.department).filter(Boolean))) as string[];
    }, [employees]);

    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return summaryItems;
        const q = searchQuery.toLowerCase();
        return summaryItems.filter(item =>
            item.employeeName.toLowerCase().includes(q) ||
            item.employeeCode.toLowerCase().includes(q) ||
            item.department.toLowerCase().includes(q)
        );
    }, [summaryItems, searchQuery]);

    const totals = useMemo(() => {
        return filteredItems.reduce((acc, item) => ({
            workDays: acc.workDays + item.workDays,
            leaveDays: acc.leaveDays + item.leaveDays,
            lateCount: acc.lateCount + item.lateCount,
            lateMinutes: acc.lateMinutes + item.lateMinutes,
            otHours: acc.otHours + item.otHours,
            grossIncome: acc.grossIncome + item.grossIncome,
            totalDeduction: acc.totalDeduction + item.totalDeduction,
            netPay: acc.netPay + item.netPay,
            installmentPaid: acc.installmentPaid + item.installmentPaid,
            installmentRemaining: acc.installmentRemaining + item.installmentRemaining,
        }), {
            workDays: 0,
            leaveDays: 0,
            lateCount: 0,
            lateMinutes: 0,
            otHours: 0,
            grossIncome: 0,
            totalDeduction: 0,
            netPay: 0,
            installmentPaid: 0,
            installmentRemaining: 0,
        });
    }, [filteredItems]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const startDate = startOfYear(new Date(selectedYear, 0, 1));
            const endDate = endOfYear(new Date(selectedYear, 0, 1));

            const [
                employeeData,
                attendanceData,
                leaveData,
                otData,
                payrollRuns,
                installmentPlans,
                installmentPayments,
            ] = await Promise.all([
                employeeService.getAll(),
                attendanceService.getByDateRange(startDate, endDate),
                leaveService.getByDateRange(startDate, endDate),
                otService.getByDateRange(startDate, endDate),
                payrollService.getAll(),
                installmentService.getAll(),
                installmentService.getAllPayments(),
            ]);

            const targetEmployees = employeeData.filter(employee =>
                selectedDepartment === "all" || employee.department === selectedDepartment
            );
            setEmployees(employeeData);

            const rows = targetEmployees.map(employee => {
                const keys = getEmployeeKeys(employee);
                const matchesEmployee = (employeeId?: string) => Boolean(employeeId && keys.includes(employeeId));

                const employeeAttendances = attendanceData.filter(attendance => matchesEmployee(attendance.employeeId));
                const workDateKeys = new Set(
                    employeeAttendances
                        .filter(attendance => ["เข้างาน", "สาย", "ออกนอกพื้นที่", "หลังพัก"].includes(attendance.status))
                        .map(attendance => format(attendance.date, "yyyy-MM-dd"))
                );
                const lateRecords = employeeAttendances.filter(attendance => attendance.status === "สาย" || toNumber(attendance.lateMinutes) > 0);
                const lateMinutes = lateRecords.reduce((sum, attendance) => sum + toNumber(attendance.lateMinutes), 0);

                const approvedLeaves = leaveData.filter(leave => matchesEmployee(leave.employeeId) && leave.status === "อนุมัติ");
                const leaveDays = approvedLeaves.reduce((sum, leave) => sum + getLeaveDayUnits(leave), 0);

                const approvedOT = otData.filter(ot => matchesEmployee(ot.employeeId) && ot.status === "อนุมัติ");
                const otHours = approvedOT.reduce((sum, ot) => {
                    if (!ot.startTime || !ot.endTime) return sum;
                    return sum + Math.max(0, differenceInMinutes(ot.endTime, ot.startTime) / 60);
                }, 0);

                const payrollTotals = payrollRuns
                    .filter(run => getYearFromDate(run.startDate) === selectedYear || getYearFromDate(run.endDate) === selectedYear)
                    .flatMap(run => (Array.isArray(run.items) ? run.items : []) as PayrollSnapshotItem[])
                    .filter(item => {
                        const key = getPayrollItemKey(item);
                        return key && (keys.includes(key) || item.name === employee.name);
                    })
                    .reduce<{ grossIncome: number; totalDeduction: number; netPay: number }>((acc, item) => ({
                        grossIncome: acc.grossIncome + toNumber(item.totalIncome ?? item.payrollBaseIncome),
                        totalDeduction: acc.totalDeduction + toNumber(item.totalDeduction),
                        netPay: acc.netPay + toNumber(item.netTotal),
                    }), { grossIncome: 0, totalDeduction: 0, netPay: 0 });

                const employeeInstallmentPayments = installmentPayments
                    .filter(payment => matchesEmployee(payment.employeeId))
                    .filter(payment => payment.status === "deducted")
                    .filter(payment => payment.periodMonth?.startsWith(String(selectedYear)) || getYearFromDate(payment.paidAt) === selectedYear);
                const installmentPaid = employeeInstallmentPayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
                const installmentRemaining = installmentPlans
                    .filter(plan => matchesEmployee(plan.employeeId) || Boolean(plan.employeeCode && keys.includes(plan.employeeCode)))
                    .filter(plan => plan.status === "active" || plan.status === "paused")
                    .reduce((sum, plan) => sum + toNumber(plan.remainingAmount), 0);

                return {
                    employeeKey: employee.id || employee.employeeId || employee.name,
                    employeeCode: employee.employeeId || employee.id || "-",
                    employeeName: employee.name,
                    department: employee.department || "-",
                    workDays: workDateKeys.size,
                    leaveDays,
                    lateCount: lateRecords.length,
                    lateMinutes,
                    otHours,
                    grossIncome: payrollTotals.grossIncome,
                    totalDeduction: payrollTotals.totalDeduction,
                    netPay: payrollTotals.netPay,
                    installmentPaid,
                    installmentRemaining,
                };
            });

            setSummaryItems(rows);
        } catch (error) {
            console.error("Error loading yearly summary:", error);
        } finally {
            setLoading(false);
        }
    }, [selectedYear, selectedDepartment]);

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user, loadData]);

    const exportCsv = () => {
        const headers = [
            "ปี",
            "รหัสพนักงาน",
            "พนักงาน",
            "แผนก",
            "วันทำงาน",
            "วันลา",
            "สาย (ครั้ง)",
            "สายนาที",
            "OT ชั่วโมง",
            "รายได้รวม",
            "หักรวม",
            "สุทธิ",
            "ผ่อนสินค้าหักแล้ว",
            "ผ่อนสินค้าคงเหลือ",
        ];

        const rows = filteredItems.map(item => [
            selectedYear,
            item.employeeCode,
            item.employeeName,
            item.department,
            item.workDays,
            item.leaveDays.toFixed(2),
            item.lateCount,
            item.lateMinutes,
            item.otHours.toFixed(2),
            item.grossIncome,
            item.totalDeduction,
            item.netPay,
            item.installmentPaid,
            item.installmentRemaining,
        ]);

        rows.push([
            selectedYear,
            "",
            "รวม",
            "",
            totals.workDays,
            totals.leaveDays.toFixed(2),
            totals.lateCount,
            totals.lateMinutes,
            totals.otHours.toFixed(2),
            totals.grossIncome,
            totals.totalDeduction,
            totals.netPay,
            totals.installmentPaid,
            totals.installmentRemaining,
        ]);

        const csvContent = "\uFEFF" + [
            headers.map(escapeCsvValue).join(","),
            ...rows.map(row => row.map(value => escapeCsvValue(value)).join(",")),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `yearly_summary_${selectedYear}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const isCurrentYear = selectedYear === currentYear;

    if (!user) {
        return (
            <div className="py-12 text-center text-slate-700 font-normal">
                กรุณาเข้าสู่ระบบ
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                            สรุปภาพรวมรายปี
                        </h1>
                        <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            Yearly Summary
                        </span>
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 tabular-nums">
                            ประจำปี {selectedYear} ({selectedYear + 543})
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm font-normal text-slate-500 mt-1">
                        รวมข้อมูลการลงเวลา การลา OT เงินเดือน และผ่อนสินค้าแบบสรุปรายปี
                    </p>
                </div>
            </div>

            {/* Compact Stat Cards (mini-Compact Layout & High Contrast) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* พนักงาน */}
                <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">พนักงานในรายงาน</span>
                        <span className="p-1 rounded-md bg-slate-100 text-slate-600">
                            <Users className="w-3.5 h-3.5" />
                        </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                        {filteredItems.length} <span className="text-xs font-normal text-slate-500">คน</span>
                    </div>
                    <div className="text-[11px] font-normal text-slate-500 mt-0.5 tabular-nums truncate">
                        วันทำงานรวม {totals.workDays.toLocaleString()} วัน
                    </div>
                </div>

                {/* OT รวม */}
                <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">OT รวมทั้งปี</span>
                        <span className="p-1 rounded-md bg-blue-50 text-blue-700">
                            <Clock className="w-3.5 h-3.5" />
                        </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-blue-700 mt-1 tabular-nums">
                        {decimal(totals.otHours)} <span className="text-xs font-normal text-slate-500">ชม.</span>
                    </div>
                    <div className="text-[11px] font-normal text-slate-500 mt-0.5 tabular-nums truncate">
                        สาย {totals.lateCount} ครั้ง ({totals.lateMinutes.toLocaleString()} น.)
                    </div>
                </div>

                {/* เงินเดือนสุทธิรวม */}
                <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">เงินเดือนสุทธิรวม</span>
                        <span className="p-1 rounded-md bg-emerald-50 text-emerald-700">
                            <Wallet className="w-3.5 h-3.5" />
                        </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1 tabular-nums truncate">
                        ฿{money(totals.netPay)}
                    </div>
                    <div className="text-[11px] font-normal text-slate-500 mt-0.5 tabular-nums truncate">
                        รายได้ ฿{money(totals.grossIncome)}
                    </div>
                </div>

                {/* ผ่อนสินค้าคงเหลือ */}
                <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">ผ่อนสินค้าคงเหลือ</span>
                        <span className="p-1 rounded-md bg-amber-50 text-amber-700">
                            <CreditCard className="w-3.5 h-3.5" />
                        </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-amber-700 mt-1 tabular-nums truncate">
                        ฿{money(totals.installmentRemaining)}
                    </div>
                    <div className="text-[11px] font-normal text-slate-500 mt-0.5 tabular-nums truncate">
                        หักชำระแล้ว ฿{money(totals.installmentPaid)}
                    </div>
                </div>
            </div>

            {/* Compact Toolbar (Year Navigation, Dept, Search & Actions h-9) */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-2.5 sm:p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Year Navigator (h-9) */}
                    <div className="inline-flex items-center h-9 bg-slate-50 rounded-lg border border-slate-200 px-1">
                        <button
                            type="button"
                            onClick={() => setSelectedYear(y => y - 1)}
                            title="ปีก่อนหน้า"
                            className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="px-2.5 text-xs sm:text-sm font-bold text-slate-800 tabular-nums select-none">
                            {selectedYear} ({selectedYear + 543})
                        </span>
                        <button
                            type="button"
                            onClick={() => setSelectedYear(y => y + 1)}
                            title="ปีถัดไป"
                            className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-all"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {!isCurrentYear && (
                        <button
                            type="button"
                            onClick={() => setSelectedYear(currentYear)}
                            className="h-9 px-2.5 text-xs font-medium text-blue-700 bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200 rounded-lg transition-colors"
                        >
                            ปีปัจจุบัน
                        </button>
                    )}

                    {/* Department Select (h-9) */}
                    <select
                        value={selectedDepartment}
                        onChange={(e) => setSelectedDepartment(e.target.value)}
                        className="h-9 px-2.5 text-xs sm:text-sm font-normal text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
                    >
                        <option value="all">ทุกแผนก ({departments.length})</option>
                        {departments.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-wrap items-center gap-2 ml-auto">
                    {/* Search Input (h-9) */}
                    <div className="relative w-full sm:w-56">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อ, รหัส, แผนก..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-9 pl-9 pr-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-2xs"
                        />
                    </div>

                    {/* Reload Button (h-9) */}
                    <button
                        type="button"
                        onClick={loadData}
                        disabled={loading}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                        <span>รีเฟรช</span>
                    </button>

                    {/* Export CSV Button (h-9) */}
                    <button
                        type="button"
                        onClick={exportCsv}
                        disabled={filteredItems.length === 0}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
                    >
                        <Download className="w-3.5 h-3.5 text-slate-600" />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            {/* Table Container */}
            <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xs">
                {/* Table Header Bar */}
                <div className="px-4 py-2 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                        ตารางสรุปรายปี พ.ศ. {selectedYear + 543}
                    </span>
                    <span className="text-slate-500 font-normal">
                        พบ <span className="font-semibold text-slate-800 tabular-nums">{filteredItems.length}</span> คน
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1120px] text-left border-collapse">
                        <thead className="bg-slate-50 text-slate-800 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider">
                            <tr>
                                <th className="px-3.5 py-2.5">พนักงาน</th>
                                <th className="px-3 py-2.5">แผนก</th>
                                <th className="px-3 py-2.5 text-right">วันทำงาน</th>
                                <th className="px-3 py-2.5 text-right">ลา (วัน)</th>
                                <th className="px-3 py-2.5 text-right">สาย</th>
                                <th className="px-3 py-2.5 text-right">OT (ชม.)</th>
                                <th className="px-3 py-2.5 text-right">รายได้รวม</th>
                                <th className="px-3 py-2.5 text-right">หักรวม</th>
                                <th className="px-3 py-2.5 text-right">สุทธิ</th>
                                <th className="px-3 py-2.5 text-right">ผ่อนหักแล้ว</th>
                                <th className="px-3 py-2.5 text-right">ผ่อนคงเหลือ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                                            <span className="text-xs sm:text-sm font-normal">กำลังโหลดและคำนวณข้อมูลสรุปรายปี...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                                        <span className="text-xs sm:text-sm font-normal">ไม่พบข้อมูลพนักงานสำหรับปีนี้</span>
                                    </td>
                                </tr>
                            ) : filteredItems.map((item) => (
                                <tr key={item.employeeKey} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-3.5 py-2">
                                        <div className="font-semibold text-slate-900 text-xs sm:text-sm">{item.employeeName}</div>
                                        <div className="text-[11px] font-normal text-slate-500 tabular-nums">{item.employeeCode}</div>
                                    </td>
                                    <td className="px-3 py-2 text-xs sm:text-sm font-normal text-slate-700">
                                        {item.department}
                                    </td>
                                    <td className="px-3 py-2 text-right text-xs sm:text-sm font-semibold text-slate-900 tabular-nums">
                                        {item.workDays}
                                    </td>
                                    <td className="px-3 py-2 text-right text-xs sm:text-sm font-normal text-slate-700 tabular-nums">
                                        {decimal(item.leaveDays)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-xs sm:text-sm">
                                        <div className="font-normal text-slate-800 tabular-nums">{item.lateCount} ครั้ง</div>
                                        {item.lateMinutes > 0 && (
                                            <div className="text-[11px] font-normal text-rose-600 tabular-nums">({item.lateMinutes} น.)</div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-right text-xs sm:text-sm font-semibold text-blue-700 tabular-nums">
                                        {decimal(item.otHours)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-xs sm:text-sm font-normal text-slate-800 tabular-nums">
                                        ฿{money(item.grossIncome)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-xs sm:text-sm font-normal text-rose-600 tabular-nums">
                                        ฿{money(item.totalDeduction)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-xs sm:text-sm font-bold text-emerald-700 tabular-nums">
                                        ฿{money(item.netPay)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-xs sm:text-sm font-normal text-slate-700 tabular-nums">
                                        ฿{money(item.installmentPaid)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-xs sm:text-sm font-semibold text-amber-700 tabular-nums">
                                        ฿{money(item.installmentRemaining)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {filteredItems.length > 0 && (
                            <tfoot className="border-t-2 border-slate-300 bg-slate-50/90 text-xs sm:text-sm font-bold text-slate-900">
                                <tr>
                                    <td className="px-3.5 py-2.5 font-bold" colSpan={2}>
                                        รวมทั้งหมด ({filteredItems.length} คน)
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{totals.workDays}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{decimal(totals.leaveDays)}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-xs">
                                        {totals.lateCount} ครั้ง <span className="text-rose-600">({totals.lateMinutes} น.)</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-blue-700">{decimal(totals.otHours)}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">฿{money(totals.grossIncome)}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-rose-600">฿{money(totals.totalDeduction)}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">฿{money(totals.netPay)}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">฿{money(totals.installmentPaid)}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">฿{money(totals.installmentRemaining)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}
