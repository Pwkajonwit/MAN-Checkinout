import { format } from "date-fns";
import { th } from "date-fns/locale";
import { getLateMinutes } from "@/lib/workTime";

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

export const generateAttendancePDF = (employeeName: string, attendances: any[]) => {
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
                body { font-family: 'Sarabun', sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                h1 { margin-bottom: 10px; }
                .meta { margin-bottom: 20px; color: #666; }
                .status-late { color: #dc2626; font-weight: bold; }
                .status-normal { color: #16a34a; }
            </style>
        </head>
        <body>
            <h1>รายงานการลงเวลา: ${employeeName}</h1>
            <div class="meta">พิมพ์เมื่อ: ${format(new Date(), "d MMMM yyyy HH:mm", { locale: th })}</div>
            <table>
                <thead>
                    <tr>
                        <th>วันที่</th>
                        <th>สถานะ</th>
                        <th>เข้างาน</th>
                        <th>ออกงาน</th>
                        <th>สาย (นาที)</th>
                    </tr>
                </thead>
                <tbody>
                    ${attendances.map((a: any) => {
        const checkIn = a.checkIn ? new Date(a.checkIn) : null;
        const checkOut = a.checkOut ? new Date(a.checkOut) : null;
        const date = a.date ? new Date(a.date) : null;
        const lateMinutes = checkIn && a.status === "สาย" ? getLateMinutes(checkIn) : 0;

        return `
                        <tr>
                            <td>${date ? format(date, "d MMM yyyy", { locale: th }) : "-"}</td>
                            <td class="${a.status === 'สาย' ? 'status-late' : 'status-normal'}">${a.status}</td>
                            <td>${checkIn ? format(checkIn, "HH:mm") : "-"}</td>
                            <td>${checkOut ? format(checkOut, "HH:mm") : "-"}</td>
                            <td>${lateMinutes > 0 ? lateMinutes : "-"}</td>
                        </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
            <script>window.onload = () => window.print();</script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
}
