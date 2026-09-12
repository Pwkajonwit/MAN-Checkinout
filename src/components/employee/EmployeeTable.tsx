import { cn } from "@/lib/utils";
import { type Employee } from "@/lib/firestore";
import { Pencil, Trash2, Copy, Check, Eye } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatLeaveDayHourUnits } from "@/lib/leaveUtils";

interface EmployeeTableProps {
    employees: Employee[];
    onEdit: (employee: Employee) => void;
    onDelete: (employee: Employee) => void;
    onView?: (employee: Employee) => void;
    canManage?: boolean;
}

export function EmployeeTable({ employees, onEdit, onDelete, onView, canManage = false }: EmployeeTableProps) {
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [avatarOverrides, setAvatarOverrides] = useState<Record<string, string | null>>({});
    const [refreshingAvatarIds, setRefreshingAvatarIds] = useState<Set<string>>(new Set());
    const [failedAvatarIds, setFailedAvatarIds] = useState<Set<string>>(new Set());
    const [brokenAvatarIds, setBrokenAvatarIds] = useState<Set<string>>(new Set());

    const handleCopyLineId = async (lineUserId: string) => {
        try {
            await navigator.clipboard.writeText(lineUserId);
            setCopiedId(lineUserId);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    const refreshLineAvatar = useCallback(async (employee: Employee) => {
        if (!employee.id || !employee.lineUserId || refreshingAvatarIds.has(employee.id)) return;

        setRefreshingAvatarIds(prev => new Set(prev).add(employee.id!));

        try {
            const response = await fetch("/api/line/employee-avatar", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ employeeId: employee.id }),
            });
            const result = await response.json().catch(() => ({ success: false }));

            if (response.ok && result.success) {
                setAvatarOverrides(prev => ({
                    ...prev,
                    [employee.id!]: result.avatar || null,
                }));
                setFailedAvatarIds(prev => {
                    const next = new Set(prev);
                    next.delete(employee.id!);
                    return next;
                });
                setBrokenAvatarIds(prev => {
                    const next = new Set(prev);
                    next.delete(employee.id!);
                    return next;
                });
            } else {
                setFailedAvatarIds(prev => new Set(prev).add(employee.id!));
            }
        } catch (error) {
            void error;
            setFailedAvatarIds(prev => new Set(prev).add(employee.id!));
        } finally {
            setRefreshingAvatarIds(prev => {
                const next = new Set(prev);
                next.delete(employee.id!);
                return next;
            });
        }
    }, [refreshingAvatarIds]);

    useEffect(() => {
        employees.forEach(employee => {
            if (employee.id && employee.lineUserId && !employee.avatar && avatarOverrides[employee.id] === undefined && !failedAvatarIds.has(employee.id)) {
                refreshLineAvatar(employee);
            }
        });
    }, [employees, avatarOverrides, failedAvatarIds, refreshLineAvatar]);

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-200">
                    <tr>
                        <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">พนักงาน</th>
                        <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">รหัส / ตำแหน่ง</th>
                        <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">รูปแบบการจ้าง</th>
                        <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">สิทธิ์ลาคงเหลือ</th>
                        <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">สถานะ</th>
                        <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">LINE ID</th>
                        <th className="px-3.5 py-2.5 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">จัดการ</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {employees.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="px-4 py-12 text-center text-slate-500 font-normal text-sm">
                                ไม่พบข้อมูลพนักงาน
                            </td>
                        </tr>
                    ) : (
                        employees.map((employee) => {
                            const avatar = employee.id && avatarOverrides[employee.id] !== undefined
                                ? avatarOverrides[employee.id]
                                : employee.avatar;
                            const isRefreshingAvatar = Boolean(employee.id && refreshingAvatarIds.has(employee.id));
                            const isBrokenAvatar = Boolean(employee.id && brokenAvatarIds.has(employee.id));

                            return (
                                <tr key={employee.id} className="hover:bg-slate-50/60 transition-colors group">
                                    {/* Name & Avatar */}
                                    <td className="px-3.5 py-2.5">
                                        <div className="flex items-center gap-2.5">
                                            <div className="relative w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-medium text-xs flex items-center justify-center shrink-0 ring-1 ring-slate-200 overflow-hidden">
                                                {avatar && !isBrokenAvatar ? (
                                                    <img
                                                        key={avatar}
                                                        src={avatar}
                                                        alt={employee.name}
                                                        className="h-full w-full object-cover"
                                                        onError={() => {
                                                            if (employee.id && !failedAvatarIds.has(employee.id)) {
                                                                setBrokenAvatarIds(prev => new Set(prev).add(employee.id!));
                                                                refreshLineAvatar(employee);
                                                            }
                                                        }}
                                                    />
                                                ) : (
                                                    employee.name ? employee.name.charAt(0) : "?"
                                                )}
                                                {isRefreshingAvatar && (
                                                    <span className="absolute inset-0 bg-black/20" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-slate-800 leading-tight truncate">
                                                    {employee.name}
                                                </div>
                                                <div className="text-xs font-normal text-slate-500 leading-tight truncate max-w-[160px]">
                                                    {employee.email || "-"}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Position & Employee ID */}
                                    <td className="px-3.5 py-2.5">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-normal text-slate-800 leading-tight truncate">
                                                {employee.position || "-"}
                                            </span>
                                            <span className="text-xs font-normal text-slate-500 font-mono leading-tight">
                                                {employee.employeeId || "-"}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Employment Type */}
                                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                                        <div className="inline-flex items-center gap-1.5">
                                            <span className={cn(
                                                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal border",
                                                employee.type === "รายเดือน"
                                                    ? "bg-blue-50 text-blue-700 border-blue-200/80"
                                                    : employee.type === "รายวัน"
                                                        ? "bg-amber-50 text-amber-800 border-amber-200/80"
                                                        : "bg-purple-50 text-purple-700 border-purple-200/80"
                                            )}>
                                                {employee.type}
                                            </span>
                                            {employee.employmentType === "ชั่วคราว" && (
                                                <span className="text-[11px] text-slate-500">
                                                    (ชั่วคราว)
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Leave Quota */}
                                    <td className="px-3.5 py-2.5">
                                        <div className="space-y-0.5 text-xs">
                                            <div>
                                                <span className="font-normal text-slate-500">ลากิจ:</span>{" "}
                                                <span className="font-medium text-slate-800">
                                                    {formatLeaveDayHourUnits(employee.leaveQuota?.personal || 0)}
                                                </span>
                                            </div>
                                            <div className="text-[11px] font-normal text-slate-400">
                                                ป่วย {employee.leaveQuota?.sick || 0} วัน • พักร้อน {employee.leaveQuota?.vacation || 0} วัน
                                            </div>
                                        </div>
                                    </td>

                                    {/* Status */}
                                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                                        <span className={cn(
                                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal border",
                                            !employee.status || employee.status === "ทำงาน"
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                                                : "bg-rose-50 text-rose-700 border-rose-200/80"
                                        )}>
                                            <span className={cn(
                                                "w-1.5 h-1.5 rounded-full mr-1.5",
                                                !employee.status || employee.status === "ทำงาน" ? "bg-emerald-500" : "bg-rose-500"
                                            )} />
                                            {employee.status || "ทำงาน"}
                                        </span>
                                    </td>

                                    {/* LINE ID */}
                                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                                        {employee.lineUserId ? (
                                            <button
                                                onClick={() => handleCopyLineId(employee.lineUserId!)}
                                                className="group/btn inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded border border-slate-200 hover:border-emerald-200 transition-colors text-xs"
                                                title="คลิกเพื่อคัดลอก LINE User ID"
                                            >
                                                <span className="font-mono max-w-[80px] truncate">
                                                    {copiedId === employee.lineUserId ? "คัดลอกแล้ว!" : employee.lineUserId}
                                                </span>
                                                {copiedId === employee.lineUserId ? (
                                                    <Check className="w-3 h-3 text-emerald-600" />
                                                ) : (
                                                    <Copy className="w-3 h-3 opacity-50 group-hover/btn:opacity-100" />
                                                )}
                                            </button>
                                        ) : (
                                            <span className="text-xs text-slate-400 font-normal">ยังไม่ผูก LINE</span>
                                        )}
                                    </td>

                                    {/* Actions */}
                                    <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                                        <div className="inline-flex items-center justify-end gap-1">
                                            {onView && (
                                                <button
                                                    onClick={() => onView(employee)}
                                                    className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                                                    title="ดูรายละเอียด"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            {canManage && (
                                                <>
                                                    <button
                                                        onClick={() => onEdit(employee)}
                                                        className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                        title="แก้ไข"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm(`คุณต้องการลบพนักงาน "${employee.name}" ใช่หรือไม่?`)) {
                                                                onDelete(employee);
                                                            }
                                                        }}
                                                        className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                        title="ลบ"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
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
