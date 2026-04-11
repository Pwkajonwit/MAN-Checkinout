import { useState } from "react";
import { cn } from "@/lib/utils";
import { type LeaveRequest } from "@/lib/firestore";
import { Check, X, Edit2, Trash2, Image as ImageIcon, X as CloseIcon } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";

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
                            <tr className="bg-white border-b border-gray-100 text-left">
                                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">พนักงาน</th>
                                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">ประเภท</th>
                                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">วันที่ลา</th>
                                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">จำนวน (วัน)</th>
                                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">เหตุผล</th>
                                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">หลักฐาน</th>
                                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">สถานะ</th>
                                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">ดำเนินการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {leaves.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-gray-400 font-light">
                                        ยังไม่มีข้อมูลการลา
                                    </td>
                                </tr>
                            ) : (
                                leaves.map((leave) => (
                                    <tr key={leave.id} className="group hover:bg-gray-50/80 transition-all duration-200">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-medium text-sm border border-gray-200">
                                                    {leave.employeeName.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{leave.employeeName}</div>
                                                    {/* Department not available in LeaveRequest */}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={cn(
                                                "px-2.5 py-1 rounded-md text-xs font-medium border",
                                                leave.leaveType === "ลาพักร้อน" ? "bg-blue-50 text-blue-700 border-blue-100" :
                                                    leave.leaveType === "ลาป่วย" ? "bg-red-50 text-red-700 border-red-100" :
                                                        "bg-amber-50 text-amber-700 border-amber-100"
                                            )}>
                                                {leave.leaveType}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col">
                                                <span className="text-sm text-gray-700 font-medium">
                                                    {leave.startDate ? format(leave.startDate, "d MMM yyyy", { locale: th }) : "-"}
                                                </span>
                                                <span className="text-xs text-gray-400">ถึง</span>
                                                <span className="text-sm text-gray-700 font-medium">
                                                    {leave.endDate ? format(leave.endDate, "d MMM yyyy", { locale: th }) : "-"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className="text-sm font-semibold text-gray-700 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                                                {leave.startDate && leave.endDate
                                                    ? Math.max(1, Math.ceil((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)
                                                    : "-"}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 max-w-[200px]">
                                            <p className="text-sm text-gray-600 truncate" title={leave.reason}>
                                                {leave.reason}
                                            </p>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            {leave.attachment ? (
                                                <button
                                                    onClick={() => setViewingImage(leave.attachment || null)}
                                                    className="inline-flex items-center justify-center p-1.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all shadow-sm"
                                                    title="ดูหลักฐาน"
                                                >
                                                    <ImageIcon className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <span className="text-xs text-gray-300">-</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className={cn(
                                                "px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5",
                                                leave.status === "รออนุมัติ" ? "bg-orange-50 text-orange-700 border border-orange-100" :
                                                    leave.status === "อนุมัติ" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                                                        "bg-red-50 text-red-700 border border-red-100"
                                            )}>
                                                <span className={cn("w-1.5 h-1.5 rounded-full",
                                                    leave.status === "รออนุมัติ" ? "bg-orange-500" :
                                                        leave.status === "อนุมัติ" ? "bg-emerald-500" :
                                                            "bg-red-500"
                                                )}></span>
                                                {leave.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {/* Approve/Reject buttons for pending requests */}
                                                {leave.status === "รออนุมัติ" && leave.id && (
                                                    <>
                                                        <button
                                                            onClick={() => onStatusUpdate(leave.id!, "อนุมัติ")}
                                                            className="p-1.5 bg-white border border-gray-200 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-all shadow-sm"
                                                            title="อนุมัติ"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => onStatusUpdate(leave.id!, "ไม่อนุมัติ")}
                                                            className="p-1.5 bg-white border border-gray-200 rounded-lg text-red-600 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm"
                                                            title="ไม่อนุมัติ"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}

                                                {/* Edit and Delete buttons for super_admin */}
                                                {isSuperAdmin && leave.id && (
                                                    <>
                                                        {onEdit && (
                                                            <button
                                                                onClick={() => onEdit(leave)}
                                                                className="p-1.5 bg-white border border-gray-200 rounded-lg text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm ml-2"
                                                                title="แก้ไข"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {onDelete && (
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm(`คุณต้องการลบคำขอลาของ ${leave.employeeName} ใช่หรือไม่?`)) {
                                                                        onDelete(leave.id!);
                                                                    }
                                                                }}
                                                                className="p-1.5 bg-white border border-gray-200 rounded-lg text-red-600 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm"
                                                                title="ลบ"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
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
