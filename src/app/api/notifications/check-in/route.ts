import { NextResponse } from "next/server";
import { systemConfigService } from "@/lib/firestore";

type CheckInNotificationPayload = {
    employeeName?: string;
    status?: string;
    time?: string;
    location?: string;
    distance?: number | null;
    locationNote?: string;
    photo?: string | null;
};

const formatDateTime = (value: string) => {
    const date = new Date(value);
    return date.toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const formatDistance = (distance?: number | null) => {
    if (distance === null || distance === undefined) return null;
    return distance < 1000 ? `${Math.round(distance)} เมตร` : `${(distance / 1000).toFixed(2)} กม.`;
};

const buildTelegramMessage = ({
    employeeName,
    status,
    time,
    location,
    distance,
    locationNote,
}: Required<Omit<CheckInNotificationPayload, "photo">>) => {
    const parts = [
        "พนักงานเช็กอิน",
        `ชื่อ: ${employeeName}`,
        `สถานะ: ${status}`,
        `เวลา: ${formatDateTime(time)}`,
        `ที่อยู่: ${location}`,
    ];

    const distanceText = formatDistance(distance);
    if (distanceText) parts.push(`ระยะห่าง: ${distanceText}`);
    if (locationNote) parts.push(`หมายเหตุ: ${locationNote}`);

    return parts.join("\n");
};

const buildLineFlex = ({
    employeeName,
    status,
    time,
    location,
    distance,
    locationNote,
}: Required<Omit<CheckInNotificationPayload, "photo">>) => {
    const contents: Array<Record<string, unknown>> = [
        {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
                { type: "text", text: "พนักงาน", color: "#94a3b8", size: "sm", flex: 2 },
                { type: "text", text: employeeName, color: "#0f172a", size: "sm", wrap: true, flex: 5 },
            ],
        },
        {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
                { type: "text", text: "สถานะ", color: "#94a3b8", size: "sm", flex: 2 },
                { type: "text", text: status, color: status === "สาย" ? "#dc2626" : "#16a34a", size: "sm", weight: "bold", wrap: true, flex: 5 },
            ],
        },
        {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
                { type: "text", text: "เวลา", color: "#94a3b8", size: "sm", flex: 2 },
                { type: "text", text: formatDateTime(time), color: "#334155", size: "sm", wrap: true, flex: 5 },
            ],
        },
        {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
                { type: "text", text: "ที่อยู่", color: "#94a3b8", size: "sm", flex: 2 },
                { type: "text", text: location, color: "#334155", size: "sm", wrap: true, flex: 5 },
            ],
        },
    ];

    const distanceText = formatDistance(distance);
    if (distanceText) {
        contents.push({
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
                { type: "text", text: "ระยะห่าง", color: "#94a3b8", size: "sm", flex: 2 },
                { type: "text", text: distanceText, color: "#334155", size: "sm", wrap: true, flex: 5 },
            ],
        });
    }

    if (locationNote) {
        contents.push({
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
                { type: "text", text: "หมายเหตุ", color: "#94a3b8", size: "sm", flex: 2 },
                { type: "text", text: locationNote, color: "#ea580c", size: "sm", wrap: true, flex: 5 },
            ],
        });
    }

    return {
        type: "flex",
        altText: `พนักงานเช็กอิน ${employeeName} เวลา ${formatDateTime(time)}`,
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "เช็กอินพนักงาน", size: "sm", color: "#16a34a", weight: "bold" },
                    { type: "text", text: "Attendance Check-in", size: "xl", weight: "bold", margin: "md" },
                ],
            },
            body: {
                type: "box",
                layout: "vertical",
                margin: "lg",
                spacing: "sm",
                contents,
            },
        },
    };
};

const sendLineNotification = async (groupId: string, payload: Required<Omit<CheckInNotificationPayload, "photo">> & { photo?: string | null }) => {
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!channelAccessToken) {
        throw new Error("LINE_CHANNEL_ACCESS_TOKEN not configured");
    }

    const messages: Array<Record<string, unknown>> = [];
    if (payload.photo && /^https?:\/\//.test(payload.photo)) {
        messages.push({
            type: "image",
            originalContentUrl: payload.photo,
            previewImageUrl: payload.photo,
        });
    }
    messages.push(buildLineFlex(payload));

    const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${channelAccessToken}`,
        },
        body: JSON.stringify({
            to: groupId,
            messages,
        }),
    });

    if (!lineRes.ok) {
        throw new Error(await lineRes.text());
    }
};

const sendTelegramNotification = async (chatId: string, payload: Required<Omit<CheckInNotificationPayload, "photo">> & { photo?: string | null }) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    const caption = buildTelegramMessage(payload);
    const baseUrl = `https://api.telegram.org/bot${botToken}`;

    if (payload.photo) {
        if (payload.photo.startsWith("data:")) {
            const match = payload.photo.match(/^data:(.+);base64,(.+)$/);
            if (!match) {
                throw new Error("Invalid base64 image format");
            }

            const [, mimeType, base64Data] = match;
            const buffer = Buffer.from(base64Data, "base64");
            const form = new FormData();
            form.append("chat_id", chatId);
            form.append("caption", caption);
            form.append("photo", new Blob([buffer], { type: mimeType }), "checkin.jpg");

            const response = await fetch(`${baseUrl}/sendPhoto`, {
                method: "POST",
                body: form,
            });

            if (!response.ok) {
                throw new Error(await response.text());
            }
            return;
        }

        const response = await fetch(`${baseUrl}/sendPhoto`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                chat_id: chatId,
                photo: payload.photo,
                caption,
            }),
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }
        return;
    }

    const response = await fetch(`${baseUrl}/sendMessage`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            chat_id: chatId,
            text: caption,
        }),
    });

    if (!response.ok) {
        throw new Error(await response.text());
    }
};

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as CheckInNotificationPayload;
        const employeeName = body.employeeName?.trim();
        const status = body.status?.trim();
        const time = body.time;
        const location = body.location?.trim();

        if (!employeeName || !status || !time || !location) {
            return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
        }

        const config = await systemConfigService.get();
        if (!config) {
            return NextResponse.json({ success: false, message: "System config not found" }, { status: 404 });
        }

        const payload = {
            employeeName,
            status,
            time,
            location,
            distance: body.distance ?? null,
            locationNote: body.locationNote?.trim() || "",
            photo: body.photo ?? null,
        };

        const results = await Promise.allSettled([
            config.enableLineCheckInNotification && config.lineCheckInGroupId
                ? sendLineNotification(config.lineCheckInGroupId, payload)
                : Promise.resolve(),
            config.enableTelegramCheckInNotification && config.telegramChatId
                ? sendTelegramNotification(config.telegramChatId, payload)
                : Promise.resolve(),
        ]);

        const errors = results
            .filter((result): result is PromiseRejectedResult => result.status === "rejected")
            .map((result) => String(result.reason));

        if (errors.length > 0) {
            console.error("Check-in notification errors:", errors);
            return NextResponse.json({ success: false, errors }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Check-in notification error:", error);
        return NextResponse.json(
            { success: false, message: "Internal Server Error", error: String(error) },
            { status: 500 }
        );
    }
}
