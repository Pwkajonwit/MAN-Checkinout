"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { leaveService } from "@/lib/firestore";
import { EmployeeHeader } from "@/components/mobile/EmployeeHeader";
import { useEmployee } from "@/contexts/EmployeeContext";
import { FileText, Send, CheckCircle, AlertCircle, Camera, X } from "lucide-react";
import { compressBase64Image } from "@/lib/storage";

export default function LeaveRequestPage() {
    const { employee } = useEmployee();
    type LeaveType = "ลาพักร้อน" | "ลาป่วย" | "ลากิจ";
    const [leaveType, setLeaveType] = useState<LeaveType | "">("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Attachment (รูปหลักฐาน)
    const [attachment, setAttachment] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [quotas, setQuotas] = useState({
        personal: { total: 0, used: 0, remaining: 0 },
        sick: { total: 0, used: 0, remaining: 0 },
        vacation: { total: 0, used: 0, remaining: 0 },
    });

    useEffect(() => {
        if (employee) {
            const fetchLeaveData = async () => {
                try {
                    const requests = await leaveService.getByEmployeeId(employee.id || "");

                    // Calculate used days
                    const used = {
                        personal: 0,
                        sick: 0,
                        vacation: 0
                    };

                    requests.forEach(req => {
                        if (req.status === "อนุมัติ" || req.status === "รออนุมัติ") {
                            const start = new Date(req.startDate);
                            const end = new Date(req.endDate);
                            const diffTime = Math.abs(end.getTime() - start.getTime());
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive

                            if (req.leaveType === "ลากิจ") used.personal += diffDays;
                            else if (req.leaveType === "ลาป่วย") used.sick += diffDays;
                            else if (req.leaveType === "ลาพักร้อน") used.vacation += diffDays;
                        }
                    });

                    setQuotas({
                        personal: {
                            total: employee.leaveQuota?.personal || 0,
                            used: used.personal,
                            remaining: (employee.leaveQuota?.personal || 0) - used.personal
                        },
                        sick: {
                            total: employee.leaveQuota?.sick || 0,
                            used: used.sick,
                            remaining: (employee.leaveQuota?.sick || 0) - used.sick
                        },
                        vacation: {
                            total: employee.leaveQuota?.vacation || 0,
                            used: used.vacation,
                            remaining: (employee.leaveQuota?.vacation || 0) - used.vacation
                        }
                    });
                } catch (error) {
                    console.error("Error fetching leave data:", error);
                }
            };
            fetchLeaveData();
        }
    }, [employee]);

    const sendFlexMessage = async (leaveData: { type: string, start: Date, end: Date, reason: string }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const liff = (window as any).liff;
        if (liff && liff.isInClient()) {
            try {
                await liff.sendMessages([
                    {
                        type: "flex",
                        altText: "ส่งใบลาสำเร็จ",
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
                                        text: "ใบลา (Leave)",
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
                                                        text: "ประเภท",
                                                        color: "#aaaaaa",
                                                        size: "sm",
                                                        flex: 1
                                                    },
                                                    {
                                                        type: "text",
                                                        text: leaveData.type,
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
                                                        text: "วันที่",
                                                        color: "#aaaaaa",
                                                        size: "sm",
                                                        flex: 1
                                                    },
                                                    {
                                                        type: "text",
                                                        text: `${leaveData.start.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - ${leaveData.end.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`,
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
                                                        text: "เหตุผล",
                                                        color: "#aaaaaa",
                                                        size: "sm",
                                                        flex: 1
                                                    },
                                                    {
                                                        type: "text",
                                                        text: leaveData.reason,
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

    const notifyAdmin = async (leaveData: { type: string, start: Date, end: Date, reason: string }) => {
        try {
            await fetch("/api/line/notify-admin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    type: "leave",
                    employeeName: employee?.name || "Unknown",
                    details: `${leaveData.type}: ${leaveData.start.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - ${leaveData.end.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`,
                    reason: leaveData.reason,
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

        // Validate Quota
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const requestDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        let currentQuota = 0;
        if (leaveType === "ลากิจ") currentQuota = quotas.personal.remaining;
        else if (leaveType === "ลาป่วย") currentQuota = quotas.sick.remaining;
        else if (leaveType === "ลาพักร้อน") currentQuota = quotas.vacation.remaining;

        if (requestDays > currentQuota) {
            alert(`วันลาคงเหลือไม่เพียงพอ (ต้องการ ${requestDays} วัน, คงเหลือ ${currentQuota} วัน)`);
            return;
        }

        setLoading(true);
        try {
            // Compress attachment if present
            let attachmentBase64: string | undefined = undefined;
            if (attachment) {
                try {
                    // Use higher resolution for documents (1200x1600) with better quality (0.8)
                    // Documents need to be readable, unlike selfies which can be smaller
                    attachmentBase64 = await compressBase64Image(attachment, 1200, 1600, 0.8);
                } catch (e) {
                    console.error("Error compressing attachment:", e);
                    attachmentBase64 = attachment;
                }
            }

            await leaveService.create({
                employeeId: employee.id || "unknown",
                employeeName: employee.name,
                leaveType: leaveType as "ลาพักร้อน" | "ลาป่วย" | "ลากิจ",
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                reason,
                status: "รออนุมัติ",
                createdAt: new Date(),
                ...(attachmentBase64 && { attachment: attachmentBase64 }),
            });

            // Send Flex Message (to user)
            await sendFlexMessage({
                type: leaveType,
                start: new Date(startDate),
                end: new Date(endDate),
                reason
            });

            // Notify Admin (to group)
            await notifyAdmin({
                type: leaveType,
                start: new Date(startDate),
                end: new Date(endDate),
                reason
            });

            setShowSuccess(true);

            // Reset
            setLeaveType("");
            setStartDate("");
            setEndDate("");
            setReason("");
            setAttachment(null);

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
                            <CheckCircle className="w-5 h-5 text-white" />
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
                        <FileText className="w-5 h-5 text-blue-500" />
                        แบบฟอร์มขอลางาน
                    </h2>

                    {/* Quota Cards */}
                    <div className="grid grid-cols-3 gap-2 mb-6">
                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-center">
                            <div className="text-xs text-blue-600 font-medium mb-1">ลากิจ</div>
                            <div className="text-xl font-bold text-blue-700">{quotas.personal.remaining}</div>
                            <div className="text-[10px] text-blue-400">จาก {quotas.personal.total}</div>
                        </div>
                        <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 text-center">
                            <div className="text-xs text-orange-600 font-medium mb-1">ลาป่วย</div>
                            <div className="text-xl font-bold text-orange-700">{quotas.sick.remaining}</div>
                            <div className="text-[10px] text-orange-400">จาก {quotas.sick.total}</div>
                        </div>
                        <div className="bg-purple-50 p-3 rounded-xl border border-purple-100 text-center">
                            <div className="text-xs text-purple-600 font-medium mb-1">พักร้อน</div>
                            <div className="text-xl font-bold text-purple-700">{quotas.vacation.remaining}</div>
                            <div className="text-[10px] text-purple-400">จาก {quotas.vacation.total}</div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">ประเภทการลา</label>
                            <Select onValueChange={val => setLeaveType(val as LeaveType | "")} value={leaveType}>
                                <SelectTrigger className="h-12 rounded-xl border-gray-200 bg-gray-50/50">
                                    <SelectValue placeholder="เลือกประเภท" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ลาป่วย">ลาป่วย</SelectItem>
                                    <SelectItem value="ลากิจ">ลากิจ</SelectItem>
                                    <SelectItem value="ลาพักร้อน">ลาพักร้อน</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">วันที่เริ่ม</label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                                    className="h-12 w-full min-w-0 rounded-xl border-gray-200 bg-gray-50/50 appearance-none"
                                    style={{ WebkitAppearance: "none" }}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">ถึงวันที่</label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                                    className="h-12 w-full min-w-0 rounded-xl border-gray-200 bg-gray-50/50 appearance-none"
                                    style={{ WebkitAppearance: "none" }}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">เหตุผล</label>
                            <Textarea
                                value={reason}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                                placeholder="ระบุเหตุผลการลา..."
                                className="min-h-[100px] rounded-xl border-gray-200 bg-gray-50/50 resize-none"
                                required
                            />
                        </div>

                        {/* Attachment (รูปหลักฐาน) */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">แนบหลักฐาน (ไม่บังคับ)</label>
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (ev) => {
                                            setAttachment(ev.target?.result as string);
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                            />
                            {attachment ? (
                                <div className="relative w-full aspect-video bg-gray-100 rounded-xl overflow-hidden">
                                    <img src={attachment} alt="หลักฐาน" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => setAttachment(null)}
                                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center gap-2 text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                                >
                                    <Camera className="w-8 h-8" />
                                    <span className="text-sm">แตะเพื่อเลือกรูปภาพ</span>
                                </button>
                            )}
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
