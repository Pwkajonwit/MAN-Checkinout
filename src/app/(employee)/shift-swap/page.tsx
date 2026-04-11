"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { swapService, SwapRequest, systemConfigService } from "@/lib/firestore";
import { EmployeeHeader } from "@/components/mobile/EmployeeHeader";
import { useEmployee } from "@/contexts/EmployeeContext";
import { ArrowLeftRight, Send, CheckCircle, Clock, XCircle, CalendarClock, AlertTriangle, Plus, History } from "lucide-react";

export default function SwapHolidayRequestPage() {
    const { employee } = useEmployee();
    const [activeTab, setActiveTab] = useState<"form" | "history">("form");
    const [workDate, setWorkDate] = useState(""); // วันหยุดที่จะมาทำงาน
    const [holidayDate, setHolidayDate] = useState(""); // วันทำงานที่จะหยุดแทน
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Data
    const [requests, setRequests] = useState<SwapRequest[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [weeklyHolidays, setWeeklyHolidays] = useState<number[]>([0]); // Default: Sunday

    // Load data
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoadingData(true);

                // Load system config for weekly holidays
                const config = await systemConfigService.get();

                // Determine which holidays to use based on useIndividualHolidays setting
                const useIndividualHolidays = config?.useIndividualHolidays ?? false;
                if (useIndividualHolidays && employee?.weeklyHolidays) {
                    // Use employee's individual weekly holidays
                    setWeeklyHolidays(employee.weeklyHolidays);
                } else if (config?.weeklyHolidays) {
                    // Use global weekly holidays
                    setWeeklyHolidays(config.weeklyHolidays);
                }

                // Load request history
                if (employee?.id) {
                    const history = await swapService.getByEmployeeId(employee.id);
                    setRequests(history);
                }
            } catch (error) {
                console.error("Error loading data:", error);
            } finally {
                setLoadingData(false);
            }
        };

        if (employee) {
            loadData();
        }
    }, [employee]);

    const getDayName = (dayIndex: number) => {
        const days = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
        return days[dayIndex];
    };

    const isHoliday = (dateString: string) => {
        const date = new Date(dateString);
        return weeklyHolidays.includes(date.getDay());
    };

    const isWorkday = (dateString: string) => {
        const date = new Date(dateString);
        return !weeklyHolidays.includes(date.getDay());
    };

    const sendFlexMessage = async (data: { workDate: Date, holidayDate: Date }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const liff = (window as any).liff;
        if (liff && liff.isInClient()) {
            try {
                await liff.sendMessages([
                    {
                        type: "flex",
                        altText: "ส่งคำขอสลับวันหยุดสำเร็จ",
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
                                        text: "ขอสลับวันหยุด",
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
                                                        text: "มาทำงาน",
                                                        color: "#aaaaaa",
                                                        size: "sm",
                                                        flex: 2
                                                    },
                                                    {
                                                        type: "text",
                                                        text: data.workDate.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' }),
                                                        wrap: true,
                                                        color: "#22c55e",
                                                        size: "sm",
                                                        weight: "bold",
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
                                                        text: "หยุดแทน",
                                                        color: "#aaaaaa",
                                                        size: "sm",
                                                        flex: 2
                                                    },
                                                    {
                                                        type: "text",
                                                        text: data.holidayDate.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' }),
                                                        wrap: true,
                                                        color: "#ef4444",
                                                        size: "sm",
                                                        weight: "bold",
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

    const notifyAdmin = async (data: { workDate: Date, holidayDate: Date, reason: string }) => {
        try {
            await fetch("/api/line/notify-admin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    type: "swap-holiday",
                    employeeName: employee?.name || "Unknown",
                    details: `มาทำงาน: ${data.workDate.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })} | หยุดแทน: ${data.holidayDate.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}`,
                    reason: data.reason,
                    date: new Date().toISOString()
                }),
            });
        } catch (error) {
            console.error("Error notifying admin:", error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!employee || !workDate || !holidayDate) return;

        const workDateObj = new Date(workDate);
        const holidayDateObj = new Date(holidayDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Validation: dates must be in the future
        if (workDateObj < today || holidayDateObj < today) {
            alert("ไม่สามารถเลือกวันที่ผ่านมาแล้วได้");
            return;
        }

        // Validation: workDate should be a holiday
        if (!isHoliday(workDate)) {
            alert("วันที่จะมาทำงาน ควรเป็นวันหยุดประจำสัปดาห์");
            return;
        }

        // Validation: holidayDate should be a workday
        if (!isWorkday(holidayDate)) {
            alert("วันที่จะหยุดแทน ควรเป็นวันทำงานปกติ");
            return;
        }

        // Validation: dates should be different
        if (workDate === holidayDate) {
            alert("วันที่มาทำงานและวันที่หยุดแทนต้องไม่ใช่วันเดียวกัน");
            return;
        }

        setLoading(true);
        try {
            await swapService.create({
                employeeId: employee.id || "unknown",
                employeeName: employee.name,
                workDate: workDateObj,
                holidayDate: holidayDateObj,
                reason,
                status: "รออนุมัติ",
                createdAt: new Date(),
            });

            // Send Flex Message
            sendFlexMessage({
                workDate: workDateObj,
                holidayDate: holidayDateObj
            }).catch(console.error);

            // Notify Admin
            notifyAdmin({
                workDate: workDateObj,
                holidayDate: holidayDateObj,
                reason
            }).catch(console.error);

            setShowSuccess(true);

            // Reload requests
            const updatedRequests = await swapService.getByEmployeeId(employee.id || "");
            setRequests(updatedRequests);

            // Reset form
            setWorkDate("");
            setHolidayDate("");
            setReason("");

            setTimeout(() => {
                setShowSuccess(false);
                setActiveTab("history"); // Switch to history tab after success
            }, 2000);
        } catch (error) {
            console.error(error);
            alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: SwapRequest["status"]) => {
        switch (status) {
            case "รออนุมัติ":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                        <Clock className="w-3 h-3" /> รออนุมัติ
                    </span>
                );
            case "อนุมัติ":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle className="w-3 h-3" /> อนุมัติ
                    </span>
                );
            case "ไม่อนุมัติ":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        <XCircle className="w-3 h-3" /> ไม่อนุมัติ
                    </span>
                );
        }
    };

    // Count pending requests
    const pendingCount = requests.filter(r => r.status === "รออนุมัติ").length;

    if (loadingData) {
        return (
            <div className="min-h-screen bg-gray-50">
                <EmployeeHeader />
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </div>
        );
    }

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
                            <p className="text-white/90 text-sm">รอการอนุมัติจากหัวหน้า</p>
                        </div>
                    </div>
                </div>
            )}

            <main className="px-6 -mt-6 relative z-10 space-y-4">
                {/* Tab Navigation */}
                <div className="bg-white rounded-2xl p-1.5 shadow-lg border border-gray-100 flex gap-1">
                    <button
                        onClick={() => setActiveTab("form")}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === "form"
                            ? "bg-indigo-600 text-white shadow-md"
                            : "text-gray-500 hover:bg-gray-50"
                            }`}
                    >
                        <Plus className="w-4 h-4" />
                        ส่งคำขอใหม่
                    </button>
                    <button
                        onClick={() => setActiveTab("history")}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all relative ${activeTab === "history"
                            ? "bg-indigo-600 text-white shadow-md"
                            : "text-gray-500 hover:bg-gray-50"
                            }`}
                    >
                        <History className="w-4 h-4" />
                        ประวัติ
                        {pendingCount > 0 && activeTab !== "history" && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 text-white text-xs rounded-full flex items-center justify-center">
                                {pendingCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Form Tab */}
                {activeTab === "form" && (
                    <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100 animate-in fade-in duration-200">
                        {/* Info Box */}
                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-6">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                                <div className="text-sm text-indigo-700">
                                    <p className="font-medium mb-1">วันหยุดประจำสัปดาห์ของคุณ:</p>
                                    <p className="text-indigo-600 font-bold">
                                        {weeklyHolidays.map(d => getDayName(d)).join(", ")}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Work Date - วันหยุดที่จะมาทำงาน */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                    วันที่จะมาทำงาน (วันหยุดปกติ)
                                </label>
                                <Input
                                    type="date"
                                    value={workDate}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWorkDate(e.target.value)}
                                    className="h-12 w-full min-w-0 rounded-xl border-gray-200 bg-green-50/50 appearance-none"
                                    style={{ WebkitAppearance: "none" }}
                                    min={new Date().toISOString().split('T')[0]}
                                    required
                                />
                                {workDate && !isHoliday(workDate) && (
                                    <p className="text-xs text-orange-600 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        วันที่เลือกไม่ใช่วันหยุดประจำสัปดาห์
                                    </p>
                                )}
                            </div>

                            {/* Holiday Date - วันทำงานที่จะหยุดแทน */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                    วันที่จะหยุดแทน (วันทำงานปกติ)
                                </label>
                                <Input
                                    type="date"
                                    value={holidayDate}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHolidayDate(e.target.value)}
                                    className="h-12 w-full min-w-0 rounded-xl border-gray-200 bg-red-50/50 appearance-none"
                                    style={{ WebkitAppearance: "none" }}
                                    min={new Date().toISOString().split('T')[0]}
                                    required
                                />
                                {holidayDate && !isWorkday(holidayDate) && (
                                    <p className="text-xs text-orange-600 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        วันที่เลือกไม่ใช่วันทำงานปกติ
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">เหตุผล</label>
                                <Textarea
                                    value={reason}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                                    placeholder="ระบุเหตุผลที่ต้องการสลับวันหยุด..."
                                    className="min-h-[100px] rounded-xl border-gray-200 bg-gray-50/50 resize-none"
                                    required
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={loading || !workDate || !holidayDate}
                                className="w-full h-14 text-lg rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20 mt-4"
                            >
                                {loading ? "กำลังส่งคำขอ..." : (
                                    <span className="flex items-center gap-2">
                                        ส่งคำขอ <Send className="w-4 h-4" />
                                    </span>
                                )}
                            </Button>
                        </form>
                    </div>
                )}

                {/* History Tab */}
                {activeTab === "history" && (
                    <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100 animate-in fade-in duration-200">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <CalendarClock className="w-5 h-5 text-gray-500" />
                            ประวัติคำขอสลับวันหยุด
                            {requests.length > 0 && (
                                <span className="text-sm font-normal text-gray-400">({requests.length} รายการ)</span>
                            )}
                        </h3>

                        {requests.length === 0 ? (
                            <div className="text-center text-gray-400 py-12">
                                <ArrowLeftRight className="w-16 h-16 mx-auto mb-3 opacity-20" />
                                <p className="text-lg font-medium">ยังไม่มีประวัติคำขอ</p>
                                <p className="text-sm mt-1">กดแท็บ "ส่งคำขอใหม่" เพื่อเริ่มต้น</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {requests.map((req) => (
                                    <div key={req.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                    <span className="text-sm text-gray-600">มาทำงาน:</span>
                                                    <span className="text-sm font-bold text-green-700">
                                                        {req.workDate.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' })}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                                    <span className="text-sm text-gray-600">หยุดแทน:</span>
                                                    <span className="text-sm font-bold text-red-700">
                                                        {req.holidayDate.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                            {getStatusBadge(req.status)}
                                        </div>
                                        {req.reason && (
                                            <div className="text-xs text-gray-500 bg-white rounded-lg p-2 mb-2">
                                                <span className="font-medium">เหตุผล:</span> {req.reason}
                                            </div>
                                        )}
                                        <div className="text-xs text-gray-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            ส่งเมื่อ: {req.createdAt.toLocaleString('th-TH')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
