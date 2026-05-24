"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { leaveService } from "@/lib/firestore";
import { EmployeeHeader } from "@/components/mobile/EmployeeHeader";
import { useEmployee } from "@/contexts/EmployeeContext";
import { FileText, Send, CheckCircle, Camera, X } from "lucide-react";
import { compressBase64Image } from "@/lib/storage";
import { getLeaveDayUnits, formatLeaveDateRange, formatLeaveDuration, formatLeaveDayHourUnits, formatLeaveUnitValue } from "@/lib/leaveUtils";

export default function LeaveRequestPage() {
    const { employee } = useEmployee();
    type LeaveType = "ลาพักร้อน" | "ลาป่วย" | "ลากิจ";
    const [leaveType, setLeaveType] = useState<LeaveType | "">("");
    const [durationUnit, setDurationUnit] = useState<"day" | "hour">("day");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
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

    const formatCompactPersonalQuota = (days: number) => {
        const [dayText, hourText] = formatLeaveDayHourUnits(days).split(" วัน ");
        return `${dayText} ว. ${hourText.replace(" ชั่วโมง", "")} ชม`;
    };

    const formatTotalDays = (days: number) => formatLeaveUnitValue(days);

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
                            const leaveUnits = getLeaveDayUnits(req);

                            if (req.leaveType === "ลากิจ") used.personal += leaveUnits;
                            else if (req.leaveType === "ลาป่วย") used.sick += leaveUnits;
                            else if (req.leaveType === "ลาพักร้อน") used.vacation += leaveUnits;
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

    useEffect(() => {
        if (leaveType !== "ลากิจ") {
            setDurationUnit("day");
            setStartTime("");
            setEndTime("");
        }
    }, [leaveType]);

    const sendFlexMessage = async (leaveData: { type: string, start: Date, end: Date, reason: string, dateText?: string }) => {
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
                                                        text: leaveData.dateText || `${leaveData.start.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - ${leaveData.end.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`,
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

    const notifyAdmin = async (leaveData: { type: string, start: Date, end: Date, reason: string, dateText?: string }) => {
        try {
            await fetch("/api/line/notify-admin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    type: "leave",
                    employeeName: employee?.name || "Unknown",
                    details: `${leaveData.type}: ${leaveData.dateText || `${leaveData.start.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - ${leaveData.end.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`}`,
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
        const effectiveEndDate = durationUnit === "hour" ? startDate : endDate;
        const start = new Date(startDate);
        const end = new Date(effectiveEndDate);
        if (end < start) {
            alert("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น");
            return;
        }

        let totalHours: number | undefined;
        if (durationUnit === "hour") {
            if (leaveType !== "ลากิจ") {
                alert("ลารายชั่วโมงใช้ได้กับลากิจเท่านั้น");
                return;
            }
            if (!startTime || !endTime) {
                alert("กรุณาระบุเวลาเริ่มและเวลาสิ้นสุด");
                return;
            }

            const startDateTime = new Date(`${startDate}T${startTime}`);
            const endDateTime = new Date(`${startDate}T${endTime}`);
            totalHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
            if (totalHours <= 0) {
                alert("เวลาสิ้นสุดต้องหลังเวลาเริ่มต้น");
                return;
            }
        }

        const requestDays = getLeaveDayUnits({
            durationUnit,
            startDate: start,
            endDate: end,
            totalHours,
        });

        let currentQuota = 0;
        if (leaveType === "ลากิจ") currentQuota = quotas.personal.remaining;
        else if (leaveType === "ลาป่วย") currentQuota = quotas.sick.remaining;
        else if (leaveType === "ลาพักร้อน") currentQuota = quotas.vacation.remaining;
        else {
            alert("กรุณาเลือกประเภทการลา");
            return;
        }

        if (requestDays > currentQuota) {
            const requiredText = leaveType === "ลากิจ" ? formatLeaveDayHourUnits(requestDays) : `${requestDays.toFixed(2)} วัน`;
            const remainingText = leaveType === "ลากิจ" ? formatLeaveDayHourUnits(currentQuota) : `${currentQuota.toFixed(2)} วัน`;
            alert(`วันลาคงเหลือไม่เพียงพอ (ต้องการ ${requiredText}, คงเหลือ ${remainingText})`);
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
                endDate: new Date(effectiveEndDate),
                durationUnit,
                ...(durationUnit === "hour" && { startTime, endTime, totalHours }),
                reason,
                status: "รออนุมัติ",
                createdAt: new Date(),
                ...(attachmentBase64 && { attachment: attachmentBase64 }),
            });

            const displayLeave = {
                durationUnit,
                startDate: start,
                endDate: end,
                startTime,
                endTime,
                totalHours,
            };
            const durationText = formatLeaveDuration(displayLeave);
            const dateText = formatLeaveDateRange(displayLeave);

            // Send Flex Message (to user)
            await sendFlexMessage({
                type: `${leaveType} (${durationText})`,
                start: new Date(startDate),
                end: new Date(effectiveEndDate),
                reason,
                dateText,
            });

            // Notify Admin (to group)
            await notifyAdmin({
                type: `${leaveType} (${durationText})`,
                start: new Date(startDate),
                end: new Date(effectiveEndDate),
                reason,
                dateText,
            });

            setShowSuccess(true);

            // Reset
            setLeaveType("");
            setDurationUnit("day");
            setStartDate("");
            setEndDate("");
            setStartTime("");
            setEndTime("");
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
                    <div className="grid grid-cols-3 gap-2.5 mb-5">
                        <div className="h-[92px] rounded-lg border border-blue-100 bg-blue-50/80 px-2 py-3 text-center shadow-sm flex flex-col items-center justify-center">
                            <div className="text-[10px] font-semibold text-blue-700 leading-none">ลากิจ</div>
                            <div className="mt-1.5 whitespace-nowrap text-[18px] font-extrabold text-blue-800 leading-none tracking-normal">
                                {formatCompactPersonalQuota(quotas.personal.remaining)}
                            </div>
                            <div className="mt-3 text-[9px] font-medium text-blue-400 leading-none">
                                ทั้งหมด {formatTotalDays(quotas.personal.total)} วัน
                            </div>
                        </div>
                        <div className="h-[92px] rounded-lg border border-orange-100 bg-orange-50/80 px-2 py-3 text-center shadow-sm flex flex-col items-center justify-center">
                            <div className="text-[10px] font-semibold text-orange-600 leading-none">ลาป่วย</div>
                            <div className="mt-1.5 text-[24px] font-extrabold text-orange-700 leading-none">{quotas.sick.remaining}</div>
                            <div className="mt-3 text-[9px] font-medium text-orange-400 leading-none">จาก {quotas.sick.total}</div>
                        </div>
                        <div className="h-[92px] rounded-lg border border-purple-100 bg-purple-50/80 px-2 py-3 text-center shadow-sm flex flex-col items-center justify-center">
                            <div className="text-[10px] font-semibold text-purple-600 leading-none">พักร้อน</div>
                            <div className="mt-1.5 text-[24px] font-extrabold text-purple-700 leading-none">{quotas.vacation.remaining}</div>
                            <div className="mt-3 text-[9px] font-medium text-purple-400 leading-none">จาก {quotas.vacation.total}</div>
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

                        {leaveType === "ลากิจ" && (
                            <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
                                <button
                                    type="button"
                                    onClick={() => setDurationUnit("day")}
                                    className={`h-10 rounded-lg text-sm font-semibold transition-colors ${durationUnit === "day" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
                                >
                                    เต็มวัน
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDurationUnit("hour");
                                        if (startDate) setEndDate(startDate);
                                    }}
                                    className={`h-10 rounded-lg text-sm font-semibold transition-colors ${durationUnit === "hour" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
                                >
                                    รายชั่วโมง
                                </button>
                            </div>
                        )}

                        <div className={durationUnit === "hour" ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3"}>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">{durationUnit === "hour" ? "วันที่ลา" : "วันที่เริ่ม"}</label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        setStartDate(e.target.value);
                                        if (durationUnit === "hour") setEndDate(e.target.value);
                                    }}
                                    className="h-12 w-full min-w-0 rounded-xl border-gray-200 bg-gray-50/50 appearance-none"
                                    style={{ WebkitAppearance: "none" }}
                                    required
                                />
                            </div>
                            {durationUnit === "day" && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">ถึงวันที่</label>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                                        className="h-12 w-full min-w-0 rounded-xl border-gray-200 bg-gray-50/50 appearance-none"
                                        style={{ WebkitAppearance: "none" }}
                                        min={startDate}
                                        required
                                    />
                                </div>
                            )}
                        </div>

                        {durationUnit === "hour" && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">เวลาเริ่ม</label>
                                    <Input
                                        type="time"
                                        value={startTime}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartTime(e.target.value)}
                                        className="h-12 rounded-xl border-gray-200 bg-gray-50/50"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">เวลาสิ้นสุด</label>
                                    <Input
                                        type="time"
                                        value={endTime}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndTime(e.target.value)}
                                        className="h-12 rounded-xl border-gray-200 bg-gray-50/50"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        {startDate && (durationUnit === "hour" || endDate) && (
                            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                                {formatLeaveDateRange({
                                    durationUnit,
                                    startDate: new Date(startDate),
                                    endDate: new Date(durationUnit === "hour" ? startDate : endDate),
                                    startTime,
                                    endTime,
                                })}
                                {durationUnit === "hour" && startTime && endTime ? (
                                    <span className="ml-2 font-semibold">
                                        {formatLeaveDuration({
                                            durationUnit,
                                            startDate: new Date(startDate),
                                            endDate: new Date(startDate),
                                            totalHours: Math.max(0, (new Date(`${startDate}T${endTime}`).getTime() - new Date(`${startDate}T${startTime}`).getTime()) / (1000 * 60 * 60)),
                                        })}
                                    </span>
                                ) : null}
                            </div>
                        )}

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
