import { useState } from "react";
import { cn } from "@/lib/utils";
import { type LeaveRequest, type Employee } from "@/lib/firestore";
import { Check, X, Edit2, Trash2, Image as ImageIcon, X as CloseIcon } from "lucide-react";
import { formatLeaveDateRange, formatLeaveDuration, formatLeaveDayHourUnits, getLeaveDayUnits } from "@/lib/leaveUtils";

interface LeaveTableProps {
    leaves: LeaveRequest[];
    employees?: Employee[];
    onStatusUpdate: (id: string, status: LeaveRequest["status"]) => void;
    onEdit?: (leave: LeaveRequest) => void;
    onDelete?: (id: string) => void;
    isSuperAdmin?: boolean;
}

export function LeaveTable({ leaves, employees = [], onStatusUpdate, onEdit, onDelete, isSuperAdmin = false }: LeaveTableProps) {
    const [viewingImage, setViewingImage] = useState<string | null>(null);

    const getLeaveTypeBadge = (leaveType: string) => {
        switch (leaveType) {
            case "ลาพักร้อน":
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal border bg-blue-50 text-blue-700 border-blue-200/80 whitespace-nowrap">
                        {leaveType}
                    </span>
                );
            case "ลาป่วย":
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal border bg-rose-50 text-rose-700 border-rose-200/80 whitespace-nowrap">
                        {leaveType}
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal border bg-amber-50 text-amber-800 border-amber-200/80 whitespace-nowrap">
                        {leaveType}
                    </span>
                );
        }
    };

    const getStatusBadge = (status: LeaveRequest["status"]) => {
        switch (status) {
            case "รออนุมัติ":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-normal border bg-amber-50 text-amber-800 border-amber-200/80 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        รออนุมัติ
                    </span>
                );
            case "อนุมัติ":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-normal border bg-emerald-50 text-emerald-700 border-emerald-200/80 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        อนุมัติ
                    </span>
                );
            case "ไม่อนุมัติ":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-normal border bg-rose-50 text-rose-700 border-rose-200/80 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        ไม่อนุมัติ
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-normal border bg-slate-50 text-slate-700 border-slate-200 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        {status}
                    </span>
                );
        }
    };

    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-200">
                        <tr>
                            <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">พนักงาน</th>
                            <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">ประเภท</th>
                            <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">วันที่ลา</th>
                            <th className="px-3.5 py-2.5 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">ระยะเวลา</th>
                            <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">เหตุผล</th>
                            <th className="px-3.5 py-2.5 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">หลักฐาน</th>
                            <th className="px-3.5 py-2.5 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">สถานะ</th>
                            <th className="px-3.5 py-2.5 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">ดำเนินการ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {leaves.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-12 text-center text-slate-500 font-normal text-sm">
                                    ยังไม่มีข้อมูลการลาในเดือนที่เลือก
                                </td>
                            </tr>
                        ) : (
                            leaves.map((leave) => {
                                const employee = employees.find(e => e.id === leave.employeeId || e.employeeId === leave.employeeId);
                                return (
                                    <tr key={leave.id} className="hover:bg-slate-50/60 transition-colors group">
                                        {/* Employee */}
                                        <td className="px-3.5 py-2.5">
                                            <div className="flex items-center gap-2.5">
                                                {employee?.avatar ? (
                                                    <div className="relative w-7 h-7 shrink-0 rounded-full overflow-hidden ring-1 ring-slate-200">
                                                        <img
                                                            src={employee.avatar}
                                                            alt={leave.employeeName}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = "none";
                                                                if (e.currentTarget.nextElementSibling) {
                                                                    (e.currentTarget.nextElementSibling as HTMLElement).style.display = "flex";
                                                                }
                                                            }}
                                                        />
                                                        <div className="hidden w-full h-full bg-slate-100 items-center justify-center text-slate-700 font-medium text-xs">
                                                            {leave.employeeName ? leave.employeeName.charAt(0) : "?"}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="w-7 h-7 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-medium text-xs ring-1 ring-slate-200">
                                                        {leave.employeeName ? leave.employeeName.charAt(0) : "?"}
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium text-slate-800 leading-tight truncate">
                                                        {leave.employeeName}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Leave Type */}
                                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                                            {getLeaveTypeBadge(leave.leaveType)}
                                        </td>

                                        {/* Date Range */}
                                        <td className="px-3.5 py-2.5">
                                            <div className="flex flex-col">
                                                {leave.startDate && leave.endDate ? (
                                                    formatLeaveDateRange(leave).split(" - ").map((part, index, parts) => (
                                                        <span key={`${index}-${part}`} className="text-sm text-slate-700 font-normal leading-tight">
                                                            {index > 0 && <span className="text-[11px] text-slate-400 mr-1">ถึง</span>}
                                                            {part}
                                                        </span>
                                                    ))
                                                ) : "-"}
                                            </div>
                                        </td>

                                        {/* Duration */}
                                        <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                            <span className="text-xs font-medium text-slate-700 bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200/80">
                                                {leave.startDate && leave.endDate
                                                    ? leave.leaveType === "ลากิจ"
                                                        ? formatLeaveDayHourUnits(getLeaveDayUnits(leave))
                                                        : formatLeaveDuration(leave)
                                                    : "-"}
                                            </span>
                                        </td>

                                        {/* Reason */}
                                        <td className="px-3.5 py-2.5 max-w-[200px]">
                                            <p className="text-sm font-normal text-slate-600 truncate" title={leave.reason}>
                                                {leave.reason || "-"}
                                            </p>
                                        </td>

                                        {/* Attachment */}
                                        <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                            {leave.attachment ? (
                                                <button
                                                    onClick={() => setViewingImage(leave.attachment || null)}
                                                    className="inline-flex items-center justify-center p-1 bg-white border border-slate-200 rounded-md text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors shadow-2xs"
                                                    title="ดูหลักฐาน"
                                                >
                                                    <ImageIcon className="w-3.5 h-3.5" />
                                                </button>
                                            ) : (
                                                <span className="text-xs text-slate-400 font-normal">-</span>
                                            )}
                                        </td>

                                        {/* Status */}
                                        <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                            {getStatusBadge(leave.status)}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                                            <div className="inline-flex items-center justify-end gap-1">
                                                {leave.status === "รออนุมัติ" && leave.id && (
                                                    <>
                                                        <button
                                                            onClick={() => onStatusUpdate(leave.id!, "อนุมัติ")}
                                                            className="p-1 bg-white border border-slate-200 rounded text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-colors shadow-2xs"
                                                            title="อนุมัติ"
                                                        >
                                                            <Check className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => onStatusUpdate(leave.id!, "ไม่อนุมัติ")}
                                                            className="p-1 bg-white border border-slate-200 rounded text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors shadow-2xs"
                                                            title="ไม่อนุมัติ"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </>
                                                )}

                                                {isSuperAdmin && leave.id && (
                                                    <>
                                                        {onEdit && (
                                                            <button
                                                                onClick={() => onEdit(leave)}
                                                                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors ml-1"
                                                                title="แก้ไข"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        {onDelete && (
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm(`คุณต้องการลบคำขอลาของ ${leave.employeeName} ใช่หรือไม่?`)) {
                                                                        onDelete(leave.id!);
                                                                    }
                                                                }}
                                                                className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                                title="ลบ"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Evidence Image Modal */}
            {viewingImage && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150"
                    onClick={() => setViewingImage(null)}
                >
                    <div className="relative max-w-3xl max-h-[85vh] w-full" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setViewingImage(null)}
                            className="absolute -top-10 right-0 text-white hover:text-slate-200 p-1 rounded-full transition-colors"
                        >
                            <CloseIcon className="w-5 h-5" />
                        </button>
                        <img
                            src={viewingImage}
                            alt="Evidence"
                            className="w-full h-full object-contain max-h-[85vh] rounded-xl shadow-2xl"
                        />
                    </div>
                </div>
            )}
        </>
    );
}
