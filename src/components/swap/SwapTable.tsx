import { useState } from "react";
import { cn } from "@/lib/utils";
import { type SwapRequest } from "@/lib/firestore";
import { Check, X, Edit2, Trash2, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";

interface SwapTableProps {
    requests: SwapRequest[];
    onStatusUpdate: (id: string, status: SwapRequest["status"]) => void;
    onEdit?: (request: SwapRequest) => void;
    onDelete?: (id: string) => void;
    isSuperAdmin?: boolean;
}

export function SwapTable({ requests, onStatusUpdate, onEdit, onDelete, isSuperAdmin = false }: SwapTableProps) {
    const getStatusClass = (status: SwapRequest["status"]) => {
        switch (status) {
            case "รออนุมัติ":
                return "bg-yellow-100 text-yellow-700";
            case "อนุมัติ":
                return "bg-green-100 text-green-700";
            case "ไม่อนุมัติ":
                return "bg-red-100 text-red-700";
            default:
                return "bg-gray-100 text-gray-700";
        }
    };

    const formatDate = (date: Date | any) => {
        const d = date instanceof Date ? date : date?.toDate?.() || new Date(date);
        return format(d, "EEE d MMM yy", { locale: th });
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <th className="px-6 py-4">พนักงาน</th>
                            <th className="px-6 py-4">วันมาทำงาน</th>
                            <th className="px-6 py-4">วันหยุดแทน</th>
                            <th className="px-6 py-4">เหตุผล</th>
                            <th className="px-6 py-4">วันที่ขอ</th>
                            <th className="px-6 py-4">สถานะ</th>
                            <th className="px-6 py-4 text-right">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {requests.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                    ไม่พบข้อมูลคำขอสลับวันหยุด
                                </td>
                            </tr>
                        ) : (
                            requests.map((req) => (
                                <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <span className="font-medium text-gray-900">{req.employeeName}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-green-600 font-medium">
                                            {formatDate(req.workDate)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-red-600 font-medium">
                                            {formatDate(req.holidayDate)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-gray-600 text-sm max-w-xs truncate block">
                                            {req.reason || "-"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {formatDate(req.createdAt)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={cn(
                                            "px-3 py-1 rounded-full text-xs font-medium",
                                            getStatusClass(req.status)
                                        )}>
                                            {req.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            {req.status === "รออนุมัติ" && (
                                                <>
                                                    <button
                                                        onClick={() => onStatusUpdate(req.id!, "อนุมัติ")}
                                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                        title="อนุมัติ"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => onStatusUpdate(req.id!, "ไม่อนุมัติ")}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="ไม่อนุมัติ"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                            {isSuperAdmin && (
                                                <>
                                                    {onEdit && (
                                                        <button
                                                            onClick={() => onEdit(req)}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="แก้ไข"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {onDelete && (
                                                        <button
                                                            onClick={() => {
                                                                if (confirm("ยืนยันการลบคำขอนี้?")) {
                                                                    onDelete(req.id!);
                                                                }
                                                            }}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-100">
                {requests.length === 0 ? (
                    <div className="px-6 py-12 text-center text-gray-500">
                        ไม่พบข้อมูลคำขอสลับวันหยุด
                    </div>
                ) : (
                    requests.map((req) => (
                        <div key={req.id} className="p-4 space-y-3">
                            <div className="flex items-start justify-between">
                                <div>
                                    <span className="font-medium text-gray-900">{req.employeeName}</span>
                                    <span className={cn(
                                        "ml-2 px-2 py-0.5 rounded-full text-xs font-medium",
                                        getStatusClass(req.status)
                                    )}>
                                        {req.status}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                                <div className="text-center flex-1">
                                    <span className="text-[10px] text-gray-400 block">มาทำงาน</span>
                                    <span className="font-medium text-green-600 text-sm">
                                        {formatDate(req.workDate)}
                                    </span>
                                </div>
                                <ArrowRight className="w-4 h-4 text-gray-300" />
                                <div className="text-center flex-1">
                                    <span className="text-[10px] text-gray-400 block">หยุดแทน</span>
                                    <span className="font-medium text-red-600 text-sm">
                                        {formatDate(req.holidayDate)}
                                    </span>
                                </div>
                            </div>

                            {req.reason && (
                                <div className="text-sm text-gray-600">
                                    <span className="text-gray-400">เหตุผล:</span> {req.reason}
                                </div>
                            )}

                            <div className="text-xs text-gray-400">
                                ส่งเมื่อ: {formatDate(req.createdAt)}
                            </div>

                            {req.status === "รออนุมัติ" && (
                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={() => onStatusUpdate(req.id!, "อนุมัติ")}
                                        className="flex-1 py-2 bg-green-50 text-green-600 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
                                    >
                                        อนุมัติ
                                    </button>
                                    <button
                                        onClick={() => onStatusUpdate(req.id!, "ไม่อนุมัติ")}
                                        className="flex-1 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                                    >
                                        ไม่อนุมัติ
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
