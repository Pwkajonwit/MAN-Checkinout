"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { startOfMonth, endOfMonth, format, subMonths, addMonths } from "date-fns";
import { th } from "date-fns/locale";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { SwapTable } from "@/components/swap/SwapTable";
import { swapService, type SwapRequest, employeeService, type Employee, adminService } from "@/lib/firestore";
import { sendPushMessage } from "@/app/actions/line";
import { auth } from "@/lib/firebase";
import { CustomAlert } from "@/components/ui/custom-alert";

export default function SwapPage() {
    const [requests, setRequests] = useState<SwapRequest[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [statusFilter, setStatusFilter] = useState<"all" | "รออนุมัติ" | "อนุมัติ" | "ไม่อนุมัติ">("all");
    const [alertState, setAlertState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: "success" | "error" | "warning" | "info";
    }>({
        isOpen: false,
        title: "",
        message: "",
        type: "info"
    });

    const loadData = async () => {
        try {
            const [swapData, empData] = await Promise.all([
                swapService.getByDateRange(startOfMonth(currentDate), endOfMonth(currentDate)),
                employeeService.getActive()
            ]);
            setRequests(swapData);
            setEmployees(empData);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentDate]);

    useEffect(() => {
        // Check if current user is super_admin
        const checkAdminRole = async () => {
            const user = auth.currentUser;
            if (user?.email) {
                const admin = await adminService.getByEmail(user.email);
                if (admin?.role === "super_admin") {
                    setIsSuperAdmin(true);
                }
            }
        };
        checkAdminRole();
    }, []);

    const handleDeleteRequest = async (id: string) => {
        try {
            await swapService.delete(id);
            loadData();
            setAlertState({
                isOpen: true,
                title: "สำเร็จ",
                message: "ลบคำขอสลับวันหยุดเรียบร้อยแล้ว",
                type: "success"
            });
        } catch (error) {
            console.error("Error deleting swap request:", error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เกิดข้อผิดพลาดในการลบคำขอ",
                type: "error"
            });
        }
    };

    const handleStatusUpdate = async (id: string, status: SwapRequest["status"]) => {
        try {
            await swapService.updateStatus(id, status);

            // Find the request and employee to send notification
            const request = requests.find(r => r.id === id);
            if (request) {
                const employee = await employeeService.getById(request.employeeId);
                if (employee && employee.lineUserId) {
                    const isApproved = status === "อนุมัติ";
                    const color = isApproved ? "#1DB446" : "#D32F2F";
                    const title = isApproved ? "อนุมัติคำขอสลับวันหยุด" : "ไม่อนุมัติคำขอสลับวันหยุด";

                    const workDate = request.workDate instanceof Date ? request.workDate : new Date(request.workDate);
                    const holidayDate = request.holidayDate instanceof Date ? request.holidayDate : new Date(request.holidayDate);

                    await sendPushMessage(employee.lineUserId, [
                        {
                            type: "flex",
                            altText: `ผลการพิจารณาสลับวันหยุด: ${status}`,
                            contents: {
                                type: "bubble",
                                header: {
                                    type: "box",
                                    layout: "vertical",
                                    contents: [
                                        {
                                            type: "text",
                                            text: title,
                                            weight: "bold",
                                            color: color,
                                            size: "lg"
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
                                                            text: workDate.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' }),
                                                            wrap: true,
                                                            color: "#22c55e",
                                                            size: "sm",
                                                            flex: 5,
                                                            weight: "bold"
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
                                                            text: holidayDate.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' }),
                                                            wrap: true,
                                                            color: "#ef4444",
                                                            size: "sm",
                                                            flex: 5,
                                                            weight: "bold"
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
                                                            text: "สถานะ",
                                                            color: "#aaaaaa",
                                                            size: "sm",
                                                            flex: 2
                                                        },
                                                        {
                                                            type: "text",
                                                            text: status,
                                                            wrap: true,
                                                            color: color,
                                                            size: "sm",
                                                            flex: 5,
                                                            weight: "bold"
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
                }
            }

            loadData();
            setAlertState({
                isOpen: true,
                title: "สำเร็จ",
                message: `${status === "อนุมัติ" ? "อนุมัติ" : "ปฏิเสธ"}คำขอเรียบร้อยแล้ว`,
                type: "success"
            });
        } catch (error) {
            console.error("Error updating status:", error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เกิดข้อผิดพลาดในการอัพเดทสถานะ",
                type: "error"
            });
        }
    };

    // Calculate stats
    const stats = {
        pending: requests.filter(r => r.status === "รออนุมัติ").length,
        approved: requests.filter(r => r.status === "อนุมัติ").length,
        rejected: requests.filter(r => r.status === "ไม่อนุมัติ").length,
        total: requests.length,
    };

    return (
        <div>
            <PageHeader
                title="คำขอสลับวันหยุด"
                subtitle={`${requests.length} รายการทั้งหมด`}
                action={
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm mr-2">
                        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="font-semibold text-gray-700 min-w-[120px] text-center">
                            {format(currentDate, "MMMM yyyy", { locale: th })}
                        </span>
                        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatsCard
                    title="รอการอนุมัติ"
                    value={stats.pending}
                    onClick={() => setStatusFilter(statusFilter === "รออนุมัติ" ? "all" : "รออนุมัติ")}
                    isActive={statusFilter === "รออนุมัติ"}
                />
                <StatsCard
                    title="อนุมัติ"
                    value={stats.approved}
                    onClick={() => setStatusFilter(statusFilter === "อนุมัติ" ? "all" : "อนุมัติ")}
                    isActive={statusFilter === "อนุมัติ"}
                />
                <StatsCard
                    title="ไม่อนุมัติ"
                    value={stats.rejected}
                    onClick={() => setStatusFilter(statusFilter === "ไม่อนุมัติ" ? "all" : "ไม่อนุมัติ")}
                    isActive={statusFilter === "ไม่อนุมัติ"}
                />
                <StatsCard
                    title="ทั้งหมด"
                    value={stats.total}
                    onClick={() => setStatusFilter("all")}
                    isActive={statusFilter === "all"}
                />
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="w-12 h-12 border-4 border-gray-100 border-t-primary rounded-full animate-spin mx-auto"></div>
                    <p className="text-gray-600 mt-4">กำลังโหลดข้อมูล...</p>
                </div>
            ) : (
                <SwapTable
                    requests={statusFilter === "all" ? requests : requests.filter(r => r.status === statusFilter)}
                    employees={employees}
                    onStatusUpdate={handleStatusUpdate}
                    onDelete={handleDeleteRequest}
                    isSuperAdmin={isSuperAdmin}
                />
            )}

            <CustomAlert
                isOpen={alertState.isOpen}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
                title={alertState.title}
                message={alertState.message}
                type={alertState.type}
            />
        </div>
    );
}
