"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { LeaveTable } from "@/components/leave/LeaveTable";
import { LeaveFormModal } from "@/components/leave/LeaveFormModal";
import { Button } from "@/components/ui/button";
import { Plus, Clock, CheckCircle, XCircle, FileText } from "lucide-react";
import { leaveService, type LeaveRequest, employeeService, adminService } from "@/lib/firestore";
import { sendPushMessage } from "@/app/actions/line";
import { auth } from "@/lib/firebase";
import { CustomAlert } from "@/components/ui/custom-alert";
import { formatLeaveDateRange, formatLeaveDuration } from "@/lib/leaveUtils";

export default function LeavePage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
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

    const loadLeaves = async () => {
        try {
            const data = await leaveService.getAll();
            setLeaves(data);
        } catch (error) {
            console.error("Error loading leaves:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLeaves();

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

    const handleAddLeave = () => {
        setSelectedLeave(null);
        setIsModalOpen(true);
    };

    const handleEditLeave = (leave: LeaveRequest) => {
        setSelectedLeave(leave);
        setIsModalOpen(true);
    };

    const handleDeleteLeave = async (id: string) => {
        try {
            await leaveService.delete(id);
            loadLeaves();
        } catch (error) {
            console.error("Error deleting leave:", error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เกิดข้อผิดพลาดในการลบคำขอลา",
                type: "error"
            });
        }
    };

    const handleSuccess = () => {
        loadLeaves();
    };

    const handleStatusUpdate = async (id: string, status: LeaveRequest["status"]) => {
        try {
            await leaveService.updateStatus(id, status);

            // Find the request and employee to send notification
            const request = leaves.find(l => l.id === id);
            if (request) {
                const employee = await employeeService.getById(request.employeeId);
                if (employee && employee.lineUserId) {
                    const isApproved = status === "อนุมัติ";
                    const color = isApproved ? "#1DB446" : "#D32F2F";
                    const title = isApproved ? "อนุมัติคำขอลา" : "ไม่อนุมัติคำขอลา";

                    const dateStr = `${formatLeaveDateRange(request)} (${formatLeaveDuration(request)})`;

                    await sendPushMessage(employee.lineUserId, [
                        {
                            type: "flex",
                            altText: `ผลการพิจารณาการลา: ${status}`,
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
                                                            text: "ประเภท",
                                                            color: "#aaaaaa",
                                                            size: "sm",
                                                            flex: 1
                                                        },
                                                        {
                                                            type: "text",
                                                            text: request.leaveType,
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
                                                            text: dateStr,
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
                                                            text: "สถานะ",
                                                            color: "#aaaaaa",
                                                            size: "sm",
                                                            flex: 1
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

            loadLeaves();
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
        pending: leaves.filter(l => l.status === "รออนุมัติ").length,
        approved: leaves.filter(l => l.status === "อนุมัติ").length,
        rejected: leaves.filter(l => l.status === "ไม่อนุมัติ").length,
        total: leaves.length,
    };

    return (
        <div>
            <PageHeader
                title="ข้อมูลการลา"
                subtitle={`${leaves.length} results found`}
                searchPlaceholder="Employee |"
                action={
                    <div className="flex gap-2">
                        <Button
                            onClick={handleAddLeave}
                            className="bg-primary-dark hover:bg-primary-dark/90 text-white rounded-xl px-6 gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            เพิ่มการลางาน
                        </Button>

                    </div>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatsCard
                    title="รอการอนุมัติ"
                    value={stats.pending}
                    icon={<Clock className="w-5 h-5 text-orange-600" />}
                    onClick={() => setStatusFilter(statusFilter === "รออนุมัติ" ? "all" : "รออนุมัติ")}
                    isActive={statusFilter === "รออนุมัติ"}
                    className="border-orange-100 bg-orange-50/50 hover:border-orange-200"
                />
                <StatsCard
                    title="อนุมัติแล้ว"
                    value={stats.approved}
                    icon={<CheckCircle className="w-5 h-5 text-green-600" />}
                    onClick={() => setStatusFilter(statusFilter === "อนุมัติ" ? "all" : "อนุมัติ")}
                    isActive={statusFilter === "อนุมัติ"}
                    className="border-green-100 bg-green-50/50 hover:border-green-200"
                />
                <StatsCard
                    title="ไม่อนุมัติ"
                    value={stats.rejected}
                    icon={<XCircle className="w-5 h-5 text-red-600" />}
                    onClick={() => setStatusFilter(statusFilter === "ไม่อนุมัติ" ? "all" : "ไม่อนุมัติ")}
                    isActive={statusFilter === "ไม่อนุมัติ"}
                    className="border-red-100 bg-red-50/50 hover:border-red-200"
                />
                <StatsCard
                    title="ทั้งหมด"
                    value={stats.total}
                    icon={<FileText className="w-5 h-5 text-blue-600" />}
                    onClick={() => setStatusFilter("all")}
                    isActive={statusFilter === "all"}
                    className="border-blue-100 bg-blue-50/50 hover:border-blue-200"
                />
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="w-12 h-12 border-4 border-gray-100 border-t-primary rounded-full animate-spin mx-auto"></div>
                    <p className="text-gray-600 mt-4">กำลังโหลดข้อมูล...</p>
                </div>
            ) : (
                <LeaveTable
                    leaves={statusFilter === "all" ? leaves : leaves.filter(l => l.status === statusFilter)}
                    onStatusUpdate={handleStatusUpdate}
                    onEdit={handleEditLeave}
                    onDelete={handleDeleteLeave}
                    isSuperAdmin={isSuperAdmin}
                />
            )}

            <LeaveFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                leave={selectedLeave}
                onSuccess={handleSuccess}
            />

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
