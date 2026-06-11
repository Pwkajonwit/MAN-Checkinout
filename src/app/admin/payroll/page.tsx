"use client";

import { useState, useEffect } from "react";
import { employeeService, attendanceService, otService, swapService, leaveService, systemConfigService, payrollService, type Employee, type Attendance, type OTRequest, type SwapRequest, type LeaveRequest, type SystemConfig, type SavedPayrollRecord } from "@/lib/firestore";
import { Calendar, DollarSign, Download, Filter, History, Plus, Save, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { getLateMinutes } from "@/lib/workTime";
import { formatLeaveDayHourUnits, getLeaveDayUnits } from "@/lib/leaveUtils";

interface PayrollItem {
    employeeId: string;
    name: string;
    type: string;
    baseSalary: number;
    workDays: number;
    leaveDays: number;
    lateMinutes: number;
    otHours: number;
    otHoursNormal: number;
    otHoursHoliday: number;
    otHoursSpecial: number;
    otPayNormal: number;
    otPayHoliday: number;
    otPaySpecial: number;
    customHolidayWorkHours: number; // Hours worked on custom holidays (workday pay)
    customHolidayWorkPay: number;   // Pay for working on custom holidays
    payrollBaseIncome: number;      // Auto-calculated income before manual extras
    attendanceAllowance: number;    // เบี้ยขยัน
    specialAllowance: number;       // เงินพิเศษ
    bonus: number;                  // โบนัส
    manualIncomes: ManualIncome[];
    payrollBaseDeduction: number;   // Auto-calculated deductions before manual deductions
    manualDeductions: ManualDeduction[];
    totalIncome: number;
    totalDeduction: number;
    netTotal: number;
}

interface ManualIncome {
    id: string;
    label: string;
    amount: number;
}

interface ManualDeduction {
    id: string;
    label: string;
    amount: number;
}

type ManualIncomeField = "label" | "amount";
type ManualDeductionField = "label" | "amount";

const toNumber = (value: number | undefined) => Number.isFinite(value) ? Number(value) : 0;
const hasValidNumber = (value: number | undefined) => Number.isFinite(value);

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

const escapeCsvValue = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
};

const getPayrollLeaveDays = (leaves: LeaveRequest[], attendedDateKeys: Set<string>) => {
    return leaves.reduce((sum, leave) => {
        const start = leave.startDate instanceof Date ? leave.startDate : new Date(leave.startDate);

        if (leave.durationUnit === "hour") {
            return attendedDateKeys.has(format(start, "yyyy-MM-dd"))
                ? sum
                : sum + getLeaveDayUnits(leave);
        }

        const end = leave.endDate instanceof Date ? leave.endDate : new Date(leave.endDate);
        let leaveDays = 0;
        const cursor = new Date(start);
        cursor.setHours(0, 0, 0, 0);
        const last = new Date(end);
        last.setHours(0, 0, 0, 0);

        while (cursor <= last) {
            if (!attendedDateKeys.has(format(cursor, "yyyy-MM-dd"))) {
                leaveDays += 1;
            }
            cursor.setDate(cursor.getDate() + 1);
        }

        return sum + leaveDays;
    }, 0);
};

const normalizePayrollItem = (item: PayrollItem): PayrollItem => {
    const attendanceAllowance = toNumber(item.attendanceAllowance);
    const specialAllowance = toNumber(item.specialAllowance);
    const bonus = toNumber(item.bonus);
    const legacyExtraIncome = attendanceAllowance + specialAllowance + bonus;
    const hasManualIncomeState = Array.isArray(item.manualIncomes);
    const manualIncomes = hasManualIncomeState
        ? item.manualIncomes.map((income) => ({
            ...income,
            label: income.label || "",
            amount: toNumber(income.amount),
        }))
        : [];
    const manualIncomeTotal = manualIncomes.reduce((sum, income) => sum + toNumber(income.amount), 0);
    const extraIncome = hasManualIncomeState ? manualIncomeTotal : legacyExtraIncome;
    const payrollBaseIncome = hasValidNumber(item.payrollBaseIncome)
        ? toNumber(item.payrollBaseIncome)
        : Math.max(0, toNumber(item.totalIncome) - extraIncome);
    const manualDeductions = Array.isArray(item.manualDeductions)
        ? item.manualDeductions.map((deduction) => ({
            ...deduction,
            label: deduction.label || "",
            amount: toNumber(deduction.amount),
        }))
        : [];
    const manualDeductionTotal = manualDeductions.reduce((sum, deduction) => sum + toNumber(deduction.amount), 0);
    const payrollBaseDeduction = hasValidNumber(item.payrollBaseDeduction)
        ? toNumber(item.payrollBaseDeduction)
        : Math.max(0, toNumber(item.totalDeduction) - manualDeductionTotal);
    const totalDeduction = payrollBaseDeduction + manualDeductionTotal;
    const totalIncome = payrollBaseIncome + extraIncome;

    return {
        ...item,
        leaveDays: toNumber(item.leaveDays),
        payrollBaseIncome,
        attendanceAllowance,
        specialAllowance,
        bonus,
        manualIncomes,
        payrollBaseDeduction,
        manualDeductions,
        totalIncome,
        totalDeduction,
        netTotal: totalIncome - totalDeduction,
    };
};

