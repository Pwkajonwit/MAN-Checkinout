import { NextResponse } from "next/server";
import { systemConfigService, employeeService, attendanceService, swapService } from "@/lib/firestore";

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic';

const THAI_TIME_ZONE = "Asia/Bangkok";

const getBangkokDateParts = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: THAI_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

    const getPart = (type: string) => Number(parts.find(part => part.type === type)?.value);
    return {
        year: getPart("year"),
        month: getPart("month"),
        day: getPart("day"),
    };
};

const getBangkokDateKey = (date: Date) => {
    const { year, month, day } = getBangkokDateParts(date);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const getBangkokDayRange = (date: Date) => {
    const { year, month, day } = getBangkokDateParts(date);
    const start = new Date(Date.UTC(year, month - 1, day, -7, 0, 0, 0));
    const end = new Date(Date.UTC(year, month - 1, day + 1, -7, 0, 0, -1));
    return { start, end };
};

const getBangkokDayRangeFromKey = (dateKey: string) => {
    const [year, month, day] = dateKey.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, day, -7, 0, 0, 0));
    const end = new Date(Date.UTC(year, month - 1, day + 1, -7, 0, 0, -1));
    return { start, end };
};

const getBangkokDayOfWeek = (date: Date) => {
    const { year, month, day } = getBangkokDateParts(date);
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

const getBangkokDayOfWeekFromKey = (dateKey: string) => {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

const isValidDateKey = (dateKey: string) => /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && !Number.isNaN(new Date(`${dateKey}T00:00:00+07:00`).getTime());

const formatNameList = (names: string[]) => {
    if (names.length === 0) return "-";
    const visibleNames = names.slice(0, 20);
    const extraCount = names.length - visibleNames.length;
    return extraCount > 0
        ? `${visibleNames.join(", ")} และอีก ${extraCount} คน`
        : visibleNames.join(", ");
};

const createSummaryRow = (label: string, value: string, color: string, margin: "md" | "sm" = "sm") => ({
    type: "box",
    layout: "horizontal",
    contents: [
        { type: "text", text: label, size: "sm", color: "#555555", flex: 1 },
        { type: "text", text: value, size: "sm", color, weight: "bold", align: "end" }
    ],
    margin
});

const createNameSection = (label: string, names: string[], color: string) => ({
    type: "box",
    layout: "vertical",
    margin: "md",
    contents: [
        {
            type: "text",
            text: `${label} (${names.length} คน)`,
            size: "sm",
            weight: "bold",
            color,
        },
        {
            type: "text",
            text: formatNameList(names),
            size: "xs",
            color: "#475569",
            margin: "xs",
            wrap: true,
        }
    ]
});

export async function GET(request: Request) {
    // Verify Vercel Cron signature (Optional but recommended)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Allow manual testing if needed, or enforce strict security
        // return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 1. Get System Config
        const config = await systemConfigService.get();
        if (!config?.enableDailyReport) {
            return NextResponse.json({ success: true, message: 'Daily report is disabled' });
        }
        if (!config?.adminLineGroupId) {
            return NextResponse.json({ success: false, message: 'Admin Line Group ID not configured' });
        }

        // 2. Get data using the same source as /admin/summary
        const url = new URL(request.url);
        const requestedDate = url.searchParams.get("date");
        if (requestedDate && !isValidDateKey(requestedDate)) {
            return NextResponse.json({ success: false, message: "Invalid date format. Use YYYY-MM-DD." }, { status: 400 });
        }

        const now = new Date();
        const dateKey = requestedDate || getBangkokDateKey(now);
        const { start: todayStart, end: todayEnd } = requestedDate
            ? getBangkokDayRangeFromKey(requestedDate)
            : getBangkokDayRange(now);
        const reportDay = new Date(`${dateKey}T00:00:00+07:00`);
        const reportDayOfWeek = requestedDate
            ? getBangkokDayOfWeekFromKey(requestedDate)
            : getBangkokDayOfWeek(now);
        const reportDate = reportDay.toLocaleDateString('th-TH', {
            timeZone: THAI_TIME_ZONE,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const [employees, attendances, allSwaps] = await Promise.all([
            employeeService.getAll(),
            attendanceService.getByDateRange(todayStart, todayEnd),
            swapService.getAll(),
        ]);

        const activeEmployees = employees.filter(employee => employee.status === "ทำงาน");
        const approvedSwaps = allSwaps.filter(swap => swap.status === "อนุมัติ");
        const globalHolidays = config.weeklyHolidays || [0, 6];
        const useIndividualHolidays = config.useIndividualHolidays ?? false;

        const absentNames: string[] = [];
        const swapHolidayNames: string[] = [];
        const systemHolidayNames: string[] = [];
        let normalCount = 0;
        let lateCount = 0;

        activeEmployees.forEach((employee) => {
            if (!employee.id) return;

            const employeeAttendances = attendances.filter(attendance => attendance.employeeId === employee.id);
            const checkInRecord = employeeAttendances.find(attendance => attendance.status === "เข้างาน");
            const lateRecord = employeeAttendances.find(attendance => attendance.status === "สาย");
            const hasCheckedIn = Boolean(checkInRecord || lateRecord);

            const applicableHolidays = useIndividualHolidays
                ? employee.weeklyHolidays || globalHolidays
                : globalHolidays;
            const isWeeklyHoliday = applicableHolidays.includes(reportDayOfWeek);

            const employeeSwaps = approvedSwaps.filter(swap => swap.employeeId === employee.id);
            const hasSwapWorkToday = employeeSwaps.some(swap => getBangkokDateKey(new Date(swap.workDate)) === dateKey);
            const hasSwapHolidayToday = employeeSwaps.some(swap => getBangkokDateKey(new Date(swap.holidayDate)) === dateKey);

            if (hasSwapHolidayToday) {
                swapHolidayNames.push(employee.name);
                return;
            }

            if (isWeeklyHoliday && !hasSwapWorkToday) {
                systemHolidayNames.push(employee.name);
                return;
            }

            const actualLateMinutes = lateRecord?.lateMinutes || checkInRecord?.lateMinutes || 0;
            if (lateRecord || actualLateMinutes > 0) {
                lateCount++;
                return;
            }

            if (hasCheckedIn) {
                normalCount++;
                return;
            }

            absentNames.push(employee.name);
        });

        // 4. Send Line Message
        const message = {
            to: config.adminLineGroupId,
            messages: [
                {
                    type: "flex",
                    altText: `สรุปการลงเวลาประจำวัน ${reportDate}`,
                    contents: {
                        type: "bubble",
                        header: {
                            type: "box",
                            layout: "vertical",
                            contents: [
                                {
                                    type: "text",
                                    text: "สรุปการลงเวลาประจำวัน",
                                    weight: "bold",
                                    color: "#1DB446",
                                    size: "sm"
                                },
                                {
                                    type: "text",
                                    text: reportDate,
                                    weight: "bold",
                                    size: "md",
                                    margin: "md",
                                    wrap: true
                                }
                            ]
                        },
                        body: {
                            type: "box",
                            layout: "vertical",
                            contents: [
                                createSummaryRow("พนักงานทั้งหมด", `${activeEmployees.length} คน`, "#111111", "md"),
                                { type: "separator", margin: "md" },
                                createSummaryRow("ปกติ", `${normalCount} คน`, "#22c55e", "md"),
                                createSummaryRow("สาย", `${lateCount} คน`, "#f97316"),
                                createSummaryRow("ไม่มา", `${absentNames.length} คน`, "#ef4444"),
                                createSummaryRow("สลับหยุด", `${swapHolidayNames.length} คน`, "#8b5cf6"),
                                createSummaryRow("หยุดตามระบบ", `${systemHolidayNames.length} คน`, "#64748b"),
                                { type: "separator", margin: "md" },
                                createNameSection("1. ไม่มา", absentNames, "#ef4444"),
                                createNameSection("2. สลับหยุด", swapHolidayNames, "#8b5cf6"),
                                createNameSection("3. หยุดตามระบบ", systemHolidayNames, "#64748b")
                            ]
                        }
                    }
                }
            ]
        };

        const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        if (!channelAccessToken) {
            throw new Error("LINE_CHANNEL_ACCESS_TOKEN not configured");
        }

        const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${channelAccessToken}`
            },
            body: JSON.stringify(message)
        });

        if (!lineRes.ok) {
            const errorText = await lineRes.text();
            console.error("Line API Error:", errorText);
            return NextResponse.json({ success: false, message: 'Failed to send Line message', error: errorText }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            data: {
                total: activeEmployees.length,
                normal: normalCount,
                late: lateCount,
                absent: absentNames,
                swapHoliday: swapHolidayNames,
                systemHoliday: systemHolidayNames
            }
        });

    } catch (error) {
        console.error("Cron Job Error:", error);
        return NextResponse.json({ success: false, message: 'Internal Server Error', error: String(error) }, { status: 500 });
    }
}
