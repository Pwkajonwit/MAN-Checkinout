import { NextResponse } from "next/server";
import { employeeService } from "@/lib/firestore";

type LineProfileResponse = {
    userId: string;
    displayName?: string;
    pictureUrl?: string;
    statusMessage?: string;
};

export async function POST(request: Request) {
    try {
        const { employeeId } = await request.json();

        if (!employeeId || typeof employeeId !== "string") {
            return NextResponse.json({ success: false, message: "employeeId is required" }, { status: 400 });
        }

        const employee = await employeeService.getById(employeeId);
        if (!employee?.lineUserId) {
            return NextResponse.json({ success: false, message: "Employee is not connected to LINE" }, { status: 404 });
        }

        const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        if (!channelAccessToken) {
            return NextResponse.json({ success: false, message: "LINE_CHANNEL_ACCESS_TOKEN is not configured" }, { status: 500 });
        }

        const lineRes = await fetch(`https://api.line.me/v2/bot/profile/${employee.lineUserId}`, {
            headers: {
                Authorization: `Bearer ${channelAccessToken}`,
            },
            cache: "no-store",
        });

        if (!lineRes.ok) {
            const errorText = await lineRes.text();
            console.warn("LINE profile API did not return an avatar:", lineRes.status, errorText);
            return NextResponse.json({ success: false, message: "Failed to fetch LINE profile", error: errorText }, { status: lineRes.status });
        }

        const profile = await lineRes.json() as LineProfileResponse;
        const avatar = profile.pictureUrl || null;

        await employeeService.update(employeeId, { avatar });

        return NextResponse.json({
            success: true,
            avatar,
            displayName: profile.displayName || "",
        });
    } catch (error) {
        console.error("Employee avatar refresh error:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error", error: String(error) }, { status: 500 });
    }
}
