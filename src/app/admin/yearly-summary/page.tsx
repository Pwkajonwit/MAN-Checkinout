"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
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
import { Download, RefreshCw } from "lucide-react";
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
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [summaryItems, setSummaryItems] = useState<YearlySummaryItem[]>([]);

    const departments = useMemo(() => {
        return Array.from(new Set(employees.map(employee => employee.department).filter(Boolean))) as string[];
    }, [employees]);

    const totals = useMemo(() => {
        return summaryItems.reduce((acc, item) => ({
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
    }, [summaryItems]);

    const loadData = async () => {
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
            alert("โหลดสรุปรายปีไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            loadData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

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

        const rows = summaryItems.map(item => [
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

    if (!user) {
        return <div className="py-12 text-center text-gray-500">กรุณาเข้าสู่ระบบ</div>;
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="สรุปรายปี"
                subtitle="รวมข้อมูลการลงเวลา การลา OT เงินเดือน และผ่อนสินค้าแบบคำนวณสด"
            />

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 md:grid-cols-[180px_1fr_auto_auto] md:items-end">
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">ปี</span>
                        <input
                            type="number"
                            min="2020"
                            max="2100"
                            value={selectedYear}
                            onChange={(event) => setSelectedYear(Number(event.target.value) || currentYear)}
                            className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">แผนก</span>
                        <select
                            value={selectedDepartment}
                            onChange={(event) => setSelectedDepartment(event.target.value)}
                            className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        >
                            <option value="all">ทุกแผนก</option>
                            {departments.map(department => (
                                <option key={department} value={department}>{department}</option>
                            ))}
                        </select>
                    </label>
                    <button
                        type="button"
                        onClick={loadData}
                        disabled={loading}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        โหลดข้อมูล
                    </button>
                    <button
                        type="button"
                        onClick={exportCsv}
                        disabled={summaryItems.length === 0}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        <Download className="h-4 w-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="text-xs font-medium text-gray-500">พนักงานในรายงาน</div>
                    <div className="mt-2 text-xl font-bold text-gray-900">{summaryItems.length} คน</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="text-xs font-medium text-gray-500">OT รวม</div>
                    <div className="mt-2 text-xl font-bold text-blue-700">{decimal(totals.otHours)} ชม.</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="text-xs font-medium text-gray-500">เงินเดือนสุทธิรวม</div>
                    <div className="mt-2 text-xl font-bold text-emerald-700">฿{money(totals.netPay)}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="text-xs font-medium text-gray-500">ผ่อนสินค้าคงเหลือ</div>
                    <div className="mt-2 text-xl font-bold text-amber-700">฿{money(totals.installmentRemaining)}</div>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1180px]">
                        <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                            <tr>
                                <th className="px-4 py-3 text-left">พนักงาน</th>
                                <th className="px-4 py-3 text-left">แผนก</th>
                                <th className="px-4 py-3 text-right">วันทำงาน</th>
                                <th className="px-4 py-3 text-right">ลา</th>
                                <th className="px-4 py-3 text-right">สาย</th>
                                <th className="px-4 py-3 text-right">OT</th>
                                <th className="px-4 py-3 text-right">รายได้รวม</th>
                                <th className="px-4 py-3 text-right">หักรวม</th>
                                <th className="px-4 py-3 text-right">สุทธิ</th>
                                <th className="px-4 py-3 text-right">ผ่อนหักแล้ว</th>
                                <th className="px-4 py-3 text-right">ผ่อนคงเหลือ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={11} className="px-4 py-12 text-center text-sm text-gray-500">กำลังโหลดข้อมูล...</td>
                                </tr>
                            ) : summaryItems.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="px-4 py-12 text-center text-sm text-gray-400">ไม่มีข้อมูลสำหรับปีนี้</td>
                                </tr>
                            ) : summaryItems.map(item => (
                                <tr key={item.employeeKey} className="hover:bg-gray-50">
                                    <td className="px-4 py-4">
                                        <div className="font-medium text-gray-900">{item.employeeName}</div>
                                        <div className="text-xs text-gray-400">{item.employeeCode}</div>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-600">{item.department}</td>
                                    <td className="px-4 py-4 text-right font-mono text-sm">{item.workDays}</td>
                                    <td className="px-4 py-4 text-right font-mono text-sm">{decimal(item.leaveDays)}</td>
                                    <td className="px-4 py-4 text-right text-sm">
                                        <div className="font-mono">{item.lateCount} ครั้ง</div>
                                        <div className="text-xs text-red-500">{item.lateMinutes} นาที</div>
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono text-sm">{decimal(item.otHours)}</td>
                                    <td className="px-4 py-4 text-right font-mono text-sm">฿{money(item.grossIncome)}</td>
                                    <td className="px-4 py-4 text-right font-mono text-sm text-red-600">฿{money(item.totalDeduction)}</td>
                                    <td className="px-4 py-4 text-right font-mono text-sm font-semibold text-emerald-700">฿{money(item.netPay)}</td>
                                    <td className="px-4 py-4 text-right font-mono text-sm">฿{money(item.installmentPaid)}</td>
                                    <td className="px-4 py-4 text-right font-mono text-sm text-amber-700">฿{money(item.installmentRemaining)}</td>
                                </tr>
                            ))}
                        </tbody>
                        {summaryItems.length > 0 && (
                            <tfoot className="border-t border-gray-200 bg-gray-50 text-sm font-semibold text-gray-900">
                                <tr>
                                    <td className="px-4 py-3" colSpan={2}>รวม</td>
                                    <td className="px-4 py-3 text-right font-mono">{totals.workDays}</td>
                                    <td className="px-4 py-3 text-right font-mono">{decimal(totals.leaveDays)}</td>
                                    <td className="px-4 py-3 text-right font-mono">{totals.lateCount} ครั้ง / {totals.lateMinutes} นาที</td>
                                    <td className="px-4 py-3 text-right font-mono">{decimal(totals.otHours)}</td>
                                    <td className="px-4 py-3 text-right font-mono">฿{money(totals.grossIncome)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-red-600">฿{money(totals.totalDeduction)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-emerald-700">฿{money(totals.netPay)}</td>
                                    <td className="px-4 py-3 text-right font-mono">฿{money(totals.installmentPaid)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-amber-700">฿{money(totals.installmentRemaining)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}
