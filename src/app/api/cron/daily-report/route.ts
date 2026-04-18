import { NextResponse } from "next/server";
import { systemConfigService, employeeService, attendanceService } from "@/lib/firestore";
import { isLate } from "@/lib/workTime";

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic';

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

        // 2. Get All Employees
        const employees = await employeeService.getAll();
        const totalEmployees = employees.length;

        // 3. Get Today's Attendance
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        let presentCount = 0;
        let lateCount = 0;
        let leaveCount = 0;
        let absentCount = 0;

        const reportDate = todayStart.toLocaleDateString('th-TH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Parallel fetch for performance
        const attendancePromises = employees.map(async (emp) => {
            if (!emp.id) return null;
            try {
                const history = await attendanceService.getHistory(emp.id, todayStart, todayEnd);
                // Find check-in record
                const checkInRecord = history.find(h => h.status === "เข้างาน");
                const leaveRecord = history.find(h => h.status === "ลางาน");

                if (leaveRecord) {
                    return "leave";
                } else if (checkInRecord) {
                    if (isLate(checkInRecord.date)) {
                        return "late";
                    }
                    return "present";
                } else {
                    return "absent";
                }
            } catch (e) {
                console.error(`Error fetching attendance for ${emp.name}:`, e);
                return "error";
            }
        });

        const results = await Promise.all(attendancePromises);

        results.forEach(status => {
            if (status === "present") presentCount++;
            else if (status === "late") {
                lateCount++;
                presentCount++; // Late is also present
            }
            else if (status === "leave") leaveCount++;
            else if (status === "absent") absentCount++;
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
                                {
                                    type: "box",
                                    layout: "horizontal",
                                    contents: [
                                        { type: "text", text: "พนักงานทั้งหมด", size: "sm", color: "#555555", flex: 1 },
                                        { type: "text", text: `${totalEmployees} คน`, size: "sm", color: "#111111", weight: "bold", align: "end" }
                                    ],
                                    margin: "md"
                                },
                                { type: "separator", margin: "md" },
                                {
                                    type: "box",
                                    layout: "horizontal",
                                    contents: [
                                        { type: "text", text: "มาทำงาน", size: "sm", color: "#555555", flex: 1 },
                                        { type: "text", text: `${presentCount} คน`, size: "sm", color: "#22c55e", weight: "bold", align: "end" }
                                    ],
                                    margin: "md"
                                },
                                {
                                    type: "box",
                                    layout: "horizontal",
                                    contents: [
                                        { type: "text", text: "มาสาย", size: "sm", color: "#555555", flex: 1 },
                                        { type: "text", text: `${lateCount} คน`, size: "sm", color: "#ef4444", weight: "bold", align: "end" }
                                    ],
                                    margin: "sm"
                                },
                                {
                                    type: "box",
                                    layout: "horizontal",
                                    contents: [
                                        { type: "text", text: "ลางาน", size: "sm", color: "#555555", flex: 1 },
                                        { type: "text", text: `${leaveCount} คน`, size: "sm", color: "#eab308", weight: "bold", align: "end" }
                                    ],
                                    margin: "sm"
                                },
                                {
                                    type: "box",
                                    layout: "horizontal",
                                    contents: [
                                        { type: "text", text: "ขาดงาน/ยังไม่มา", size: "sm", color: "#555555", flex: 1 },
                                        { type: "text", text: `${absentCount} คน`, size: "sm", color: "#94a3b8", weight: "bold", align: "end" }
                                    ],
                                    margin: "sm"
                                }
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
                total: totalEmployees,
                present: presentCount,
                late: lateCount,
                leave: leaveCount,
                absent: absentCount
            }
        });

    } catch (error) {
        console.error("Cron Job Error:", error);
        return NextResponse.json({ success: false, message: 'Internal Server Error', error: String(error) }, { status: 500 });
    }
}
