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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100 text-left">
                            <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                            <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">รหัสพนักงาน</th>
                            <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">LINE ID</th>
                            <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">แผนก/ตำแหน่ง</th>
                            <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">ข้อมูลการลา</th>
                            <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">พนักงาน</th>
                            <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {employees.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="py-12 text-center text-gray-500">
                                    ไม่มีข้อมูลพนักงาน
                                </td>
                            </tr>
                        ) : (
                            employees.map((employee) => (
                                <tr key={employee.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                                                {employee.name.charAt(0)}
                                            </div>
                                            <span className="text-sm font-medium text-gray-700">{employee.name}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className="text-sm text-gray-600 font-mono">
                                            {employee.employeeId || "-"}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6">
                                        {employee.lineUserId ? (
                                            <button
                                                onClick={() => handleCopyLineId(employee.lineUserId!)}
                                                className="p-2 bg-green-50 hover:bg-green-100 rounded-lg transition-colors border border-green-200"
                                                title={`คัดลอก: ${employee.lineUserId}`}
                                            >
                                                {copiedId === employee.lineUserId ? (
                                                    <Check className="w-4 h-4 text-green-600" />
                                                ) : (
                                                    <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                                                    </svg>
                                                )}
                                            </button>
                                        ) : (
                                            <span className="text-xs text-gray-400">-</span>
                                        )}
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-gray-700">{employee.position}</span>
                                            {employee.department && (
                                                <span className="text-xs text-gray-500">{employee.department}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className="text-xs text-gray-500">
                                            กิจ {employee.leaveQuota.personal} ป่วย {employee.leaveQuota.sick} พัก {employee.leaveQuota.vacation}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex flex-col gap-1">
                                            <span className={cn(
                                                "px-3 py-1 rounded-full text-xs font-medium w-fit",
                                                employee.type === "รายเดือน" ? "bg-blue-100 text-blue-700" :
                                                    employee.type === "รายวัน" ? "bg-green-100 text-green-700" :
                                                        "bg-orange-100 text-orange-700"
                                            )}>
                                                {employee.type}
                                            </span>
                                            {employee.status && employee.status !== "ทำงาน" && (
                                                <span className={cn(
                                                    "px-3 py-1 rounded-full text-xs font-medium w-fit",
                                                    employee.status === "ลาออก" ? "bg-red-100 text-red-700" :
                                                        "bg-gray-100 text-gray-700"
                                                )}>
                                                    {employee.status}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-2">
                                            {onView && (
                                                <button
                                                    onClick={() => onView(employee)}
                                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors group"
                                                    title="ดูข้อมูล"
                                                >
                                                    <Eye className="w-4 h-4 text-gray-600 group-hover:text-gray-900" />
                                                </button>
                                            )}
                                            {canManage && (
                                                <>
                                                    <button
                                                        onClick={() => onEdit(employee)}
                                                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors group"
                                                        title="แก้ไข"
                                                    >
                                                        <Pencil className="w-4 h-4 text-gray-600 group-hover:text-blue-600" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm(`คุณต้องการลบพนักงาน "${employee.name}" ใช่หรือไม่?`)) {
                                                                onDelete(employee);
                                                            }
                                                        }}
                                                        className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
                                                        title="ลบ"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-gray-600 group-hover:text-red-600" />
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
        </div>
    );
}
