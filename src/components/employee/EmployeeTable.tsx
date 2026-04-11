import { cn } from "@/lib/utils";
import { type Employee } from "@/lib/firestore";
import { Pencil, Trash2, Copy, Check, Eye } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

interface EmployeeTableProps {
    employees: Employee[];
    onEdit: (employee: Employee) => void;
    onDelete: (employee: Employee) => void;
    onView?: (employee: Employee) => void;
    canManage?: boolean;
}

export function EmployeeTable({ employees, onEdit, onDelete, onView, canManage = false }: EmployeeTableProps) {
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleCopyLineId = async (lineUserId: string) => {
        try {
            await navigator.clipboard.writeText(lineUserId);
            setCopiedId(lineUserId);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    return (

        <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-200">
                        <th className="py-4 px-6 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">พนักงาน</th>
                        <th className="py-4 px-6 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">รหัส / ตำแหน่ง</th>
                        <th className="py-4 px-6 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">รูปแบบการจ้าง</th>
                        <th className="py-4 px-6 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">สถานะ</th>
                        <th className="py-4 px-6 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">LINE ID</th>
                        <th className="py-4 px-6 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">จัดการ</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {employees.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="py-12 text-center text-gray-500">
                                ไม่พบข้อมูลพนักงาน
                            </td>
                        </tr>
                    ) : (
                        employees.map((employee) => (
                            <tr key={employee.id} className="hover:bg-gray-50/50 transition-colors group">
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium text-sm shadow-sm ring-2 ring-white">
                                            {employee.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                                            <div className="text-xs text-gray-500">{employee.email || "-"}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-4 px-6">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-gray-900">{employee.position}</span>
                                        <span className="text-xs text-gray-500 font-mono">{employee.employeeId || "-"}</span>
                                    </div>
                                </td>
                                <td className="py-4 px-6">
                                    <div className="flex flex-col gap-1 items-start">
                                        <span className={cn(
                                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                                            employee.type === "รายเดือน"
                                                ? "bg-blue-50 text-blue-700 border-blue-100"
                                                : employee.type === "รายวัน"
                                                    ? "bg-orange-50 text-orange-700 border-orange-100"
                                                    : "bg-purple-50 text-purple-700 border-purple-100"
                                        )}>
                                            {employee.type}
                                        </span>
                                        {employee.employmentType === "ชั่วคราว" && (
                                            <span className="text-[10px] text-gray-500 px-1">
                                                (ชั่วคราว)
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="py-4 px-6">
                                    <span className={cn(
                                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                                        !employee.status || employee.status === "ทำงาน"
                                            ? "bg-green-50 text-green-700 border-green-100"
                                            : "bg-red-50 text-red-700 border-red-100"
                                    )}>
                                        <span className={cn(
                                            "w-1.5 h-1.5 rounded-full mr-1.5",
                                            !employee.status || employee.status === "ทำงาน" ? "bg-green-500" : "bg-red-500"
                                        )} />
                                        {employee.status || "ทำงาน"}
                                    </span>
                                </td>
                                <td className="py-4 px-6">
                                    {employee.lineUserId ? (
                                        <button
                                            onClick={() => handleCopyLineId(employee.lineUserId!)}
                                            className="group/btn flex items-center gap-1.5 px-2 py-1 bg-gray-50 hover:bg-green-50 text-gray-600 hover:text-green-700 rounded transition-colors text-xs border border-gray-200 hover:border-green-200"
                                            title="คลิกเพื่อคัดลอก"
                                        >
                                            <span className="font-mono max-w-[80px] truncate">
                                                {copiedId === employee.lineUserId ? "Copied!" : employee.lineUserId}
                                            </span>
                                            {copiedId === employee.lineUserId ? (
                                                <Check className="w-3 h-3" />
                                            ) : (
                                                <Copy className="w-3 h-3 opacity-50 group-hover/btn:opacity-100" />
                                            )}
                                        </button>
                                    ) : (
                                        <span className="text-xs text-gray-400 italic">ยังไม่เชื่อมต่อ</span>
                                    )}
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {onView && (
                                            <button
                                                onClick={() => onView(employee)}
                                                className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-900 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                                                title="ดูข้อมูล"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        )}
                                        {canManage && (
                                            <>
                                                <button
                                                    onClick={() => onEdit(employee)}
                                                    className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                                    title="แก้ไข"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`คุณต้องการลบพนักงาน "${employee.name}" ใช่หรือไม่?`)) {
                                                            onDelete(employee);
                                                        }
                                                    }}
                                                    className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                    title="ลบ"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
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
    );
}

