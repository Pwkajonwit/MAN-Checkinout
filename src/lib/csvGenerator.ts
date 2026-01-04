import { format } from "date-fns";
import { th } from "date-fns/locale";
import { getLateMinutes } from "@/lib/workTime";

export const generateAttendanceCSV = (
    employeeName: string,
    attendances: any[],
    otRequests: any[],
    summary: {
        totalDays: number;
        attendanceDays: number;
        leaveDays: number;
        absentDays: number;
        lateCount: number;
        lateMinutes: number;
        totalOTHours: number;
    },
    leaves: any[] = [],
    swapRequests: any[] = []
) => {
    // BOM for Thai support in Excel
    const BOM = "\uFEFF";
    let csvContent = BOM + "รายงานการลงเวลา\n";
    csvContent += `ชื่อพนักงาน,${employeeName}\n`;
    csvContent += `วันที่พิมพ์,${format(new Date(), "d MMMM yyyy HH:mm", { locale: th })}\n\n`;

    // Summary Section
    csvContent += "สรุปข้อมูล\n";
    csvContent += `วันทำงานทั้งหมด,${summary.totalDays},วัน\n`;
    csvContent += `มาทำงาน,${summary.attendanceDays},วัน\n`;
    csvContent += `ลา,${summary.leaveDays},วัน\n`;
    csvContent += `ขาดงาน,${summary.absentDays},วัน\n`;
    csvContent += `สาย,${summary.lateCount},ครั้ง,รวม,${summary.lateMinutes},นาที\n`;
    csvContent += `OT,${(summary.totalOTHours / 60).toFixed(2)},ชั่วโมง\n\n`;

    // Table Header
    csvContent += "วันที่,เวลาเข้า,เวลาออก,สถานะ,สาย (นาที),OT (ชม.),สถานที่,หมายเหตุ\n";

    // Table Data
    attendances.forEach((a) => {
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

        const row = [
            date ? format(date, "d MMM yyyy", { locale: th }) : "-",
            timeIn,
            timeOut,
            a.status,
            lateMinutes > 0 ? lateMinutes : "-",
            otHours > 0 ? otHours.toFixed(1) : "-",
            `"${a.location || "-"}"`, // Quote location to handle commas
            `"${a.locationNote || "-"}"`
        ].join(",");

        csvContent += row + "\n";
    });

    // Leave History
    csvContent += "\nประวัติการลา\n";
    csvContent += "วันที่ยื่น,ประเภท,วันที่ลา,จำนวนวัน,เหตุผล,สถานะ\n";
    leaves.forEach(l => {
        const start = l.startDate instanceof Date ? l.startDate : new Date(l.startDate);
        const end = l.endDate instanceof Date ? l.endDate : new Date(l.endDate);
        const created = l.createdAt ? (l.createdAt instanceof Date ? l.createdAt : (l.createdAt as any).toDate()) : null;

        // Calculate days
        const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        csvContent += [
            created ? format(created, "d MMM yyyy", { locale: th }) : "-",
            l.leaveType,
            `${format(start, "d MMM yyyy", { locale: th })} - ${format(end, "d MMM yyyy", { locale: th })}`,
            days,
            `"${l.reason || "-"}"`,
            l.status
        ].join(",") + "\n";
    });

    // OT History
    csvContent += "\nประวัติการขอ OT\n";
    csvContent += "วันที่,เวลา,จำนวนชั่วโมง,เหตุผล,สถานะ\n";
    otRequests.forEach(ot => {
        if (!ot.startTime || !ot.endTime) return;
        const start = ot.startTime instanceof Date ? ot.startTime : new Date(ot.startTime);
        const end = ot.endTime instanceof Date ? ot.endTime : new Date(ot.endTime);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

        csvContent += [
            format(new Date(ot.date), "d MMM yyyy", { locale: th }),
            `${format(start, "HH:mm")} - ${format(end, "HH:mm")}`,
            hours.toFixed(1),
            `"${ot.reason || "-"}"`,
            ot.status
        ].join(",") + "\n";
    });

    // Swap History
    csvContent += "\nประวัติการสลับวันหยุด\n";
    csvContent += "วันที่ยื่น,วันหยุดเดิม,วันหยุดใหม่,เหตุผล,สถานะ\n";
    swapRequests.forEach(s => {
        const workDate = s.workDate instanceof Date ? s.workDate : (s.workDate as any).toDate();
        const holidayDate = s.holidayDate instanceof Date ? s.holidayDate : (s.holidayDate as any).toDate();
        const created = s.createdAt ? (s.createdAt instanceof Date ? s.createdAt : (s.createdAt as any).toDate()) : null;

        csvContent += [
            created ? format(created, "d MMM yyyy", { locale: th }) : "-",
            format(workDate, "d MMM yyyy", { locale: th }),
            format(holidayDate, "d MMM yyyy", { locale: th }),
            `"${s.reason || "-"}"`,
            s.status
        ].join(",") + "\n";
    });

    // Create Download Link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_report_${employeeName}_${format(new Date(), "yyyyMMdd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
