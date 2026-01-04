import { useState } from "react";
import { cn } from "@/lib/utils";
import { type LeaveRequest } from "@/lib/firestore";
import { Check, X, Edit2, Trash2, Image as ImageIcon, X as CloseIcon } from "lucide-react";
import { format } from "date-fns";

interface LeaveTableProps {
    leaves: LeaveRequest[];
    onStatusUpdate: (id: string, status: LeaveRequest["status"]) => void;
    onEdit?: (leave: LeaveRequest) => void;
    onDelete?: (id: string) => void;
    isSuperAdmin?: boolean;
}

export function LeaveTable({ leaves, onStatusUpdate, onEdit, onDelete, isSuperAdmin = false }: LeaveTableProps) {
    const [viewingImage, setViewingImage] = useState<string | null>(null);

    return (
        <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100 text-left">
                                <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                                <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">ประเภท</th>
                                <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">วันที่ขอลา</th>
                                <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">จำนวนวัน</th>
                                <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">เหตุผล</th>
                                <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">หลักฐาน</th>
                                <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">สถานะ</th>
                                <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {leaves.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-gray-500">
                                        ไม่มีข้อมูลการลา
                                    </td>
                                </tr>
                            ) : (
                                leaves.map((leave) => (
                                    <tr key={leave.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                                                    {leave.employeeName.charAt(0)}
                                                </div>
                                                <span className="text-sm font-medium text-gray-700">{leave.employeeName}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={cn(
                                                "px-3 py-1 rounded-full text-xs font-medium",
                                                leave.leaveType === "ลาพักร้อน" ? "bg-blue-100 text-blue-700" :
                                                    leave.leaveType === "ลาป่วย" ? "bg-red-100 text-red-700" :
                                                        "bg-yellow-100 text-yellow-700"
                                            )}>
                                                {leave.leaveType}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-sm text-gray-600">
                                                {leave.startDate ? format(leave.startDate, "dd-MM-yyyy") : "-"} ถึง{" "}
                                                {leave.endDate ? format(leave.endDate, "dd-MM-yyyy") : "-"}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-sm font-semibold text-gray-700">
                                                {leave.startDate && leave.endDate
                                                    ? Math.max(1, Math.ceil((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)
                                                    : "-"}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-sm text-gray-600 line-clamp-2">{leave.reason}</span>
                                        </td>
                                        <td className="py-4 px-6">
                                            {leave.attachment ? (
                                                <button
                                                    onClick={() => setViewingImage(leave.attachment || null)}
                                                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors group"
                                                    title="ดูหลักฐาน"
                                                >
                                                    <ImageIcon className="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
                                                </button>
                                            ) : (
                                                <span className="text-xs text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={cn(
                                                "px-3 py-1 rounded-full text-xs font-medium",
                                                leave.status === "รออนุมัติ" ? "bg-orange-100 text-orange-700" :
                                                    leave.status === "อนุมัติ" ? "bg-green-100 text-green-700" :
                                                        "bg-red-100 text-red-700"
                                            )}>
                                                {leave.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex gap-2">
                                                {/* Approve/Reject buttons for pending requests */}
                                                {leave.status === "รออนุมัติ" && leave.id && (
                                                    <>
                                                        <button
                                                            onClick={() => onStatusUpdate(leave.id!, "อนุมัติ")}
                                                            className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                                                            title="อนุมัติ"
                                                        >
                                                            <Check className="w-4 h-4 text-green-600" />
                                                        </button>
                                                        <button
                                                            onClick={() => onStatusUpdate(leave.id!, "ไม่อนุมัติ")}
                                                            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                                            title="ไม่อนุมัติ"
                                                        >
                                                            <X className="w-4 h-4 text-red-600" />
                                                        </button>
                                                    </>
                                                )}

                                                {/* Edit and Delete buttons for super_admin */}
                                                {isSuperAdmin && leave.id && (
                                                    <>
                                                        {onEdit && (
                                                            <button
                                                                onClick={() => onEdit(leave)}
                                                                className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                                                                title="แก้ไข"
                                                            >
                                                                <Edit2 className="w-4 h-4 text-blue-600" />
                                                            </button>
                                                        )}
                                                        {onDelete && (
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm(`คุณต้องการลบคำขอลาของ ${leave.employeeName} ใช่หรือไม่?`)) {
                                                                        onDelete(leave.id!);
                                                                    }
                                                                }}
                                                                className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                                                title="ลบ"
                                                            >
                                                                <Trash2 className="w-4 h-4 text-red-600" />
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Image Preview Modal */}
            {viewingImage && (
                <div
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
                    onClick={() => setViewingImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] w-full">
                        <button
                            onClick={() => setViewingImage(null)}
                            className="absolute -top-12 right-0 text-white hover:text-gray-300 p-2"
                        >
                            <CloseIcon className="w-8 h-8" />
                        </button>
                        <img
                            src={viewingImage}
                            alt="Evidence"
                            className="w-full h-full object-contain max-h-[90vh] rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
