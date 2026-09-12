"use client";

import { type SwapRequest, type Employee } from "@/lib/firestore";
import { Check, X, Edit2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";

interface SwapTableProps {
    requests: SwapRequest[];
    employees?: Employee[];
    onStatusUpdate: (id: string, status: SwapRequest["status"]) => void;
    onEdit?: (request: SwapRequest) => void;
    onDelete?: (id: string) => void;
    isSuperAdmin?: boolean;
}

export function SwapTable({
    requests,
    employees = [],
    onStatusUpdate,
    onEdit,
    onDelete,
    isSuperAdmin = false,
}: SwapTableProps) {
    const parseDate = (d: any): Date | null => {
        if (!d) return null;
        if (d instanceof Date) return d;
        if (typeof d?.toDate === "function") return d.toDate();
        const parsed = new Date(d);
        return isNaN(parsed.getTime()) ? null : parsed;
    };

    const formatDate = (date: any) => {
        const d = parseDate(date);
        if (!d) return "-";
        return format(d, "EEE d MMM yy", { locale: th });
    };

    const formatShortDate = (date: any) => {
        const d = parseDate(date);
        if (!d) return "-";
        return format(d, "d MMM yyyy", { locale: th });
    };

    const getStatusBadge = (status: SwapRequest["status"]) => {
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
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-200">
                    <tr>
                        <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            พนักงาน
                        </th>
                        <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            วันมาทำงาน
                        </th>
                        <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            วันหยุดแทน
                        </th>
                        <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            เหตุผล
                        </th>
                        <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            วันที่ยื่นขอ
                        </th>
                        <th className="px-3.5 py-2.5 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            สถานะ
                        </th>
                        <th className="px-3.5 py-2.5 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            ดำเนินการ
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {requests.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="px-4 py-12 text-center text-slate-500 font-normal text-sm">
                                ไม่พบข้อมูลคำขอสลับวันหยุดในช่วงเวลาที่เลือก
                            </td>
                        </tr>
                    ) : (
                        requests.map((req) => {
                            const employee = employees.find(
                                (e) => e.id === req.employeeId || e.employeeId === req.employeeId
                            );

                            return (
                                <tr key={req.id} className="hover:bg-slate-50/60 transition-colors group">
                                    {/* Employee */}
                                    <td className="px-3.5 py-2.5">
                                        <div className="flex items-center gap-2.5">
                                            {employee?.avatar ? (
                                                <div className="relative w-7 h-7 shrink-0 rounded-full overflow-hidden ring-1 ring-slate-200">
                                                    <img
                                                        src={employee.avatar}
                                                        alt={req.employeeName}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = "none";
                                                            if (e.currentTarget.nextElementSibling) {
                                                                (e.currentTarget.nextElementSibling as HTMLElement).style.display = "flex";
                                                            }
                                                        }}
                                                    />
                                                    <div className="hidden w-full h-full bg-slate-100 items-center justify-center text-slate-700 font-medium text-xs">
                                                        {req.employeeName ? req.employeeName.charAt(0) : "?"}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-7 h-7 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-medium text-xs ring-1 ring-slate-200">
                                                    {req.employeeName ? req.employeeName.charAt(0) : "?"}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-slate-800 leading-tight truncate">
                                                    {req.employeeName}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Work Date */}
                                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                            <span className="text-sm font-normal text-slate-800">
                                                {formatDate(req.workDate)}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Holiday Date */}
                                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                                            <span className="text-sm font-normal text-slate-800">
                                                {formatDate(req.holidayDate)}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Reason */}
                                    <td className="px-3.5 py-2.5 max-w-[200px]">
                                        <p className="text-sm font-normal text-slate-600 truncate" title={req.reason}>
                                            {req.reason || "-"}
                                        </p>
                                    </td>

                                    {/* Created At */}
                                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                                        <span className="text-xs font-normal text-slate-500">
                                            {formatShortDate(req.createdAt)}
                                        </span>
                                    </td>

                                    {/* Status */}
                                    <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                        {getStatusBadge(req.status)}
                                    </td>

                                    {/* Actions */}
                                    <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                                        <div className="inline-flex items-center justify-end gap-1">
                                            {req.status === "รออนุมัติ" && req.id && (
                                                <>
                                                    <button
                                                        onClick={() => onStatusUpdate(req.id!, "อนุมัติ")}
                                                        className="p-1 bg-white border border-slate-200 rounded text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-colors shadow-2xs"
                                                        title="อนุมัติ"
                                                    >
                                                        <Check className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => onStatusUpdate(req.id!, "ไม่อนุมัติ")}
                                                        className="p-1 bg-white border border-slate-200 rounded text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors shadow-2xs"
                                                        title="ไม่อนุมัติ"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            )}

                                            {isSuperAdmin && req.id && (
                                                <>
                                                    {onEdit && (
                                                        <button
                                                            onClick={() => onEdit(req)}
                                                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors ml-1"
                                                            title="แก้ไข"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {onDelete && (
                                                        <button
                                                            onClick={() => {
                                                                if (
                                                                    confirm(
                                                                        `คุณต้องการลบคำขอสลับวันหยุดของ ${req.employeeName} ใช่หรือไม่?`
                                                                    )
                                                                ) {
                                                                    onDelete(req.id!);
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
    );
}
