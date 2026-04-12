import { NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import React from "react";
import { systemConfigService } from "@/lib/firestore";
import admin, { isFirebaseAdminReady } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

type CheckInNotificationPayload = {
    employeeName?: string;
    status?: string;
    time?: string;
    location?: string;
    distance?: number | null;
    locationNote?: string;
    photo?: string | null;
};

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

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

const formatTimeOnly = (value: string) => {
    const date = new Date(value);
    return date.toLocaleTimeString("th-TH", {
        timeZone: "Asia/Bangkok",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const formatDateOnly = (value: string) => {
    const date = new Date(value);
    return date.toLocaleDateString("th-TH", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "short",
        day: "numeric",
    });
};

const getAttendanceActionLabel = (status: string) => {
    switch (status) {
        case "ออกงาน":
            return "ออกงาน";
        case "ก่อนพัก":
            return "ก่อนพัก";
        case "หลังพัก":
            return "หลังพัก";
        case "ออกนอกพื้นที่":
            return "ออกนอกพื้นที่";
        case "สาย":
            return "เช็กอิน: สาย";
        default:
            return "เช็กอิน";
    }
};

const getAttendanceHeader = (status: string) => {
    switch (status) {
        case "ออกงาน":
            return {
                title: "ออกงานพนักงาน",
                subtitle: "Attendance Check-out",
                color: "#2563eb",
            };
        case "ก่อนพัก":
        case "หลังพัก":
            return {
                title: "บันทึกเวลาพัก",
                subtitle: "Break Attendance",
                color: "#f59e0b",
            };
        case "ออกนอกพื้นที่":
            return {
                title: "ลงเวลานอกสถานที่",
                subtitle: "Offsite Attendance",
                color: "#7c3aed",
            };
        case "สาย":
            return {
                title: "เช็กอินพนักงาน",
                subtitle: "Late Check-in",
                color: "#dc2626",
            };
        default:
            return {
                title: "เช็กอินพนักงาน",
                subtitle: "Attendance Check-in",
                color: "#16a34a",
            };
    }
};

const buildTelegramMessage = ({
    employeeName,
    status,
    time,
    location,
    distance,
    locationNote,
}: Required<Omit<CheckInNotificationPayload, "photo">>) => {
    const actionLabel = getAttendanceActionLabel(status);
    const parts = [
        `พนักงาน${actionLabel}`,
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
    const header = getAttendanceHeader(status);
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
        altText: `พนักงาน${getAttendanceActionLabel(status)} ${employeeName} เวลา ${formatDateTime(time)}`,
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: header.title, size: "sm", color: header.color, weight: "bold" },
                    { type: "text", text: header.subtitle, size: "xl", weight: "bold", margin: "md" },
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

const createCompositeImageUrl = async (payload: Required<Omit<CheckInNotificationPayload, "photo">> & { photo?: string | null }) => {
    if (!payload.photo || !isFirebaseAdminReady() || !STORAGE_BUCKET) {
        return null;
    }

    try {
        const actionLabel = getAttendanceActionLabel(payload.status);
        const imageElement = React.createElement(
            "div",
            {
                style: {
                    width: "1080px",
                    height: "1920px",
                    display: "flex",
                    position: "relative",
                    background: "#0f172a",
                    overflow: "hidden",
                },
            },
            React.createElement("img", {
                src: payload.photo,
                alt: "check-in",
                style: {
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    position: "absolute",
                    inset: 0,
                },
            }),
            React.createElement("div", {
                style: {
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    background: "linear-gradient(180deg, rgba(15,23,42,0.10) 0%, rgba(15,23,42,0.24) 45%, rgba(15,23,42,0.82) 100%)",
                },
            }),
            React.createElement(
                "div",
                {
                    style: {
                        position: "absolute",
                        left: "56px",
                        right: "56px",
                        bottom: "64px",
                        display: "flex",
                        flexDirection: "column",
                        color: "#ffffff",
                        textShadow: "0 6px 18px rgba(0,0,0,0.45)",
                    },
                },
                React.createElement(
                    "div",
                    {
                        style: {
                            display: "flex",
                            alignItems: "flex-end",
                            gap: "24px",
                        },
                    },
                    React.createElement(
                        "div",
                        {
                            style: {
                                fontSize: 108,
                                fontWeight: 800,
                                lineHeight: 1,
                            },
                        },
                        formatTimeOnly(payload.time)
                    ),
                    React.createElement(
                        "div",
                        {
                            style: {
                                display: "flex",
                                flexDirection: "column",
                                marginBottom: "10px",
                            },
                        },
                        React.createElement(
                            "div",
                            {
                                style: {
                                    fontSize: 42,
                                    fontWeight: 700,
                                },
                            },
                            formatDateOnly(payload.time)
                        ),
                        React.createElement(
                            "div",
                            {
                                style: {
                                    fontSize: 30,
                                    color: "#e2e8f0",
                                },
                            },
                            actionLabel
                        )
                    )
                ),
                React.createElement(
                    "div",
                    {
                        style: {
                            marginTop: "22px",
                            fontSize: 38,
                            fontWeight: 700,
                        },
                    },
                    payload.employeeName
                ),
                React.createElement(
                    "div",
                    {
                        style: {
                            marginTop: "18px",
                            fontSize: 32,
                            lineHeight: 1.35,
                            color: "#f8fafc",
                        },
                    },
                    payload.location
                ),
                payload.locationNote
                    ? React.createElement(
                        "div",
                        {
                            style: {
                                marginTop: "16px",
                                fontSize: 26,
                                lineHeight: 1.35,
                                color: "#fde68a",
                            },
                        },
                        `หมายเหตุ: ${payload.locationNote}`
                    )
                    : null
            )
        );

        const image = new ImageResponse(
            imageElement,
            {
                width: 1080,
                height: 1920,
            }
        );

        const arrayBuffer = await image.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const bucket = admin.storage().bucket(STORAGE_BUCKET);
        const filePath = `notifications/checkin/${Date.now()}-${crypto.randomUUID()}.png`;
        const token = crypto.randomUUID();
        const file = bucket.file(filePath);

        await file.save(buffer, {
            contentType: "image/png",
            metadata: {
                cacheControl: "public,max-age=3600",
                metadata: {
                    firebaseStorageDownloadTokens: token,
                },
            },
        });

        return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
    } catch (error) {
        console.error("Failed to create composite image:", error);
        return null;
    }
};

const sendLineNotification = async (groupId: string, payload: Required<Omit<CheckInNotificationPayload, "photo">> & { photo?: string | null }) => {
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!channelAccessToken) {
        throw new Error("LINE_CHANNEL_ACCESS_TOKEN not configured");
    }

    const compositeImageUrl = await createCompositeImageUrl(payload);
    const sendMessages = async (messages: Array<Record<string, unknown>>) => {
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

    const fallbackMessages: Array<Record<string, unknown>> = [];
    if (payload.photo && /^https?:\/\//.test(payload.photo)) {
        fallbackMessages.push({
            type: "image",
            originalContentUrl: payload.photo,
            previewImageUrl: payload.photo,
        });
    }
    fallbackMessages.push(buildLineFlex(payload));

    if (compositeImageUrl) {
        try {
            await sendMessages([
                {
                    type: "image",
                    originalContentUrl: compositeImageUrl,
                    previewImageUrl: compositeImageUrl,
                },
            ]);
            return;
        } catch (error) {
            console.error("LINE composite image send failed, retrying fallback:", error);
        }
    }

    await sendMessages(fallbackMessages);
};

const sendTelegramNotification = async (chatId: string, payload: Required<Omit<CheckInNotificationPayload, "photo">> & { photo?: string | null }) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    const caption = buildTelegramMessage(payload);
    const baseUrl = `https://api.telegram.org/bot${botToken}`;
    const compositeImageUrl = await createCompositeImageUrl(payload);

    if (compositeImageUrl) {
        try {
            const response = await fetch(`${baseUrl}/sendPhoto`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    photo: compositeImageUrl,
                }),
            });

            if (!response.ok) {
                throw new Error(await response.text());
            }
            return;
        } catch (error) {
            console.error("Telegram composite image send failed, retrying fallback:", error);
        }
    }

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
