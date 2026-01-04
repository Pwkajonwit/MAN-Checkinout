"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { otService } from "@/lib/firestore";
import { EmployeeHeader } from "@/components/mobile/EmployeeHeader";
import { useEmployee } from "@/contexts/EmployeeContext";
import { Clock, Send } from "lucide-react";

export default function OTRequestPage() {
    const { employee } = useEmployee();
    const [date, setDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const sendFlexMessage = async (otData: { date: Date, startTime: Date, endTime: Date, reason: string }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const liff = (window as any).liff;
        if (liff && liff.isInClient()) {
            try {
                await liff.sendMessages([
                    {
                        type: "flex",
                        altText: "ส่งคำขอ OT สำเร็จ",
                        contents: {
                            type: "bubble",
                            header: {
                                type: "box",
                                layout: "vertical",
                                contents: [
                                    {
                                        type: "text",
                                        text: "ส่งคำขอสำเร็จ",
                                        weight: "bold",
                                        color: "#1DB446",
                                        size: "sm"
                                    },
                                    {
                                        type: "text",
                                        text: "ขอทำโอที (OT)",
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
                                                        text: "วันที่",
                                                        color: "#aaaaaa",
                                                        size: "sm",
                                                        flex: 1
                                                    },
                                                    {
                                                        type: "text",
                                                        text: otData.date.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }),
                                                        wrap: true,
                                                        color: "#666666",
                                                        size: "sm",
                                                        flex: 5
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
                                                        text: "เวลา",
                                                        color: "#aaaaaa",
                                                        size: "sm",
                                                        flex: 1
                                                    },
                                                    {
                                                        type: "text",
                                                        text: `${otData.startTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - ${otData.endTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`,
                                                        wrap: true,
                                                        color: "#666666",
                                                        size: "sm",
                                                        flex: 5
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
                                                        flex: 1
                                                    },
                                                    {
                                                        type: "text",
                                                        text: otData.reason,
                                                        wrap: true,
                                                        color: "#666666",
                                                        size: "sm",
                                                        flex: 5
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                ]);
            } catch (error) {
                console.error("Error sending flex message:", error);
            }
        }
    };

    const notifyAdmin = async (otData: { date: Date, startTime: Date, endTime: Date, reason: string }) => {
        try {
            await fetch("/api/line/notify-admin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    type: "ot",
                    employeeName: employee?.name || "Unknown",
                    details: `${otData.date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} ${otData.startTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - ${otData.endTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`,
                    reason: otData.reason,
                    date: new Date().toISOString()
                }),
            });
        } catch (error) {
            console.error("Error notifying admin:", error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!employee) return;

        setLoading(true);
        try {
            // Create date objects combining date + time
            const startDateTime = new Date(`${date}T${startTime}`);
            const endDateTime = new Date(`${date}T${endTime}`);

            await otService.create({
                employeeId: employee.id || "unknown",
                employeeName: employee.name,
                date: new Date(date),
                startTime: startDateTime,
                endTime: endDateTime,
                reason,
                status: "รออนุมัติ",
                createdAt: new Date(),
            });

            // Send Flex Message (to user)
            await sendFlexMessage({
                date: new Date(date),
                startTime: startDateTime,
                endTime: endDateTime,
                reason
            });

            // Notify Admin (to group)
            await notifyAdmin({
                date: new Date(date),
                startTime: startDateTime,
                endTime: endDateTime,
                reason
            });

            setShowSuccess(true);

            // Reset
            setDate("");
            setStartTime("");
            setEndTime("");
            setReason("");

            // Hide success message after 3 seconds
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            console.error(error);
            alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-10">
            <EmployeeHeader />

            {/* Success Notification */}
            {showSuccess && (
                <div className="fixed top-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-top-10 fade-in duration-300">
                    <div className="bg-[#1DB446] text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 mx-auto max-w-sm">
                        <div className="p-2 bg-white/20 rounded-full">
                            <Send className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">ส่งคำขอสำเร็จ!</h3>
                            <p className="text-white/90 text-sm">ระบบได้รับข้อมูลเรียบร้อยแล้ว</p>
                        </div>
                    </div>
                </div>
            )}

            <main className="px-6 -mt-6 relative z-10">
                <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-purple-500" />
                        แบบฟอร์มขอ OT
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">วันที่ทำ OT</label>
                            <Input
                                type="date"
                                value={date}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
                                className="h-12 w-full min-w-0 rounded-xl border-gray-200 bg-gray-50/50 appearance-none"
                                style={{ WebkitAppearance: "none" }}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">เวลาเริ่ม</label>
                                <Input
                                    type="time"
                                    value={startTime}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartTime(e.target.value)}
                                    className="h-12 w-full min-w-0 rounded-xl border-gray-200 bg-gray-50/50 appearance-none"
                                    style={{ WebkitAppearance: "none" }}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">เวลาสิ้นสุด</label>
                                <Input
                                    type="time"
                                    value={endTime}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndTime(e.target.value)}
                                    className="h-12 w-full min-w-0 rounded-xl border-gray-200 bg-gray-50/50 appearance-none"
                                    style={{ WebkitAppearance: "none" }}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">รายละเอียดงาน</label>
                            <Textarea
                                value={reason}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                                placeholder="ระบุรายละเอียดงานที่ทำ..."
                                className="min-h-[100px] rounded-xl border-gray-200 bg-gray-50/50 resize-none"
                                required
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-14 text-lg rounded-2xl bg-primary hover:bg-primary/80 shadow-lg shadow-blue-900/20 mt-4"
                        >
                            {loading ? "กำลังส่งข้อมูล..." : (
                                <span className="flex items-center gap-2">
                                    ส่งคำขอ <Send className="w-4 h-4" />
                                </span>
                            )}
                        </Button>
                    </form>
                </div>
            </main>
        </div>
    );
}