export default function PayrollPage() {
    const [loading, setLoading] = useState(false);
    const [employeeType, setEmployeeType] = useState<"ประจำ - รายเดือน" | "ประจำ - รายวัน" | "ชั่วคราว">("ประจำ - รายเดือน");
    const [calculationPeriod, setCalculationPeriod] = useState<"month" | "custom">("month");
    const [selectedDate, setSelectedDate] = useState(new Date()); // For month selection
    const [customRange, setCustomRange] = useState({
        start: new Date(),
        end: new Date()
    });
    const [payrollData, setPayrollData] = useState<PayrollItem[]>([]);
    const [config, setConfig] = useState<SystemConfig | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
    const [savedPayrolls, setSavedPayrolls] = useState<SavedPayrollRecord[]>([]);
    const [selectedSavedPayrollId, setSelectedSavedPayrollId] = useState("");
    const [savingPayroll, setSavingPayroll] = useState(false);
    const [bulkEntry, setBulkEntry] = useState<{
        type: "income" | "deduction";
        label: string;
        amount: string;
        target: "all" | "selected";
    }>({
        type: "income",
        label: "",
        amount: "",
        target: "all",
    });

    useEffect(() => {
        const loadData = async () => {
            const sysConfig = await systemConfigService.get();
            setConfig(sysConfig);

            // Load departments
            const employees = await employeeService.getAll();
            const uniqueDepts = Array.from(new Set(employees.map(e => e.department).filter(Boolean))) as string[];
            setDepartments(uniqueDepts.sort());

            const savedRecords = await payrollService.getAll();
            setSavedPayrolls(savedRecords);
        };
        loadData();
    }, []);

    const getCurrentPeriodMeta = () => {
        if (calculationPeriod === "month") {
            const startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
            const endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
            return {
                startDate,
                endDate,
                periodLabel: `เดือน ${format(selectedDate, "MMMM yyyy", { locale: th })}`,
            };
        }

        const startDate = new Date(customRange.start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(customRange.end);
        endDate.setHours(23, 59, 59, 999);

        return {
            startDate,
            endDate,
            periodLabel: `ช่วงวันที่ ${format(startDate, "d MMM", { locale: th })} - ${format(endDate, "d MMM yyyy", { locale: th })}`,
        };
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(payrollData.map(item => item.employeeId));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(item => item !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const addManualIncome = (employeeId: string) => {
        setPayrollData(currentData => currentData.map(item => {
            if (item.employeeId !== employeeId) return item;

            return normalizePayrollItem({
                ...item,
                manualIncomes: [
                    ...(item.manualIncomes || []),
                    {
                        id: `${employeeId}-income-${Date.now()}`,
                        label: "",
                        amount: 0,
                    },
                ],
            });
        }));
    };

    const updateManualIncome = (
        employeeId: string,
        incomeId: string,
        field: ManualIncomeField,
        value: string
    ) => {
        setPayrollData(currentData => currentData.map(item => {
            if (item.employeeId !== employeeId) return item;

            const manualIncomes = (item.manualIncomes || []).map((income) => {
                if (income.id !== incomeId) return income;

                return {
                    ...income,
                    [field]: field === "amount" ? Math.max(0, Number(value) || 0) : value,
                };
            });

            return normalizePayrollItem({
                ...item,
                manualIncomes,
            });
        }));
    };

    const removeManualIncome = (employeeId: string, incomeId: string) => {
        setPayrollData(currentData => currentData.map(item => {
            if (item.employeeId !== employeeId) return item;

            return normalizePayrollItem({
                ...item,
                manualIncomes: (item.manualIncomes || []).filter((income) => income.id !== incomeId),
            });
        }));
    };

    const addManualDeduction = (employeeId: string) => {
        setPayrollData(currentData => currentData.map(item => {
            if (item.employeeId !== employeeId) return item;

            return normalizePayrollItem({
                ...item,
                manualDeductions: [
                    ...(item.manualDeductions || []),
                    {
                        id: `${employeeId}-${Date.now()}`,
                        label: "",
                        amount: 0,
                    },
                ],
            });
        }));
    };

    const updateManualDeduction = (
        employeeId: string,
        deductionId: string,
        field: ManualDeductionField,
        value: string
    ) => {
        setPayrollData(currentData => currentData.map(item => {
            if (item.employeeId !== employeeId) return item;

            const manualDeductions = (item.manualDeductions || []).map((deduction) => {
                if (deduction.id !== deductionId) return deduction;

                return {
                    ...deduction,
                    [field]: field === "amount" ? Math.max(0, Number(value) || 0) : value,
                };
            });

            return normalizePayrollItem({
                ...item,
                manualDeductions,
            });
        }));
    };

    const removeManualDeduction = (employeeId: string, deductionId: string) => {
        setPayrollData(currentData => currentData.map(item => {
            if (item.employeeId !== employeeId) return item;

            return normalizePayrollItem({
                ...item,
                manualDeductions: (item.manualDeductions || []).filter((deduction) => deduction.id !== deductionId),
            });
        }));
    };

    const applyBulkEntry = () => {
        const label = bulkEntry.label.trim();
        const amount = Math.max(0, Number(bulkEntry.amount) || 0);
        if (!label || amount <= 0) return;

        const targetIds = bulkEntry.target === "selected" ? selectedIds : payrollData.map(item => item.employeeId);
        if (targetIds.length === 0) return;

        const timestamp = Date.now();

        setPayrollData(currentData => currentData.map(item => {
            if (!targetIds.includes(item.employeeId)) return item;

            if (bulkEntry.type === "income") {
                return normalizePayrollItem({
                    ...item,
                    manualIncomes: [
                        ...(item.manualIncomes || []),
                        {
                            id: `${item.employeeId}-bulk-income-${timestamp}`,
                            label,
                            amount,
                        },
                    ],
                });
            }

            return normalizePayrollItem({
                ...item,
                manualDeductions: [
                    ...(item.manualDeductions || []),
                    {
                        id: `${item.employeeId}-bulk-deduction-${timestamp}`,
                        label,
                        amount,
                    },
                ],
            });
        }));

        setBulkEntry(current => ({
            ...current,
            label: "",
            amount: "",
        }));
    };

    const handleSavePayroll = async () => {
        const normalizedPayroll = payrollData.map(normalizePayrollItem);
        if (normalizedPayroll.length === 0) return;

        setSavingPayroll(true);
        try {
            const { startDate, endDate, periodLabel } = getCurrentPeriodMeta();
            const totals = {
                baseIncome: normalizedPayroll.reduce((sum, item) => sum + toNumber(item.payrollBaseIncome), 0),
                extraIncome: normalizedPayroll.reduce((sum, item) => {
                    const manualIncomeTotal = (item.manualIncomes || []).reduce((incomeSum, income) => incomeSum + toNumber(income.amount), 0);
                    const legacyIncomeTotal = toNumber(item.attendanceAllowance) + toNumber(item.specialAllowance) + toNumber(item.bonus);
                    return sum + (Array.isArray(item.manualIncomes) ? manualIncomeTotal : legacyIncomeTotal);
                }, 0),
                deduction: normalizedPayroll.reduce((sum, item) => sum + toNumber(item.totalDeduction), 0),
                net: normalizedPayroll.reduce((sum, item) => sum + toNumber(item.netTotal), 0),
            };

            await payrollService.create({
                periodType: calculationPeriod,
                periodLabel,
                startDate,
                endDate,
                employeeType,
                selectedDepartment,
                totals,
                items: normalizedPayroll,
                createdAt: new Date(),
            });

            const savedRecords = await payrollService.getAll();
            setSavedPayrolls(savedRecords);
            alert(`บันทึกเงินเดือน${periodLabel}แล้ว`);
        } catch (error) {
            console.error("Error saving payroll:", error);
            alert("บันทึกเงินเดือนไม่สำเร็จ");
        } finally {
            setSavingPayroll(false);
        }
    };

    const handleLoadSavedPayroll = () => {
        const selectedRecord = savedPayrolls.find(record => record.id === selectedSavedPayrollId);
        if (!selectedRecord) return;

        const restoredItems = (selectedRecord.items as PayrollItem[]).map(normalizePayrollItem);
        setPayrollData(restoredItems);
        setSelectedIds(restoredItems.map(item => item.employeeId));
        setEmployeeType(selectedRecord.employeeType as "ประจำ - รายเดือน" | "ประจำ - รายวัน" | "ชั่วคราว");
        setSelectedDepartment(selectedRecord.selectedDepartment || "all");
        setCalculationPeriod(selectedRecord.periodType);
        setCustomRange({
            start: selectedRecord.startDate,
            end: selectedRecord.endDate,
        });
        if (selectedRecord.periodType === "month") {
            setSelectedDate(selectedRecord.startDate);
        }
    };

    const handleDeleteSavedPayroll = async () => {
        const selectedRecord = savedPayrolls.find(record => record.id === selectedSavedPayrollId);
        if (!selectedRecord?.id) return;

        const confirmed = window.confirm(`ต้องการลบประวัติเงินเดือน "${selectedRecord.periodLabel}" ใช่ไหม?`);
        if (!confirmed) return;

        try {
            await payrollService.delete(selectedRecord.id);
            const savedRecords = await payrollService.getAll();
            setSavedPayrolls(savedRecords);
            setSelectedSavedPayrollId("");
        } catch (error) {
            console.error("Error deleting saved payroll:", error);
            alert("ลบประวัติเงินเดือนไม่สำเร็จ");
        }
    };

    const handlePrint = () => {
        const selectedData = payrollData
            .filter(item => selectedIds.includes(item.employeeId))
            .map(normalizePayrollItem);
        if (selectedData.length === 0) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        let periodText = "";
        if (calculationPeriod === "month") {
            periodText = `ประจำเดือน ${format(selectedDate, "MMMM yyyy", { locale: th })}`;
        } else {
            periodText = `ช่วงวันที่ ${format(customRange.start, "d MMM", { locale: th })} - ${format(customRange.end, "d MMM yyyy", { locale: th })}`;
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="th">
            <head>
                <meta charset="UTF-8">
                <title>Payslips - ${periodText}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
                    body {
                        font-family: 'Sarabun', sans-serif;
                        margin: 0;
                        padding: 20px;
                        background: #f5f5f5;
                        font-size: 12px;
                    }
                    .page {
                        background: white;
                        width: 210mm;
                        min-height: 297mm;
                        padding: 20mm;
                        margin: 0 auto 20px;
                        box-shadow: 0 0 10px rgba(0,0,0,0.1);
                        box-sizing: border-box;
                        position: relative;
                    }
                    @media print {
                        body {
                            background: white;
                            padding: 0;
                        }
                        .page {
                            box-shadow: none;
                            margin: 0;
                            page-break-after: always;
                        }
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 24px;
                        color: #333;
                    }
                    .header p {
                        margin: 5px 0 0;
                        color: #666;
                    }
                    .info-box {
                        border: 1px solid #ddd;
                        padding: 15px;
                        margin-bottom: 20px;
                        border-radius: 4px;
                    }
                    .row {
                        display: flex;
                        margin-bottom: 8px;
                    }
                    .col {
                        flex: 1;
                    }
                    .label {
                        font-weight: bold;
                        color: #555;
                        width: 100px;
                        display: inline-block;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    th, td {
                        padding: 10px;
                        border-bottom: 1px solid #eee;
                    }
                    th {
                        background-color: #f8f9fa;
                        text-align: left;
                        font-weight: bold;
                        color: #333;
                    }
                    .amount {
                        text-align: right;
                    }
                    .total-row {
                        font-weight: bold;
                        background-color: #f8f9fa;
                    }
                    .net-pay {
                        background-color: #e3f2fd;
                        padding: 15px;
                        border-radius: 4px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        font-size: 18px;
                        font-weight: bold;
                        color: #1565c0;
                    }
                    .signature {
                        margin-top: 50px;
                        display: flex;
                        justify-content: space-between;
                    }
                    .sign-box {
                        text-align: center;
                        width: 200px;
                    }
                    .line {
                        border-bottom: 1px solid #333;
                        margin-bottom: 10px;
                        height: 30px;
                    }
                </style>
            </head>
            <body>
                ${selectedData.map(item => `
                    <div class="page">
                        <div class="header">
                            <h1>ใบแจ้งเงินเดือน / Payslip</h1>
                            <p>${periodText}</p>
                        </div>

                        <div class="info-box">
                            <div class="row">
                                <div class="col">
                                    <span class="label">ชื่อ-สกุล:</span> ${item.name}
                                </div>
                                <div class="col">
                                    <span class="label">รหัสพนักงาน:</span> ${item.employeeId}
                                </div>
                            </div>
                            <div class="row">
                                <div class="col">
                                    <span class="label">ประเภท:</span> ${item.type}
                                </div>
                                <div class="col">
                                    <span class="label">วันที่พิมพ์:</span> ${format(new Date(), "d MMMM yyyy", { locale: th })}
                                </div>
                            </div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th>รายการได้ (Earnings)</th>
                                    <th class="amount">จำนวนเงิน (บาท)</th>
                                    <th>รายการหัก (Deductions)</th>
                                    <th class="amount">จำนวนเงิน (บาท)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>เงินเดือน / ค่าจ้าง</td>
                                    <td class="amount">${item.baseSalary.toLocaleString()}</td>
                                    <td>หักมาสาย (${item.lateMinutes} นาที)</td>
                                    <td class="amount">${item.payrollBaseDeduction > 0 ? item.payrollBaseDeduction.toLocaleString() : "-"}</td>
                                </tr>
                                ${(item.manualDeductions || [])
                                    .filter(deduction => deduction.label || deduction.amount > 0)
                                    .map(deduction => `
                                        <tr>
                                            <td></td>
                                            <td class="amount"></td>
                                            <td>${escapeHtml(deduction.label || "รายการหักเพิ่มเติม")}</td>
                                            <td class="amount">${deduction.amount > 0 ? deduction.amount.toLocaleString() : "-"}</td>
                                        </tr>
                                    `).join('')}
                                <tr>
                                    <td>ค่าล่วงเวลา ปกติ (${item.otHoursNormal.toFixed(0)} ชม.)</td>
                                    <td class="amount">${item.otPayNormal > 0 ? item.otPayNormal.toLocaleString() : "-"}</td>
                                    <td></td>
                                    <td class="amount"></td>
                                </tr>
                                <tr>
                                    <td>ค่าล่วงเวลา วันหยุด (${item.otHoursHoliday.toFixed(0)} ชม.)</td>
                                    <td class="amount">${item.otPayHoliday > 0 ? item.otPayHoliday.toLocaleString() : "-"}</td>
                                    <td></td>
                                    <td class="amount"></td>
                                </tr>
                                <tr>
                                    <td>ค่าล่วงเวลา วันหยุดพิเศษ (${item.otHoursSpecial.toFixed(0)} ชม.)</td>
                                    <td class="amount">${item.otPaySpecial > 0 ? item.otPaySpecial.toLocaleString() : "-"}</td>
                                    <td></td>
                                    <td class="amount"></td>
                                </tr>
                                <tr>
                                    <td>ค่าทำงานวันหยุดพิเศษ (${item.customHolidayWorkHours.toFixed(0)} ชม.)</td>
                                    <td class="amount">${item.customHolidayWorkPay > 0 ? item.customHolidayWorkPay.toLocaleString() : "-"}</td>
                                    <td></td>
                                    <td class="amount"></td>
                                </tr>
                                ${(item.manualIncomes || [])
                                    .filter(income => income.label || income.amount > 0)
                                    .map(income => `
                                        <tr>
                                            <td>${escapeHtml(income.label || "เงินเพิ่ม")}</td>
                                            <td class="amount">${income.amount > 0 ? income.amount.toLocaleString() : "-"}</td>
                                            <td></td>
                                            <td class="amount"></td>
                                        </tr>
                                    `).join('')}
                                <!-- Add more rows if needed -->
                                <tr style="height: 60px;">
                                    <td></td><td></td><td></td><td></td>
                                </tr>
                                <tr class="total-row">
                                    <td>รวมรายได้</td>
                                    <td class="amount">${item.totalIncome.toLocaleString()}</td>
                                    <td>รวมรายการหัก</td>
                                    <td class="amount">${item.totalDeduction.toLocaleString()}</td>
                                </tr>
                            </tbody>
                        </table>

                        <div class="net-pay">
                            <span>เงินได้สุทธิ (Net Pay)</span>
                            <span>${item.netTotal.toLocaleString()} บาท</span>
                        </div>

                        <div class="signature">
                            <div class="sign-box">
                                <div class="line"></div>
                                <div>ลายเซ็นพนักงาน</div>
                            </div>
                            <div class="sign-box">
                                <div class="line"></div>
                                <div>ผู้มีอำนาจลงนาม</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
                <script>
                    window.onload = () => {
                        window.print();
                    }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handleExportPayrollCsv = () => {
        const selectedData = payrollData
            .filter(item => selectedIds.includes(item.employeeId))
            .map(normalizePayrollItem);
        if (selectedData.length === 0) return;

        const { periodLabel } = getCurrentPeriodMeta();
        const headers = [
            "งวดเงินเดือน",
            "รหัสพนักงาน",
            "ชื่อพนักงาน",
            "ประเภท",
            "ฐานเงินเดือน/ค่าจ้าง",
            "วันทำงาน",
            "วันลา",
            "สาย (นาที)",
            "OT ปกติ (ชม.)",
            "OT วันหยุด (ชม.)",
            "OT วันหยุดพิเศษ (ชม.)",
            "ค่า OT ปกติ",
            "ค่า OT วันหยุด",
            "ค่า OT วันหยุดพิเศษ",
            "ค่าทำงานวันหยุดพิเศษ",
            "รายได้คำนวณ",
            "เงินเพิ่ม",
            "รายการเงินเพิ่ม",
            "รายการหักคำนวณ",
            "รายการหักเพิ่ม",
            "รายการหักเพิ่มทั้งหมด",
            "รวมรายได้",
            "รวมรายการหัก",
            "จ่ายสุทธิ",
        ];

        const rows = selectedData.map((item) => {
            const manualIncomeTotal = (item.manualIncomes || []).reduce((sum, income) => sum + toNumber(income.amount), 0);
            const manualDeductionTotal = (item.manualDeductions || []).reduce((sum, deduction) => sum + toNumber(deduction.amount), 0);
            const incomeLabels = (item.manualIncomes || [])
                .filter(income => income.label || toNumber(income.amount) > 0)
                .map(income => `${income.label || "เงินเพิ่ม"} ${toNumber(income.amount)}`)
                .join("; ");
            const deductionLabels = (item.manualDeductions || [])
                .filter(deduction => deduction.label || toNumber(deduction.amount) > 0)
                .map(deduction => `${deduction.label || "รายการหัก"} ${toNumber(deduction.amount)}`)
                .join("; ");

            return [
                periodLabel,
                item.employeeId,
                item.name,
                item.type,
                item.baseSalary,
                item.workDays,
                item.leaveDays,
                item.lateMinutes,
                item.otHoursNormal.toFixed(2),
                item.otHoursHoliday.toFixed(2),
                item.otHoursSpecial.toFixed(2),
                item.otPayNormal,
                item.otPayHoliday,
                item.otPaySpecial,
                item.customHolidayWorkPay,
                item.payrollBaseIncome,
                manualIncomeTotal,
                incomeLabels,
                item.payrollBaseDeduction,
                manualDeductionTotal,
                deductionLabels,
                item.totalIncome,
                item.totalDeduction,
                item.netTotal,
            ];
        });

        const totals = selectedData.reduce((summary, item) => {
            const manualIncomeTotal = (item.manualIncomes || []).reduce((sum, income) => sum + toNumber(income.amount), 0);
            const manualDeductionTotal = (item.manualDeductions || []).reduce((sum, deduction) => sum + toNumber(deduction.amount), 0);
            return {
                baseSalary: summary.baseSalary + toNumber(item.baseSalary),
                workDays: summary.workDays + toNumber(item.workDays),
                leaveDays: summary.leaveDays + toNumber(item.leaveDays),
                lateMinutes: summary.lateMinutes + toNumber(item.lateMinutes),
                otHoursNormal: summary.otHoursNormal + toNumber(item.otHoursNormal),
                otHoursHoliday: summary.otHoursHoliday + toNumber(item.otHoursHoliday),
                otHoursSpecial: summary.otHoursSpecial + toNumber(item.otHoursSpecial),
                otPayNormal: summary.otPayNormal + toNumber(item.otPayNormal),
                otPayHoliday: summary.otPayHoliday + toNumber(item.otPayHoliday),
                otPaySpecial: summary.otPaySpecial + toNumber(item.otPaySpecial),
                customHolidayWorkPay: summary.customHolidayWorkPay + toNumber(item.customHolidayWorkPay),
                payrollBaseIncome: summary.payrollBaseIncome + toNumber(item.payrollBaseIncome),
                manualIncomeTotal: summary.manualIncomeTotal + manualIncomeTotal,
                payrollBaseDeduction: summary.payrollBaseDeduction + toNumber(item.payrollBaseDeduction),
                manualDeductionTotal: summary.manualDeductionTotal + manualDeductionTotal,
                totalIncome: summary.totalIncome + toNumber(item.totalIncome),
                totalDeduction: summary.totalDeduction + toNumber(item.totalDeduction),
                netTotal: summary.netTotal + toNumber(item.netTotal),
            };
        }, {
            baseSalary: 0,
            workDays: 0,
            leaveDays: 0,
            lateMinutes: 0,
            otHoursNormal: 0,
            otHoursHoliday: 0,
            otHoursSpecial: 0,
            otPayNormal: 0,
            otPayHoliday: 0,
            otPaySpecial: 0,
            customHolidayWorkPay: 0,
            payrollBaseIncome: 0,
            manualIncomeTotal: 0,
            payrollBaseDeduction: 0,
            manualDeductionTotal: 0,
            totalIncome: 0,
            totalDeduction: 0,
            netTotal: 0,
        });

        rows.push([
            periodLabel,
            "",
            "รวม",
            "",
            totals.baseSalary,
            totals.workDays,
            totals.leaveDays,
            totals.lateMinutes,
            totals.otHoursNormal.toFixed(2),
            totals.otHoursHoliday.toFixed(2),
            totals.otHoursSpecial.toFixed(2),
            totals.otPayNormal,
            totals.otPayHoliday,
            totals.otPaySpecial,
            totals.customHolidayWorkPay,
            totals.payrollBaseIncome,
            totals.manualIncomeTotal,
            "",
            totals.payrollBaseDeduction,
            totals.manualDeductionTotal,
            "",
            totals.totalIncome,
            totals.totalDeduction,
            totals.netTotal,
        ]);

        const csvContent = "\uFEFF" + [
            headers.map(escapeCsvValue).join(","),
            ...rows.map(row => row.map(escapeCsvValue).join(",")),
        ].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const filePeriod = calculationPeriod === "month"
            ? format(selectedDate, "yyyy-MM")
            : `${format(customRange.start, "yyyyMMdd")}-${format(customRange.end, "yyyyMMdd")}`;

        link.href = url;
        link.download = `payroll_summary_${filePeriod}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const calculatePayroll = async () => {
        setLoading(true);
        try {
            // 1. Determine Date Range
            let startDate: Date;
            let endDate: Date;

            if (calculationPeriod === "month") {
                startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
                endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
            } else {
                // Custom Range
                startDate = new Date(customRange.start);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(customRange.end);
                endDate.setHours(23, 59, 59, 999);
            }

            // 2. Fetch Employees
            const allEmployees = await employeeService.getAll();
            let targetEmployees: Employee[] = [];

            if (employeeType === "ประจำ - รายเดือน") {
                targetEmployees = allEmployees.filter(e => e.type === "รายเดือน" && e.employmentType !== "ชั่วคราว");
            } else if (employeeType === "ประจำ - รายวัน") {
                targetEmployees = allEmployees.filter(e => e.type === "รายวัน" && e.employmentType !== "ชั่วคราว");
            } else {
                // ชั่วคราว
                targetEmployees = allEmployees.filter(e => e.employmentType === "ชั่วคราว" || e.type === "ชั่วคราว");
            }

            // Filter by Department
            if (selectedDepartment !== "all") {
                targetEmployees = targetEmployees.filter(e => e.department === selectedDepartment);
            }

            // 3. Fetch ALL Data ONCE (fix N+1 query problem)
            // Instead of querying per employee, fetch all attendance, OT, and swap requests in the date range
            const [allAttendance, allOTRequests, allSwapRequests, allLeaveRequests] = await Promise.all([
                attendanceService.getByDateRange(startDate, endDate),
                otService.getByDateRange(startDate, endDate),
                swapService.getAll(), // Get all swap requests and filter later
                leaveService.getByDateRange(startDate, endDate),
            ]);

            // Filter only approved swap requests that affect the date range
            const approvedSwaps = allSwapRequests.filter(s => {
                if (s.status !== "อนุมัติ") return false;
                const workDate = s.workDate instanceof Date ? s.workDate : new Date(s.workDate);
                const holidayDate = s.holidayDate instanceof Date ? s.holidayDate : new Date(s.holidayDate);
                return (workDate >= startDate && workDate <= endDate) ||
                    (holidayDate >= startDate && holidayDate <= endDate);
            });

            // Group attendance and OT by employee ID for efficient lookup
            const attendanceByEmployee = new Map<string, Attendance[]>();
            allAttendance.forEach(a => {
                if (!attendanceByEmployee.has(a.employeeId)) {
                    attendanceByEmployee.set(a.employeeId, []);
                }
                attendanceByEmployee.get(a.employeeId)?.push(a);
            });

            const otByEmployee = new Map<string, OTRequest[]>();
            allOTRequests.forEach(ot => {
                if (!otByEmployee.has(ot.employeeId)) {
                    otByEmployee.set(ot.employeeId, []);
                }
                otByEmployee.get(ot.employeeId)?.push(ot);
            });

            const leaveByEmployee = new Map<string, LeaveRequest[]>();
            allLeaveRequests
                .filter(leave => leave.status === "อนุมัติ")
                .forEach(leave => {
                    if (!leaveByEmployee.has(leave.employeeId)) {
                        leaveByEmployee.set(leave.employeeId, []);
                    }
                    leaveByEmployee.get(leave.employeeId)?.push(leave);
                });

            // Group swap requests by employee ID
            const swapsByEmployee = new Map<string, SwapRequest[]>();
            approvedSwaps.forEach(swap => {
                if (!swapsByEmployee.has(swap.employeeId)) {
                    swapsByEmployee.set(swap.employeeId, []);
                }
                swapsByEmployee.get(swap.employeeId)?.push(swap);
            });

            // 4. Calculate for each employee (no more individual queries!)
            const results: PayrollItem[] = [];

            // Use config values or defaults
            const otMultiplier = toNumber(config?.otMultiplier) || 1.5;
            const otMultiplierHoliday = toNumber(config?.otMultiplierHoliday) || 3.0;
            const globalHolidays = config?.weeklyHolidays ?? [0, 6];
            const useIndividualHolidays = config?.useIndividualHolidays ?? false;
            const lateDeductionType = config?.lateDeductionType ?? "pro-rated";
            const lateDeductionRate = toNumber(config?.lateDeductionRate);

            for (const emp of targetEmployees) {
                if (!emp.id) continue;

                const checkInConfig = {
                    hour: config?.checkInHour ?? 9,
                    minute: config?.checkInMinute ?? 0,
                    gracePeriod: config?.lateGracePeriod ?? 0
                };

                // Get attendance and OT from pre-fetched data (no database query!)
                const attendance = attendanceByEmployee.get(emp.id) || [];
                const otRequests = otByEmployee.get(emp.id) || [];
                const leaveRequests = leaveByEmployee.get(emp.id) || [];

                // Filter OT by status
                const approvedOT = otRequests.filter(ot => ot.status === "อนุมัติ");

                // Group Attendance by Date
                const dailyAttendance = new Map<string, Attendance[]>();
                attendance.forEach(a => {
                    if (a.date) {
                        const dateKey = format(a.date, "yyyy-MM-dd");
                        if (!dailyAttendance.has(dateKey)) {
                            dailyAttendance.set(dateKey, []);
                        }
                        dailyAttendance.get(dateKey)?.push(a);
                    }
                });

                const attendanceWorkDays = dailyAttendance.size;
                const leaveDays = getPayrollLeaveDays(leaveRequests, new Set(dailyAttendance.keys()));
                const workDays = attendanceWorkDays + leaveDays;
                let totalLateMinutes = 0;

                dailyAttendance.forEach((records) => {
                    // Find earliest check-in for the day
                    let earliestCheckIn: Date | null = null;
                    records.forEach(r => {
                        if (r.checkIn) {
                            if (!earliestCheckIn || r.checkIn < earliestCheckIn) {
                                earliestCheckIn = r.checkIn;
                            }
                        }
                    });

                    if (earliestCheckIn) {
                        totalLateMinutes += getLateMinutes(earliestCheckIn, checkInConfig);
                    }
                });

                // Calculate Pay
                const baseSalary = toNumber(emp.baseSalary);
                let income = 0;
                let deduction = 0;

                // Hourly Rate Estimate
                let hourlyRate = 0;

                // Determine calculation method based on EMPLOYEE'S type, not the filter
                const isMonthly = emp.type === "รายเดือน";

                if (isMonthly) {
                    if (calculationPeriod === "month") {
                        income = baseSalary;
                        hourlyRate = baseSalary / 30 / 8;
                    } else {
                        // Custom Range for monthly employee
                        // Pro-rate based on number of days in range
                        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        // Formula: (BaseSalary / 30) * DaysInRange
                        income = (baseSalary / 30) * diffDays;
                        hourlyRate = baseSalary / 30 / 8;
                    }
                } else {
                    // Daily (รายวัน) or Legacy Temp (ชั่วคราว)
                    income = baseSalary * workDays;
                    hourlyRate = baseSalary / 8;
                }

                // Round initial income
                income = Math.round(income);

                // Calculate Custom Holiday Work Pay
                let customHolidayWorkHours = 0;
                let customHolidayWorkPay = 0;
                const customHolidays = config?.customHolidays ?? [];

                dailyAttendance.forEach((records, dateKey) => {
                    // Check if this date is a custom holiday
                    const customHoliday = customHolidays.find(h => {
                        return format(h.date, "yyyy-MM-dd") === dateKey;
                    });

                    if (customHoliday) {
                        // Assume 8 hours work day for simplicity, or calculate from check-in/out if needed
                        // For now, using standard 8 hours if they showed up
                        const hours = 8;
                        customHolidayWorkHours += hours;

                        // Calculate extra pay based on multiplier
                        // Note: Base pay (1x) is already included in salary/daily wage
                        // So we add the extra portion: (multiplier - 1)
                        const workdayMultiplier = toNumber(customHoliday.workdayMultiplier);
                        if (workdayMultiplier > 1) {
                            const extraMultiplier = workdayMultiplier - 1;
                            customHolidayWorkPay += hours * hourlyRate * extraMultiplier;
                        }
                    }
                });

                // Round Custom Holiday Pay
                customHolidayWorkPay = Math.round(customHolidayWorkPay);
                income += customHolidayWorkPay;

                // Calculate OT Pay
                let totalOtHours = 0;
                let totalOtPay = 0;
                let otHoursNormal = 0;
                let otHoursHoliday = 0;
                let otHoursSpecial = 0;
                let otPayNormal = 0;
                let otPayHoliday = 0;
                let otPaySpecial = 0;

                // Get this employee's swap requests for date checking
                const employeeSwaps = swapsByEmployee.get(emp.id) || [];

                // Create sets for quick lookup of swapped dates
                // workDatesFromHoliday: วันหยุดที่ขอมาทำงาน (ถือเป็นวันทำงานปกติ)
                // holidayDatesFromWork: วันทำงานที่ขอหยุดแทน (ถือเป็นวันหยุด)
                const workDatesFromHoliday = new Set<string>();
                const holidayDatesFromWork = new Set<string>();

                employeeSwaps.forEach(swap => {
                    const workDate = swap.workDate instanceof Date ? swap.workDate : new Date(swap.workDate);
                    const holidayDate = swap.holidayDate instanceof Date ? swap.holidayDate : new Date(swap.holidayDate);
                    workDatesFromHoliday.add(format(workDate, "yyyy-MM-dd"));
                    holidayDatesFromWork.add(format(holidayDate, "yyyy-MM-dd"));
                });

                approvedOT.forEach(ot => {
                    if (ot.startTime && ot.endTime && ot.date) {
                        const start = ot.startTime.getTime();
                        const end = ot.endTime.getTime();
                        const minutes = (end - start) / (1000 * 60);
                        const hours = minutes / 60;

                        totalOtHours += hours;

                        // Check if holiday
                        const otDateStr = format(ot.date, "yyyy-MM-dd");
                        const customHolidays = config?.customHolidays ?? [];
                        const customHoliday = customHolidays.find(h => {
                            return format(h.date, "yyyy-MM-dd") === otDateStr;
                        });

                        if (customHoliday) {
                            // Custom holiday (ตามที่กำหนดใน settings)
                            otHoursSpecial += hours;
                            otPaySpecial += hours * hourlyRate * toNumber(customHoliday.otMultiplier);
                        } else {
                            const dayOfWeek = ot.date.getDay();
                            // Use individual or global holidays based on setting
                            const applicableHolidays = useIndividualHolidays
                                ? (emp.weeklyHolidays || globalHolidays)
                                : globalHolidays;
                            const isWeeklyHoliday = applicableHolidays.includes(dayOfWeek);

                            // Check swap status:
                            // - ถ้าเป็นวันที่อยู่ใน workDatesFromHoliday = วันหยุดที่สลับมาทำงาน → ถือเป็นวันทำงาน (OT ปกติ)
                            // - ถ้าเป็นวันที่อยู่ใน holidayDatesFromWork = วันทำงานที่สลับไปหยุด → ถือเป็นวันหยุด (OT x3)
                            const isSwappedToWorkday = workDatesFromHoliday.has(otDateStr);
                            const isSwappedToHoliday = holidayDatesFromWork.has(otDateStr);

                            // Determine effective holiday status
                            let effectiveHoliday = isWeeklyHoliday;
                            if (isSwappedToWorkday) {
                                // วันหยุดที่สลับมาทำงาน → ไม่ถือเป็นวันหยุด
                                effectiveHoliday = false;
                            } else if (isSwappedToHoliday) {
                                // วันทำงานที่สลับไปหยุด → ถือเป็นวันหยุด
                                effectiveHoliday = true;
                            }

                            if (effectiveHoliday) {
                                otHoursHoliday += hours;
                                otPayHoliday += hours * hourlyRate * otMultiplierHoliday;
                            } else {
                                otHoursNormal += hours;
                                otPayNormal += hours * hourlyRate * otMultiplier;
                            }
                        }
                    }
                });

                // Round OT Pays
                otPayNormal = Math.round(otPayNormal);
                otPayHoliday = Math.round(otPayHoliday);
                otPaySpecial = Math.round(otPaySpecial);

                totalOtPay = otPayNormal + otPayHoliday + otPaySpecial;

                // OT Pay
                income += totalOtPay;

                // Late Deduction
                let lateDeduction = 0;
                if (lateDeductionType === "pro-rated") {
                    lateDeduction = (totalLateMinutes / 60) * hourlyRate;
                } else if (lateDeductionType === "fixed_per_minute") {
                    lateDeduction = totalLateMinutes * lateDeductionRate;
                }

                // Round Late Deduction
                lateDeduction = Math.round(lateDeduction);
                deduction += lateDeduction;

                results.push({
                    employeeId: emp.employeeId || "",
                    name: emp.name,
                    type: emp.type || "",
                    baseSalary,
                    workDays,
                    leaveDays,
                    lateMinutes: totalLateMinutes,
                    otHours: totalOtHours,
                    otHoursNormal,
                    otHoursHoliday,
                    otHoursSpecial,
                    otPayNormal,
                    otPayHoliday,
                    otPaySpecial,
                    customHolidayWorkHours: customHolidayWorkHours,
                    customHolidayWorkPay: customHolidayWorkPay,
                    payrollBaseIncome: income,
                    attendanceAllowance: 0,
                    specialAllowance: 0,
                    bonus: 0,
                    manualIncomes: [],
                    payrollBaseDeduction: deduction,
                    manualDeductions: [],
                    totalIncome: income,
                    totalDeduction: deduction,
                    netTotal: income - deduction
                });
            }

            setPayrollData(results);
            // Select all by default
            setSelectedIds(results.map(r => r.employeeId));

        } catch (error) {
            console.error("Error calculating payroll:", error);
            alert("เกิดข้อผิดพลาดในการคำนวณ");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="px-6 pb-8 space-y-6">
                {/* Controls */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4">
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_150px] xl:items-end">
                        {/* Filters Grid */}
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(230px,1.15fr)_minmax(190px,0.95fr)_minmax(210px,1fr)_minmax(220px,1fr)]">
                            {/* Employee Type */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">ประเภทพนักงาน</label>
                                <div className="grid grid-cols-3 bg-gray-50 p-1 rounded-lg border border-gray-100">
                                    {(["ประจำ - รายเดือน", "ประจำ - รายวัน", "ชั่วคราว"] as const).map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => setEmployeeType(type)}
                                            className={`h-8 px-1.5 rounded-md text-[11px] font-medium transition-all text-center whitespace-nowrap ${employeeType === type
                                                ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5"
                                                : "text-gray-500 hover:text-gray-700"
                                                }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Department */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">แผนก/สังกัด</label>
                                <select
                                    value={selectedDepartment}
                                    onChange={(e) => setSelectedDepartment(e.target.value)}
                                    className="h-9 w-full px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white hover:border-blue-400 transition-colors"
                                >
                                    <option value="all">ทั้งหมด</option>
                                    {departments.map((dept) => (
                                        <option key={dept} value={dept}>
                                            {dept}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Calculation Period */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">รูปแบบการคำนวณ</label>
                                <div className="grid grid-cols-2 gap-2 h-9">
                                    <button
                                        onClick={() => setCalculationPeriod("month")}
                                        className={`px-2 rounded-lg text-sm transition-all border font-medium whitespace-nowrap ${calculationPeriod === "month"
                                            ? "bg-blue-50 border-blue-200 text-blue-700"
                                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                                            }`}
                                    >
                                        รายเดือน
                                    </button>
                                    <button
                                        onClick={() => setCalculationPeriod("custom")}
                                        className={`px-2 rounded-lg text-sm transition-all border font-medium whitespace-nowrap ${calculationPeriod === "custom"
                                            ? "bg-blue-50 border-blue-200 text-blue-700"
                                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                                            }`}
                                    >
                                        กำหนดเอง
                                    </button>
                                </div>
                            </div>

                            {/* Date Picker */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    {calculationPeriod === "month" ? "ประจำเดือน" : "ช่วงวันที่"}
                                </label>

                                {calculationPeriod === "month" ? (
                                    <div className="relative h-9">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                                        <input
                                            type="month"
                                            value={format(selectedDate, "yyyy-MM")}
                                            onChange={(e) => {
                                                const [y, m] = e.target.value.split('-').map(Number);
                                                setSelectedDate(new Date(y, m - 1, 1));
                                            }}
                                            className="h-full w-full pl-9 pr-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors"
                                        />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 h-9">
                                        <input
                                            type="date"
                                            value={format(customRange.start, "yyyy-MM-dd")}
                                            onChange={(e) => {
                                                const [y, m, d] = e.target.value.split('-').map(Number);
                                                setCustomRange({ ...customRange, start: new Date(y, m - 1, d) });
                                            }}
                                            className="h-full min-w-0 px-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors"
                                        />
                                        <span className="text-gray-400">-</span>
                                        <input
                                            type="date"
                                            value={format(customRange.end, "yyyy-MM-dd")}
                                            onChange={(e) => {
                                                const [y, m, d] = e.target.value.split('-').map(Number);
                                                setCustomRange({ ...customRange, end: new Date(y, m - 1, d) });
                                            }}
                                            className="h-full min-w-0 px-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 sm:flex sm:justify-end xl:grid xl:grid-cols-1 xl:border-t-0 xl:pt-0">
                            <button
                                onClick={calculatePayroll}
                                disabled={loading}
                                className="h-10 px-3 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm font-medium whitespace-nowrap"
                            >
                                <DollarSign className="w-4 h-4" />
                                {loading ? "กำลังคำนวณ..." : "คำนวณเงินเดือน"}
                            </button>

                        </div>
                    </div>
                </div>

                {savedPayrolls.length > 0 && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 rounded-lg bg-white p-2 text-indigo-600 shadow-sm ring-1 ring-indigo-100">
                                    <History className="h-4 w-4" />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-indigo-950">ประวัติเงินเดือนที่บันทึกไว้</div>
                                    <div className="mt-0.5 text-xs text-indigo-600">เลือกงวดที่เคยบันทึกไว้เพื่อโหลดกลับมาดูหรือพิมพ์ย้อนหลัง</div>
                                </div>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-[minmax(240px,1fr)_120px_90px] lg:min-w-[620px]">
                                <select
                                    value={selectedSavedPayrollId}
                                    onChange={(e) => setSelectedSavedPayrollId(e.target.value)}
                                    className="h-10 rounded-lg border border-indigo-100 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                >
                                    <option value="">เลือกงวดที่บันทึกไว้</option>
                                    {savedPayrolls.map((record) => (
                                        <option key={record.id} value={record.id}>
                                            {record.periodLabel} - สุทธิ ฿{toNumber(record.totals?.net).toLocaleString()}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={handleLoadSavedPayroll}
                                    disabled={!selectedSavedPayrollId}
                                    className="h-10 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    โหลดดูย้อนหลัง
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteSavedPayroll}
                                    disabled={!selectedSavedPayrollId}
                                    className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    ลบ
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Config Summary */}
                {config && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap gap-x-8 gap-y-3 items-center text-xs text-slate-700">
                        <div className="flex items-center gap-2 font-medium text-slate-900 border-r border-slate-200 pr-6 mr-2">
                            <div className="p-1.5 bg-blue-100/50 rounded-md text-blue-600">
                                <Filter className="w-3.5 h-3.5" />
                            </div>
                            ค่าที่ใช้คำนวณ
                        </div>

                        <div className="flex items-center gap-2 group cursor-help" title="เวลาเช็คอิน-เช็คเอาท์ปกติ">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-blue-500 transition-colors"></span>
                            <span className="text-slate-500">เวลาทำงาน:</span>
                            <span className="font-semibold font-mono">{config.checkInHour.toString().padStart(2, '0')}:{config.checkInMinute.toString().padStart(2, '0')} - {config.checkOutHour.toString().padStart(2, '0')}:{config.checkOutMinute.toString().padStart(2, '0')}</span>
                        </div>
                        <div className="flex items-center gap-2 group cursor-help" title="ระยะเวลาอนุโลมให้สายได้โดยไม่หักเงิน">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-blue-500 transition-colors"></span>
                            <span className="text-slate-500">สายได้:</span>
                            <span className="font-semibold">{config.lateGracePeriod} นาที</span>
                        </div>
                        <div className="flex items-center gap-2 group cursor-help">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-blue-500 transition-colors"></span>
                            <span className="text-slate-500">OT ขั้นต่ำ:</span>
                            <span className="font-semibold">{config.minOTMinutes} นาที</span>
                        </div>
                        <div className="flex items-center gap-2 group cursor-help">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-blue-500 transition-colors"></span>
                            <span className="text-slate-500">OT ปกติ:</span>
                            <span className="font-semibold">x{config.otMultiplier ?? 1.5}</span>
                        </div>
                        <div className="flex items-center gap-2 group cursor-help">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-blue-500 transition-colors"></span>
                            <span className="text-slate-500">OT วันหยุด:</span>
                            <span className="font-semibold">x{config.otMultiplierHoliday ?? 3.0}</span>
                        </div>
                        <div className="flex items-center gap-2 group cursor-help">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-blue-500 transition-colors"></span>
                            <span className="text-slate-500">หักสาย:</span>
                            <span className="font-semibold">
                                {config.lateDeductionType === "none" ? "ไม่หัก" :
                                    config.lateDeductionType === "fixed_per_minute" ? `นาทีละ ${config.lateDeductionRate} บาท` :
                                        "ตามจริง"}
                            </span>
                        </div>
                    </div>
                )}

                {/* Results */}
                {payrollData.length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        {(() => {
                            const normalizedPayroll = payrollData.map(normalizePayrollItem);
                            const totalBaseIncome = normalizedPayroll.reduce((sum, item) => sum + toNumber(item.payrollBaseIncome), 0);
                            const totalExtraIncome = normalizedPayroll.reduce((sum, item) => {
                                const manualIncomeTotal = (item.manualIncomes || []).reduce((incomeSum, income) => incomeSum + toNumber(income.amount), 0);
                                const legacyIncomeTotal = toNumber(item.attendanceAllowance) + toNumber(item.specialAllowance) + toNumber(item.bonus);
                                return sum + (Array.isArray(item.manualIncomes) ? manualIncomeTotal : legacyIncomeTotal);
                            }, 0);
                            const totalDeduction = normalizedPayroll.reduce((sum, item) => sum + toNumber(item.totalDeduction), 0);
                            const totalNet = normalizedPayroll.reduce((sum, item) => sum + toNumber(item.netTotal), 0);

                            return (
                                <>
                                    <div className="px-6 py-5 border-b border-gray-200 bg-gray-50/50">
                                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                                <div className="flex items-center gap-2">
                                                    <DollarSign className="w-5 h-5 text-emerald-600" />
                                                    <h3 className="font-semibold text-gray-900">สรุปรายการจ่ายเงินเดือน</h3>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        onClick={handleSavePayroll}
                                                        disabled={payrollData.length === 0 || savingPayroll}
                                                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm shadow-emerald-600/20 transition-all hover:bg-emerald-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                                                        title={savingPayroll ? "กำลังบันทึกงวดนี้" : "บันทึกงวดนี้"}
                                                        aria-label={savingPayroll ? "กำลังบันทึกงวดนี้" : "บันทึกงวดนี้"}
                                                    >
                                                        <Save className="h-3.5 w-3.5" />
                                                        <span>{savingPayroll ? "บันทึก..." : "บันทึก"}</span>
                                                    </button>
                                                    <button
                                                        onClick={handlePrint}
                                                        disabled={selectedIds.length === 0}
                                                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white shadow-sm shadow-slate-900/20 transition-all hover:bg-slate-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                                                        title={`พิมพ์สลิป${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`}
                                                        aria-label={`พิมพ์สลิป${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`}
                                                    >
                                                        <Download className="h-3.5 w-3.5" />
                                                        <span>สลิป{selectedIds.length > 0 ? ` ${selectedIds.length}` : ""}</span>
                                                    </button>
                                                    <button
                                                        onClick={handleExportPayrollCsv}
                                                        disabled={selectedIds.length === 0}
                                                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                                                        title={`Export CSV${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`}
                                                        aria-label={`Export CSV${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`}
                                                    >
                                                        <Download className="h-3.5 w-3.5" />
                                                        <span>CSV{selectedIds.length > 0 ? ` ${selectedIds.length}` : ""}</span>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[680px]">
                                                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                                                    <div className="text-[11px] font-medium text-slate-500">รายได้คำนวณ</div>
                                                    <div className="mt-1 text-sm font-bold text-slate-900">฿{totalBaseIncome.toLocaleString()}</div>
                                                </div>
                                                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                                                    <div className="text-[11px] font-medium text-blue-600">เงินเพิ่ม</div>
                                                    <div className="mt-1 text-sm font-bold text-blue-700">฿{totalExtraIncome.toLocaleString()}</div>
                                                </div>
                                                <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                                                    <div className="text-[11px] font-medium text-red-600">รายการหัก</div>
                                                    <div className="mt-1 text-sm font-bold text-red-700">฿{totalDeduction.toLocaleString()}</div>
                                                </div>
                                                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                                                    <div className="text-[11px] font-medium text-emerald-600">รวมจ่ายสุทธิ</div>
                                                    <div className="mt-1 text-lg font-bold text-emerald-700">฿{totalNet.toLocaleString()}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-b border-gray-200 bg-white px-4 py-3">
                                        <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
                                            <div>
                                                <div className="text-xs font-semibold text-gray-900">เพิ่มรายการแบบกลุ่ม</div>
                                                <div className="mt-0.5 text-[11px] text-gray-500">กรอกครั้งเดียวแล้วใช้กับทุกคน หรือเฉพาะพนักงานที่เลือก</div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[120px_minmax(180px,1fr)_120px_130px_120px] xl:min-w-[760px]">
                                                <select
                                                    value={bulkEntry.type}
                                                    onChange={(e) => setBulkEntry(current => ({ ...current, type: e.target.value as "income" | "deduction" }))}
                                                    className="h-9 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="income">เงินเพิ่ม</option>
                                                    <option value="deduction">รายการหัก</option>
                                                </select>
                                                <input
                                                    type="text"
                                                    value={bulkEntry.label}
                                                    onChange={(e) => setBulkEntry(current => ({ ...current, label: e.target.value }))}
                                                    className="h-9 rounded-md border border-gray-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="ชื่อรายการ เช่น ค่าอาหาร"
                                                />
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={bulkEntry.amount}
                                                    onChange={(e) => setBulkEntry(current => ({ ...current, amount: e.target.value }))}
                                                    className="h-9 rounded-md border border-gray-200 px-3 text-right text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="0"
                                                />
                                                <select
                                                    value={bulkEntry.target}
                                                    onChange={(e) => setBulkEntry(current => ({ ...current, target: e.target.value as "all" | "selected" }))}
                                                    className="h-9 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="all">ทุกคน</option>
                                                    <option value="selected">ที่เลือก ({selectedIds.length})</option>
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={applyBulkEntry}
                                                    disabled={!bulkEntry.label.trim() || !(Number(bulkEntry.amount) > 0) || (bulkEntry.target === "selected" && selectedIds.length === 0)}
                                                    className={`inline-flex h-9 items-center justify-center gap-1 rounded-md px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${bulkEntry.type === "income"
                                                        ? "bg-blue-600 hover:bg-blue-700"
                                                        : "bg-red-600 hover:bg-red-700"
                                                        }`}
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                    ใช้รายการ
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="divide-y divide-gray-100">
                                        <div className="hidden grid-cols-[36px_minmax(140px,0.85fr)_minmax(210px,1fr)_minmax(250px,1.15fr)_minmax(260px,1.15fr)_minmax(132px,0.65fr)] items-center gap-3 bg-gray-100 px-4 py-3 text-xs font-semibold uppercase text-gray-500 xl:grid">
                                            <div>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.length === payrollData.length && payrollData.length > 0}
                                                    onChange={handleSelectAll}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </div>
                                            <div>พนักงาน</div>
                                            <div>สรุปการคำนวณ</div>
                                            <div>เงินเพิ่ม</div>
                                            <div>รายการหักเพิ่ม</div>
                                            <div className="text-right">ยอดสุทธิ</div>
                                        </div>

                                        {normalizedPayroll.map((item) => {
                                            const manualIncomeTotal = (item.manualIncomes || []).reduce((sum, income) => sum + toNumber(income.amount), 0);
                                            const legacyIncomeTotal = toNumber(item.attendanceAllowance) + toNumber(item.specialAllowance) + toNumber(item.bonus);
                                            const extraTotal = Array.isArray(item.manualIncomes) ? manualIncomeTotal : legacyIncomeTotal;
                                            const manualDeductionTotal = (item.manualDeductions || []).reduce((sum, deduction) => sum + toNumber(deduction.amount), 0);
                                            const totalOtHours = toNumber(item.otHoursNormal) + toNumber(item.otHoursHoliday) + toNumber(item.otHoursSpecial);

                                            return (
                                                <div key={item.employeeId} className="grid grid-cols-1 items-start gap-4 px-4 py-4 hover:bg-blue-50/30 md:grid-cols-[40px_1fr] xl:grid-cols-[36px_minmax(140px,0.85fr)_minmax(210px,1fr)_minmax(250px,1.15fr)_minmax(260px,1.15fr)_minmax(132px,0.65fr)] xl:gap-3">
                                                    <div className="pt-1 md:row-span-4 xl:row-span-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.includes(item.employeeId)}
                                                            onChange={() => handleSelectOne(item.employeeId)}
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                    </div>

                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-gray-900">{item.name}</div>
                                                        <div className="text-xs text-gray-400 font-mono">{item.employeeId}</div>
                                                        <span className={`mt-2 inline-flex text-[10px] px-2 py-0.5 rounded-full ${item.type === 'รายเดือน'
                                                            ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                                            : 'bg-orange-50 text-orange-600 border border-orange-100'
                                                            }`}>
                                                            {item.type}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div className="rounded-md bg-slate-50 px-2.5 py-2">
                                                            <div className="text-slate-500">วันทำงาน</div>
                                                            <div className="mt-0.5 font-semibold text-slate-900">{item.workDays.toFixed(2).replace(/\.?0+$/, "")} วัน</div>
                                                            {item.leaveDays > 0 && (
                                                                <div className="mt-0.5 text-[10px] font-medium text-blue-600">
                                                                    รวมลา {formatLeaveDayHourUnits(item.leaveDays)}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="rounded-md bg-slate-50 px-2.5 py-2">
                                                            <div className="text-slate-500">ฐานเงินเดือน</div>
                                                            <div className="mt-0.5 font-semibold text-slate-900">฿{toNumber(item.baseSalary).toLocaleString()}</div>
                                                        </div>
                                                        <div className="rounded-md bg-slate-50 px-2.5 py-2">
                                                            <div className="text-slate-500">OT รวม</div>
                                                            <div className="mt-0.5 font-semibold text-slate-900">{totalOtHours > 0 ? `${totalOtHours.toFixed(1)} ชม.` : "-"}</div>
                                                        </div>
                                                        <div className="rounded-md bg-slate-50 px-2.5 py-2">
                                                            <div className="text-slate-500">สาย</div>
                                                            <div className={`mt-0.5 font-semibold ${item.lateMinutes > 0 ? "text-red-600" : "text-slate-900"}`}>
                                                                {item.lateMinutes > 0 ? `${item.lateMinutes} นาที` : "-"}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-2">
                                                        <div className="mb-2 flex items-center justify-between gap-2">
                                                            <span className="text-[11px] font-semibold text-blue-700">เงินเพิ่ม</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => addManualIncome(item.employeeId)}
                                                                className="inline-flex h-7 items-center gap-1 rounded-md border border-blue-200 bg-white px-2 text-[11px] font-medium text-blue-700 hover:bg-blue-50"
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                                เพิ่ม
                                                            </button>
                                                        </div>

                                                        {(item.manualIncomes || []).length === 0 ? (
                                                            <div className="rounded-md border border-dashed border-blue-100 bg-white/60 px-2 py-2 text-center text-[11px] text-blue-400">
                                                                ยังไม่มีเงินเพิ่ม
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-1.5">
                                                                {(item.manualIncomes || []).map((income) => (
                                                                    <div key={income.id} className="grid grid-cols-[1fr_86px_26px] gap-1.5">
                                                                        <input
                                                                            type="text"
                                                                            value={income.label}
                                                                            onChange={(e) => updateManualIncome(item.employeeId, income.id, "label", e.target.value)}
                                                                            className="h-8 min-w-0 rounded-md border border-blue-100 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                                            placeholder="ชื่อรายการ"
                                                                        />
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            value={toNumber(income.amount) || ""}
                                                                            onChange={(e) => updateManualIncome(item.employeeId, income.id, "amount", e.target.value)}
                                                                            className="h-8 min-w-0 rounded-md border border-blue-100 bg-white px-2 text-right text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                                            placeholder="0"
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeManualIncome(item.employeeId, income.id)}
                                                                            className="flex h-8 w-6 items-center justify-center rounded-md text-blue-500 hover:bg-blue-100"
                                                                            aria-label="ลบเงินเพิ่ม"
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <div className="mt-2 text-right text-xs text-blue-700">
                                                            รวมเงินเพิ่ม ฿{extraTotal.toLocaleString()}
                                                        </div>
                                                    </div>

                                                    <div className="rounded-lg border border-red-100 bg-red-50/40 p-2">
                                                        <div className="mb-2 flex items-center justify-between gap-2">
                                                            <span className="text-[11px] font-semibold text-red-700">รายการหักเพิ่มเติม</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => addManualDeduction(item.employeeId)}
                                                                className="inline-flex h-7 items-center gap-1 rounded-md border border-red-200 bg-white px-2 text-[11px] font-medium text-red-700 hover:bg-red-50"
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                                เพิ่ม
                                                            </button>
                                                        </div>

                                                        {(item.manualDeductions || []).length === 0 ? (
                                                            <div className="rounded-md border border-dashed border-red-100 bg-white/60 px-2 py-2 text-center text-[11px] text-red-400">
                                                                ยังไม่มีรายการหักเพิ่ม
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-1.5">
                                                                {(item.manualDeductions || []).map((deduction) => (
                                                                    <div key={deduction.id} className="grid grid-cols-[1fr_86px_26px] gap-1.5">
                                                                        <input
                                                                            type="text"
                                                                            value={deduction.label}
                                                                            onChange={(e) => updateManualDeduction(item.employeeId, deduction.id, "label", e.target.value)}
                                                                            className="h-8 min-w-0 rounded-md border border-red-100 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-200"
                                                                            placeholder="ชื่อรายการ"
                                                                        />
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            value={toNumber(deduction.amount) || ""}
                                                                            onChange={(e) => updateManualDeduction(item.employeeId, deduction.id, "amount", e.target.value)}
                                                                            className="h-8 min-w-0 rounded-md border border-red-100 bg-white px-2 text-right text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-200"
                                                                            placeholder="0"
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeManualDeduction(item.employeeId, deduction.id)}
                                                                            className="flex h-8 w-6 items-center justify-center rounded-md text-red-500 hover:bg-red-100"
                                                                            aria-label="ลบรายการหัก"
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <div className="mt-2 text-right text-xs text-red-700">
                                                            รวมหักเพิ่ม ฿{manualDeductionTotal.toLocaleString()}
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        <div className="text-xs text-gray-500">รายรับ ฿{toNumber(item.totalIncome).toLocaleString()}</div>
                                                        <div className="text-xs text-red-600">หัก {toNumber(item.totalDeduction) > 0 ? `฿${toNumber(item.totalDeduction).toLocaleString()}` : "-"}</div>
                                                        {manualDeductionTotal > 0 && (
                                                            <div className="text-[11px] text-red-400">รวมรายการหักเพิ่ม ฿{manualDeductionTotal.toLocaleString()}</div>
                                                        )}
                                                        <div className="mt-2 inline-flex rounded-md border border-emerald-100 bg-emerald-50 px-3 py-1.5 font-mono text-base font-bold text-emerald-700">
                                                            ฿{toNumber(item.netTotal).toLocaleString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
}
