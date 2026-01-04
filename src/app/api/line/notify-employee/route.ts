import { NextResponse } from "next/server";
import { employeeService } from "@/lib/firestore";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { employeeId, type, status, details } = body;

        // 1. Get Employee to find Line User ID
        const employee = await employeeService.getById(employeeId);
        if (!employee || !employee.lineUserId) {
            return NextResponse.json({ success: false, message: 'Employee or Line User ID not found' });
        }

        // 2. Construct Flex Message
        let title = "ผลการอนุมัติ (Approval Result)";
        if (type === "leave") title = "ผลการขอลา (Leave Result)";
        else if (type === "ot") title = "ผลการขอ OT (OT Result)";
        else if (type === "swap") title = "ผลขอสลับวันหยุด (Swap Result)";
        const color = status === "อนุมัติ" ? "#1DB446" : "#ef4444"; // Green for Approve, Red for Reject
        const statusText = status === "อนุมัติ" ? "อนุมัติแล้ว (Approved)" : "ไม่อนุมัติ (Rejected)";

        const message = {
            to: employee.lineUserId,
            messages: [
                {
                    type: "flex",
                    altText: `${title} - ${status}`,
                    contents: {
                        type: "bubble",
                        header: {
                            type: "box",
                            layout: "vertical",
                            contents: [
                                {
                                    type: "text",
                                    text: "แจ้งผลการอนุมัติ",
                                    weight: "bold",
                                    color: color,
                                    size: "sm"
                                },
                                {
                                    type: "text",
                                    text: title,
                                    weight: "bold",
                                    size: "xl",
                                    margin: "md"
                                }
                            ]
                        },
                        body: {
                            type: "box",
                            layout: "vertical",
                            contents: [
                                {
                                    type: "box",
                                    layout: "vertical",
                                    margin: "lg",
                                    spacing: "sm",
                                    contents: [
                                        {
                                            type: "box",
                                            layout: "baseline",
                                            spacing: "sm",
                                            contents: [
                                                {
                                                    type: "text",
                                                    text: "สถานะ",
                                                    color: "#aaaaaa",
                                                    size: "sm",
                                                    flex: 2
                                                },
                                                {
                                                    type: "text",
                                                    text: statusText,
                                                    wrap: true,
                                                    color: color,
                                                    size: "sm",
                                                    weight: "bold",
                                                    flex: 4
                                                }
                                            ]
                                        },
                                        {
                                            type: "box",
                                            layout: "baseline",
                                            spacing: "sm",
                                            contents: [
                                                {
                                                    type: "text",
                                                    text: "รายละเอียด",
                                                    color: "#aaaaaa",
                                                    size: "sm",
                                                    flex: 2
                                                },
                                                {
                                                    type: "text",
                                                    text: details,
                                                    wrap: true,
                                                    color: "#666666",
                                                    size: "sm",
                                                    flex: 4
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                }
            ]
        };

        // 3. Send to LINE
        const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        if (!channelAccessToken) {
            return NextResponse.json({ success: false, message: 'LINE Channel Access Token not configured' });
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

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Notify Employee Error:", error);
        return NextResponse.json({ success: false, message: 'Internal Server Error', error: String(error) }, { status: 500 });
    }
}
