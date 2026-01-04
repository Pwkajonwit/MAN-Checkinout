import { format } from "date-fns";
import { th } from "date-fns/locale";
import { getLateMinutes, formatMinutesToHours } from "@/lib/workTime";

export const generatePayslipPDF = (payrollData: any[], month: Date) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Please allow popups to print the report.");
        return;
    }

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <title>Payslips - ${format(month, "MMMM yyyy")}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
                body { font-family: 'Sarabun', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; font-size: 12px; }
                .page { background: white; width: 210mm; min-height: 297mm; padding: 20mm; margin: 0 auto 20px; box-shadow: 0 0 10px rgba(0,0,0,0.1); box-sizing: border-box; position: relative; }
                @media print {
                    body { background: white; padding: 0; }
                    .page { box-shadow: none; margin: 0; page-break-after: always; }
                }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { margin: 0; font-size: 24px; color: #333; }
                .header p { margin: 5px 0 0; color: #666; }
                .info-box { border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 4px; }
                .row { display: flex; margin-bottom: 8px; }
                .col { flex: 1; }
                .label { font-weight: bold; color: #555; width: 100px; display: inline-block; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { padding: 10px; border-bottom: 1px solid #eee; }
                th { background-color: #f8f9fa; text-align: left; font-weight: bold; color: #333; }
                .amount { text-align: right; }
                .total-row { font-weight: bold; background-color: #f8f9fa; }
                .net-pay { background-color: #e3f2fd; padding: 15px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 18px; font-weight: bold; color: #1565c0; }
                .signature { margin-top: 50px; display: flex; justify-content: space-between; }
                .sign-box { text-align: center; width: 200px; }
                .line { border-bottom: 1px solid #333; margin-bottom: 10px; height: 30px; }
            </style>
        </head>
        <body>
            ${payrollData.map(item => `
                <div class="page">
                    <div class="header">
                        <h1>ใบแจ้งเงินเดือน / Payslip</h1>
                        <p>ประจำเดือน ${format(month, "MMMM yyyy", { locale: th })}</p>
                    </div>

                    <div class="info-box">
                        <div class="row">
                            <div class="col"><span class="label">ชื่อ-สกุล:</span> ${item.name}</div>
                            <div class="col"><span class="label">รหัสพนักงาน:</span> ${item.employeeId}</div>
                        </div>
                        <div class="row">
                            <div class="col"><span class="label">ประเภท:</span> ${item.type}</div>
                            <div class="col"><span class="label">วันที่พิมพ์:</span> ${format(new Date(), "d MMMM yyyy", { locale: th })}</div>
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
                                <td class="amount">${item.baseSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td>หักมาสาย (${item.lateMinutes} นาที)</td>
                                <td class="amount">${item.totalDeduction > 0 ? item.totalDeduction.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}</td>
                            </tr>
                            <tr>
                                <td>ค่าล่วงเวลา ปกติ (${(item.otHoursNormal || 0).toFixed(1)} ชม.)</td>
                                <td class="amount">${(item.otPayNormal || 0) > 0 ? (item.otPayNormal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}</td>
                                <td></td>
                                <td class="amount"></td>
                            </tr>
                            <tr>
                                <td>ค่าล่วงเวลา วันหยุด (${(item.otHoursHoliday || 0).toFixed(1)} ชม.)</td>
                                <td class="amount">${(item.otPayHoliday || 0) > 0 ? (item.otPayHoliday || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}</td>
                                <td></td>
                                <td class="amount"></td>
                            </tr>
                            <tr style="height: 100px;"><td></td><td></td><td></td><td></td></tr>
                            <tr class="total-row">
                                <td>รวมรายได้</td>
                                <td class="amount">${item.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td>รวมรายการหัก</td>
                                <td class="amount">${item.totalDeduction.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="net-pay">
                        <span>เงินได้สุทธิ (Net Pay)</span>
                        <span>${item.netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</span>
                    </div>

                    <div class="signature">
                        <div class="sign-box"><div class="line"></div><div>ลายเซ็นพนักงาน</div></div>
                        <div class="sign-box"><div class="line"></div><div>ผู้มีอำนาจลงนาม</div></div>
                    </div>
                </div>
            `).join('')}
            <script>window.onload = () => window.print();</script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
};

export const generateAttendancePDF = (
    employeeName: string,
    attendances: any[],
    otRequests: any[] = [],
    summary: {
        totalDays: number;
        attendanceDays: number;
        leaveDays: number;
        absentDays: number;
        lateCount: number;
        lateMinutes: number;
        totalOTHours: number;
    } = { totalDays: 0, attendanceDays: 0, leaveDays: 0, absentDays: 0, lateCount: 0, lateMinutes: 0, totalOTHours: 0 },
    leaves: any[] = [],
    swapRequests: any[] = []
) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Please allow popups to print the report.");
        return;
    }

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <title>Attendance Report - ${employeeName}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
                body { font-family: 'Sarabun', sans-serif; padding: 20px; font-size: 11px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: middle; }
                th { background-color: #f8f9fa; color: #333; font-weight: bold; font-size: 12px; }
                h1 { margin-bottom: 5px; font-size: 20px; }
                .meta { margin-bottom: 20px; color: #666; font-size: 10px; }
                .status-late { color: #dc2626; font-weight: bold; }
                .status-checkin { color: #16a34a; font-weight: bold; }
                .status-checkout { color: #2563eb; font-weight: bold; }
                .status-offsite { color: #9333ea; font-weight: bold; }
                .status-break { color: #d97706; }
                .status-ot { color: #0891b2; font-weight: bold; }
                .note { color: #666; font-style: italic; font-size: 10px; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .center { text-align: center; }
                .right { text-align: right; }
                .summary-box { 
                    display: flex; 
                    gap: 15px; 
                    margin-bottom: 20px; 
                    padding: 15px; 
                    background-color: #f8f9fa; 
                    border-radius: 8px; 
                    border: 1px solid #eee;
                }
                .summary-item { 
                    flex: 1; 
                    text-align: center; 
                    border-right: 1px solid #ddd;
                }
                .summary-item:last-child { border-right: none; }
                .summary-value { font-size: 18px; font-weight: bold; color: #333; }
                .summary-label { font-size: 10px; color: #666; }
            </style>
        </head>
        <body>
            <h1>รายงานการลงเวลา: ${employeeName}</h1>
            <div class="meta">พิมพ์ข้อมูล ณ วันที่: ${format(new Date(), "d MMMM yyyy HH:mm", { locale: th })}</div>

             <div class="summary-box">
                <div class="summary-item">
                    <div class="summary-value">${summary.attendanceDays}</div>
                    <div class="summary-label">วันมาทำงาน</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${summary.leaveDays}</div>
                    <div class="summary-label">วันลา</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${summary.absentDays}</div>
                    <div class="summary-label">วันขาด</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${summary.lateCount}</div>
                    <div class="summary-label">สาย (ครั้ง)</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value" style="color: #dc2626;">${formatMinutesToHours(summary.lateMinutes)}</div>
                    <div class="summary-label">รวมเวลาสาย</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value" style="color: #0891b2;">${formatMinutesToHours(summary.totalOTHours)}</div>
                    <div class="summary-label">รวม OT (ชม.)</div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 12%">วันที่</th>
                        <th style="width: 8%" class="center">เวลาเข้า</th>
                        <th style="width: 8%" class="center">เวลาออก</th>
                        <th style="width: 10%" class="center">สถานะ</th>
                        <th style="width: 8%" class="center">สาย (นาที)</th>
                        <th style="width: 8%" class="center">OT (ชม.)</th>
                        <th style="width: 20%">สถานที่</th>
                        <th style="width: 26%">หมายเหตุ</th>
                    </tr>
                </thead>
                <tbody>
                    ${attendances.map((a: any) => {
        const checkIn = a.checkIn ? new Date(a.checkIn) : null;
        const checkOut = a.checkOut ? new Date(a.checkOut) : null;
        const date = a.date ? new Date(a.date) : null;
        const dateStr = date ? format(date, "yyyy-MM-dd") : "";

        // Format Times
        const timeIn = checkIn ? format(checkIn, "HH:mm") : "-";
        const timeOut = checkOut ? format(checkOut, "HH:mm") : "-";

        // Calculate Late
        const lateMinutes = (a.status === "สาย" || a.lateMinutes > 0) ? (a.lateMinutes || (checkIn ? getLateMinutes(checkIn) : 0)) : 0;

        // Calculate OT
        let otHours = 0;
        const otReq = otRequests.find(ot =>
            format(new Date(ot.date), "yyyy-MM-dd") === dateStr && ot.status === "อนุมัติ"
        );
        if (otReq && otReq.startTime && otReq.endTime) {
            const start = otReq.startTime instanceof Date ? otReq.startTime : new Date(otReq.startTime);
            const end = otReq.endTime instanceof Date ? otReq.endTime : new Date(otReq.endTime);
            otHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }

        // Status class
        let statusClass = "";
        if (a.status === "สาย" || lateMinutes > 0) statusClass = "status-late";
        else if (a.status === "เข้างาน") statusClass = "status-checkin";
        else if (a.status === "ออกงาน") statusClass = "status-checkout";
        else if (a.status?.includes("ออกนอกพื้นที่")) statusClass = "status-offsite";
        else if (a.status?.includes("พัก")) statusClass = "status-break";

        return `
                        <tr>
                            <td>${date ? format(date, "d MMM yyyy", { locale: th }) : "-"}</td>
                            <td class="center">${timeIn}</td>
                            <td class="center">${timeOut}</td>
                            <td class="center ${statusClass}">${a.status}</td>
                            <td class="center ${lateMinutes > 0 ? "status-late" : ""}">${lateMinutes > 0 ? lateMinutes : "-"}</td>
                            <td class="center ${otHours > 0 ? "status-ot" : ""}">${otHours > 0 ? otHours.toFixed(1) : "-"}</td>
                            <td>${a.location || "-"}</td>
                            <td><span class="note">${a.locationNote || "-"}</span></td>
                        </tr>
                        `;
    }).join('')}
                </tbody>
            </table>

            <h3>ประวัติการลา</h3>
            <table>
                <thead>
                    <tr>
                         <th style="width: 15%">วันที่ยื่น</th>
                         <th style="width: 15%">ประเภท</th>
                         <th style="width: 25%">วันที่ลา</th>
                         <th style="width: 10%" class="center">จำนวน (วัน)</th>
                         <th style="width: 25%">เหตุผล</th>
                         <th style="width: 10%" class="center">สถานะ</th>
                    </tr>
                </thead>
                <tbody>
                    ${leaves.length > 0 ? leaves.map((l: any) => {
        const start = l.startDate instanceof Date ? l.startDate : new Date(l.startDate);
        const end = l.endDate instanceof Date ? l.endDate : new Date(l.endDate);
        const created = l.createdAt ? (l.createdAt instanceof Date ? l.createdAt : (l.createdAt as any).toDate()) : null;
        const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        return `
                        <tr>
                            <td>${created ? format(created, "d MMM yyyy", { locale: th }) : "-"}</td>
                            <td>${l.leaveType}</td>
                            <td>${format(start, "d MMM yyyy", { locale: th })} - ${format(end, "d MMM yyyy", { locale: th })}</td>
                            <td class="center">${days}</td>
                            <td><span class="note">${l.reason || "-"}</span></td>
                            <td class="center">${l.status}</td>
                        </tr>
                        `;
    }).join('') : '<tr><td colspan="6" class="center note">ไม่มีประวัติการลา</td></tr>'}
                </tbody>
            </table>

            <h3>ประวัติการขอ OT</h3>
             <table>
                <thead>
                    <tr>
                         <th style="width: 15%">วันที่</th>
                         <th style="width: 20%">เวลา</th>
                         <th style="width: 15%" class="center">จำนวน (ชม.)</th>
                         <th style="width: 40%">เหตุผล</th>
                         <th style="width: 10%" class="center">สถานะ</th>
                    </tr>
                </thead>
                <tbody>
                    ${otRequests.length > 0 ? otRequests.map((ot: any) => {
        if (!ot.startTime || !ot.endTime) return '';
        const start = ot.startTime instanceof Date ? ot.startTime : new Date(ot.startTime);
        const end = ot.endTime instanceof Date ? ot.endTime : new Date(ot.endTime);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

        return `
                        <tr>
                            <td>${format(new Date(ot.date), "d MMM yyyy", { locale: th })}</td>
                            <td>${format(start, "HH:mm")} - ${format(end, "HH:mm")}</td>
                            <td class="center">${hours.toFixed(1)}</td>
                            <td><span class="note">${ot.reason || "-"}</span></td>
                            <td class="center">${ot.status}</td>
                        </tr>
                        `;
    }).join('') : '<tr><td colspan="5" class="center note">ไม่มีประวัติการขอ OT</td></tr>'}
                </tbody>
            </table>

            <h3>ประวัติการสลับวันหยุด</h3>
             <table>
                <thead>
                    <tr>
                         <th style="width: 15%">วันที่ยื่น</th>
                         <th style="width: 25%">วันหยุดเดิม (มาทำ)</th>
                         <th style="width: 25%">วันหยุดใหม่ (ขอหยุด)</th>
                         <th style="width: 25%">เหตุผล</th>
                         <th style="width: 10%" class="center">สถานะ</th>
                    </tr>
                </thead>
                <tbody>
                    ${swapRequests.length > 0 ? swapRequests.map((s: any) => {
        const workDate = s.workDate instanceof Date ? s.workDate : (s.workDate as any).toDate();
        const holidayDate = s.holidayDate instanceof Date ? s.holidayDate : (s.holidayDate as any).toDate();
        const created = s.createdAt ? (s.createdAt instanceof Date ? s.createdAt : (s.createdAt as any).toDate()) : null;

        return `
                        <tr>
                            <td>${created ? format(created, "d MMM yyyy", { locale: th }) : "-"}</td>
                            <td>${format(workDate, "d MMM yyyy", { locale: th })}</td>
                            <td>${format(holidayDate, "d MMM yyyy", { locale: th })}</td>
                            <td><span class="note">${s.reason || "-"}</span></td>
                            <td class="center">${s.status}</td>
                        </tr>
                        `;
    }).join('') : '<tr><td colspan="5" class="center note">ไม่มีประวัติการสลับวันหยุด</td></tr>'}
                </tbody>
            </table>
            <div style="margin-top: 20px; font-size: 10px; color: #999; text-align: center;">
                รายงานนี้ถูกสร้างขึ้นโดยอัตโนมัติจากระบบ Check In/Out
            </div>
            <script>window.onload = () => window.print();</script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
};
