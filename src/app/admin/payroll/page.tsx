"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { employeeService, attendanceService, otService, systemConfigService, type Employee, type Attendance, type OTRequest, type SystemConfig } from "@/lib/firestore";
import { Search, Calendar, DollarSign, Download, Filter } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { th } from "date-fns/locale";
import { getLateMinutes } from "@/lib/workTime";
import { generatePayslipPDF } from "@/lib/pdfGenerator";

interface PayrollItem {
    employeeId: string;
    name: string;
    type: string;
    baseSalary: number;
    workDays: number;
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
    totalIncome: number;
    totalDeduction: number;
    netTotal: number;
}

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

    useEffect(() => {
        const loadData = async () => {
            const sysConfig = await systemConfigService.get();
            setConfig(sysConfig);

            // Load departments
            const employees = await employeeService.getAll();
            const uniqueDepts = Array.from(new Set(employees.map(e => e.department).filter(Boolean))) as string[];
            setDepartments(uniqueDepts.sort());
        };
        loadData();
    }, []);

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

    const handlePrint = () => {
        const selectedData = payrollData.filter(item => selectedIds.includes(item.employeeId));
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
                                    <td class="amount">${item.totalDeduction > 0 ? item.totalDeduction.toLocaleString() : "-"}</td>
                                </tr>
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
                                <!-- Add more rows if needed -->
                                <tr style="height: 100px;">
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

            // 3. Fetch Data & Calculate
            const results: PayrollItem[] = [];

            // Use config values or defaults
            const otMultiplier = config?.otMultiplier ?? 1.5;
            const otMultiplierHoliday = config?.otMultiplierHoliday ?? 3.0;
            const weeklyHolidays = config?.weeklyHolidays ?? [0, 6];
            const lateDeductionType = config?.lateDeductionType ?? "pro-rated";
            const lateDeductionRate = config?.lateDeductionRate ?? 0;

            for (const emp of targetEmployees) {
                if (!emp.id) continue;

                const checkInConfig = {
                    hour: config?.checkInHour ?? 9,
                    minute: config?.checkInMinute ?? 0,
                    gracePeriod: config?.lateGracePeriod ?? 0
                };

                // Fetch Attendance & OT
                const [attendance, otRequests] = await Promise.all([
                    attendanceService.getHistory(emp.id, startDate, endDate),
                    otService.getByEmployeeId(emp.id)
                ]);

                // Filter OT by date and status
                const approvedOT = otRequests.filter(ot =>
                    ot.status === "อนุมัติ" &&
                    ot.date &&
                    ot.date >= startDate &&
                    ot.date <= endDate
                );

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

                const workDays = dailyAttendance.size;
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
                const baseSalary = emp.baseSalary || 0;
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
                        const hDate = h.date instanceof Date ? h.date : (h.date as any).toDate();
                        return format(hDate, "yyyy-MM-dd") === dateKey;
                    });

                    if (customHoliday) {
                        // Assume 8 hours work day for simplicity, or calculate from check-in/out if needed
                        // For now, using standard 8 hours if they showed up
                        const hours = 8;
                        customHolidayWorkHours += hours;

                        // Calculate extra pay based on multiplier
                        // Note: Base pay (1x) is already included in salary/daily wage
                        // So we add the extra portion: (multiplier - 1)
                        if (customHoliday.workdayMultiplier > 1) {
                            const extraMultiplier = customHoliday.workdayMultiplier - 1;
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
                            const hDate = h.date instanceof Date ? h.date : (h.date as any).toDate();
                            return format(hDate, "yyyy-MM-dd") === otDateStr;
                        });

                        if (customHoliday) {
                            otHoursSpecial += hours;
                            otPaySpecial += hours * hourlyRate * customHoliday.otMultiplier;
                        } else {
                            const dayOfWeek = ot.date.getDay();
                            const isHoliday = weeklyHolidays.includes(dayOfWeek);

                            if (isHoliday) {
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
        <div>
            <PageHeader
                title="คำนวณเงินเดือน"
                subtitle="จัดการและคำนวณเงินเดือนพนักงาน"
            />

            {/* Controls */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-6 items-end">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">ประเภทพนักงาน</label>
                    <div className="flex gap-2">
                        {(["ประจำ - รายเดือน", "ประจำ - รายวัน", "ชั่วคราว"] as const).map((type) => (
                            <button
                                key={type}
                                onClick={() => setEmployeeType(type)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${employeeType === type
                                    ? "bg-[#000000] text-white shadow-lg shadow-[#000000]/20"
                                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                                    }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">แผนก/สังกัด</label>
                    <select
                        value={selectedDepartment}
                        onChange={(e) => setSelectedDepartment(e.target.value)}
                        className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] bg-white min-w-[150px]"
                    >
                        <option value="all">ทั้งหมด</option>
                        {departments.map((dept) => (
                            <option key={dept} value={dept}>
                                {dept}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">รูปแบบการคำนวณ</label>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCalculationPeriod("month")}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${calculationPeriod === "month"
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                                }`}
                        >
                            รายเดือน
                        </button>
                        <button
                            onClick={() => setCalculationPeriod("custom")}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${calculationPeriod === "custom"
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                                }`}
                        >
                            กำหนดช่วงเวลา
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                        {calculationPeriod === "month" ? "ประจำเดือน" : "เลือกช่วงวันที่"}
                    </label>

                    {calculationPeriod === "month" ? (
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="month"
                                value={format(selectedDate, "yyyy-MM")}
                                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                                className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA]"
                            />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <input
                                    type="date"
                                    value={format(customRange.start, "yyyy-MM-dd")}
                                    onChange={(e) => setCustomRange({ ...customRange, start: new Date(e.target.value) })}
                                    className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA]"
                                />
                            </div>
                            <span className="text-gray-400">-</span>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={format(customRange.end, "yyyy-MM-dd")}
                                    onChange={(e) => setCustomRange({ ...customRange, end: new Date(e.target.value) })}
                                    className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA]"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <button
                    onClick={calculatePayroll}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                    <DollarSign className="w-4 h-4" />
                    {loading ? "กำลังคำนวณ..." : "คำนวณเงินเดือน"}
                </button>

                {payrollData.length > 0 && (
                    <button
                        onClick={handlePrint}
                        disabled={selectedIds.length === 0}
                        className="px-6 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="w-4 h-4" />
                        พิมพ์/บันทึก สลิป ({selectedIds.length})
                    </button>
                )}
            </div>

            {/* Config Summary */}
            {config && (
                <div className="bg-blue-50 mt-1 rounded-xl p-4 text-sm text-blue-800 flex flex-wrap gap-y-2 gap-x-6">
                    <div>
                        <span className="font-medium">เวลาทำงาน:</span> {config.checkInHour.toString().padStart(2, '0')}:{config.checkInMinute.toString().padStart(2, '0')} - {config.checkOutHour.toString().padStart(2, '0')}:{config.checkOutMinute.toString().padStart(2, '0')}
                    </div>
                    <div>
                        <span className="font-medium">สายได้:</span> {config.lateGracePeriod} นาที
                    </div>
                    <div>
                        <span className="font-medium">OT ขั้นต่ำ:</span> {config.minOTMinutes} นาที
                    </div>
                    <div>
                        <span className="font-medium">OT ปกติ:</span> {config.otMultiplier ?? 1.5} เท่า
                    </div>
                    <div>
                        <span className="font-medium">OT วันหยุด:</span> {config.otMultiplierHoliday ?? 3.0} เท่า
                    </div>
                    <div>
                        <span className="font-medium">วันหยุด:</span> {(config.weeklyHolidays || []).map(d => ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"][d]).join(", ")}
                    </div>
                    <div>
                        <span className="font-medium">การหักสาย:</span> {
                            config.lateDeductionType === "none" ? "ไม่หัก" :
                                config.lateDeductionType === "fixed_per_minute" ? `นาทีละ ${config.lateDeductionRate} บาท` :
                                    "หักตามจริง (Pro-rated)"
                        }
                    </div>
                </div>
            )}

            {/* Results */}
            {payrollData.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-800">ผลการคำนวณ</h3>
                        <div className="text-sm text-gray-500">
                            รวมจ่ายสุทธิ: <span className="text-green-600 font-bold text-lg ml-2">
                                ฿{payrollData.reduce((sum, item) => sum + item.netTotal, 0).toLocaleString()}
                            </span>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50/50">
                                <tr>
                                    <th className="px-6 py-4 text-left">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === payrollData.length && payrollData.length > 0}
                                            onChange={handleSelectAll}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">พนักงาน</th>
                                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">วันทำงาน</th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ฐานเงินเดือน/ค่าจ้าง</th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">OT ปกติ (ชม.)</th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">OT วันหยุด (ชม.)</th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">OT พิเศษ (ชม.)</th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">วันหยุดพิเศษ (ชม.)</th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">สาย (นาที)</th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">รายรับรวม</th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">หัก</th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">สุทธิ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {payrollData.map((item) => (
                                    <tr key={item.employeeId} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(item.employeeId)}
                                                onChange={() => handleSelectOne(item.employeeId)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{item.name}</div>
                                            <div className="text-xs text-gray-500">{item.employeeId}</div>
                                            <div className={`text-[10px] px-2 py-0.5 rounded-full inline-block mt-1 ${item.type === 'รายเดือน'
                                                ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                                : 'bg-orange-50 text-orange-600 border border-orange-100'
                                                }`}>
                                                {item.type}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-600">{item.workDays}</td>
                                        <td className="px-6 py-4 text-right text-gray-600">
                                            {item.baseSalary.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-600">
                                            {item.otHoursNormal.toFixed(0)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-600">
                                            {item.otHoursHoliday.toFixed(0)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-600">
                                            {item.otHoursSpecial.toFixed(0)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-600">
                                            {item.customHolidayWorkHours.toFixed(0)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-red-500">
                                            {item.lateMinutes}
                                        </td>
                                        <td className="px-6 py-4 text-right text-green-600 font-medium">
                                            {item.totalIncome.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right text-red-600 font-medium">
                                            {item.totalDeduction.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-gray-900">
                                            {item.netTotal.toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
