import { cn } from "@/lib/utils";
import { type OTRequest } from "@/lib/firestore";
import { Check, X, Edit2, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface OTTableProps {
    otRequests: OTRequest[];
    onStatusUpdate: (id: string, status: OTRequest["status"]) => void;
    onEdit?: (ot: OTRequest) => void;
    onDelete?: (id: string) => void;
    isSuperAdmin?: boolean;
}

export function OTTable({ otRequests, onStatusUpdate, onEdit, onDelete, isSuperAdmin = false }: OTTableProps) {
    const calculateHours = (startTime: Date, endTime: Date) => {
        const diff = endTime.getTime() - startTime.getTime();
        return (diff / (1000 * 60 * 60)).toFixed(1);
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100 text-left">
                            <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                            <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">วันที่</th>
                            <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">เวลา</th>
                            <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">ชั่วโมง</th>
                            <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">เหตุผล</th>
                            <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">สถานะ</th>
                            <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {otRequests.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="py-12 text-center text-gray-500">
                                    ไม่มีข้อมูลการขอ OT
                                </td>
                            </tr>
                        ) : (
                            otRequests.map((ot) => (
                                <tr key={ot.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-semibold text-sm">
                                                {ot.employeeName.charAt(0)}
                                            </div>
                                            <span className="text-sm font-medium text-gray-700">{ot.employeeName}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className="text-sm text-gray-600">
                                            {ot.date ? format(ot.date, "dd-MM-yyyy") : "-"}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className="text-sm text-gray-600">
                                            {ot.startTime ? format(ot.startTime, "HH:mm") : "-"} -{" "}
                                            {ot.endTime ? format(ot.endTime, "HH:mm") : "-"}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className="text-sm font-semibold text-gray-700">
                                            {ot.startTime && ot.endTime ? calculateHours(ot.startTime, ot.endTime) : "-"}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className="text-sm text-gray-600 line-clamp-2">{ot.reason}</span>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className={cn(
                                            "px-3 py-1 rounded-full text-xs font-medium",
                                            ot.status === "รออนุมัติ" ? "bg-orange-100 text-orange-700" :
                                                ot.status === "อนุมัติ" ? "bg-green-100 text-green-700" :
                                                    "bg-red-100 text-red-700"
                                        )}>
                                            {ot.status}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex gap-2">
                                            {/* Approve/Reject buttons for pending requests */}
                                            {ot.status === "รออนุมัติ" && ot.id && (
                                                <>
                                                    <button
                                                        onClick={() => onStatusUpdate(ot.id!, "อนุมัติ")}
                                                        className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                                                        title="อนุมัติ"
                                                    >
                                                        <Check className="w-4 h-4 text-green-600" />
                                                    </button>
                                                    <button
                                                        onClick={() => onStatusUpdate(ot.id!, "ไม่อนุมัติ")}
                                                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                                        title="ไม่อนุมัติ"
                                                    >
                                                        <X className="w-4 h-4 text-red-600" />
                                                    </button>
                                                </>
                                            )}

                                            {/* Edit and Delete buttons for super_admin */}
                                            {isSuperAdmin && ot.id && (
                                                <>
                                                    {onEdit && (
                                                        <button
                                                            onClick={() => onEdit(ot)}
                                                            className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                                                            title="แก้ไข"
                                                        >
                                                            <Edit2 className="w-4 h-4 text-blue-600" />
                                                        </button>
                                                    )}
                                                    {onDelete && (
                                                        <button
                                                            onClick={() => {
                                                                if (confirm(`คุณต้องการลบคำขอ OT ของ ${ot.employeeName} ใช่หรือไม่?`)) {
                                                                    onDelete(ot.id!);
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
    );
}
