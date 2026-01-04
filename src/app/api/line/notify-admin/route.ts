import { NextResponse } from "next/server";
import { systemConfigService } from "@/lib/firestore";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, employeeName, details, reason, date } = body;

        // 1. Get System Config for Admin Group ID
        const config = await systemConfigService.get();
        if (!config?.adminLineGroupId) {
            return NextResponse.json({ success: false, message: 'Admin Line Group ID not configured' });
        }

        // 2. Construct Flex Message
        let title = "";
        let color = "";

        switch (type) {
            case "leave":
                title = "คำขอลา (Leave Request)";
                color = "#f59e0b"; // Amber
                break;
            case "ot":
                title = "คำขอ OT (OT Request)";
                color = "#3b82f6"; // Blue
                break;
            case "swap":
                title = "คำขอสลับวันหยุด (Swap Request)";
                color = "#9333ea"; // Purple
                break;
            default:
                title = "คำขออนุมัติ (Request)";
                color = "#64748b"; // Slate
        }
        const liffId = process.env.NEXT_PUBLIC_LIFF_APPROVE_ID;
        const approvalLink = `https://liff.line.me/${liffId}`;

        const message = {
            to: config.adminLineGroupId,
            messages: [
                {
                    type: "flex",
                    altText: `${title} - ${employeeName}`,
                    contents: {
                        type: "bubble",
                        header: {
                            type: "box",
                            layout: "vertical",
                            contents: [
                                {
                                    type: "text",
                                    text: "คำขออนุมัติใหม่",
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
                                                    text: "พนักงาน",
                                                    color: "#aaaaaa",
                                                    size: "sm",
                                                    flex: 2
                                                },
                                                {
                                                    type: "text",
                                                    text: employeeName,
                                                    wrap: true,
                                                    color: "#666666",
                                                    size: "sm",
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
                                        },
                                        {
                                            type: "box",
                                            layout: "baseline",
                                            spacing: "sm",
                                            contents: [
                                                {
                                                    type: "text",
                                                    text: "เหตุผล",
                                                    color: "#aaaaaa",
                                                    size: "sm",
                                                    flex: 2
                                                },
                                                {
                                                    type: "text",
                                                    text: reason || "-",
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
                        },
                        footer: {
                            type: "box",
                            layout: "vertical",
                            spacing: "sm",
                            contents: [
                                {
                                    type: "button",
                                    style: "primary",
                                    height: "sm",
                                    action: {
                                        type: "uri",
                                        label: "ตรวจสอบ / อนุมัติ",
                                        uri: approvalLink
                                    },
                                    color: color
                                }
                            ],
                            flex: 0
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
        console.error("Notify Admin Error:", error);
        return NextResponse.json({ success: false, message: 'Internal Server Error', error: String(error) }, { status: 500 });
    }
}
