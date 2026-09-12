import { cn } from "@/lib/utils";
import { type Admin } from "@/lib/firestore";
import { Pencil, Trash2, ShieldCheck, Shield } from "lucide-react";
import { format } from "date-fns";

interface AdminTableProps {
    admins: Admin[];
    onEdit: (admin: Admin) => void;
    onDelete: (admin: Admin) => void;
    canManage?: boolean;
}

export function AdminTable({ admins, onEdit, onDelete, canManage = false }: AdminTableProps) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-200">
                    <tr>
                        <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">ชื่อผู้ดูแลระบบ</th>
                        <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">อีเมล</th>
                        <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">บทบาท</th>
                        <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">วันที่สร้าง</th>
                        <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">เข้าสู่ระบบล่าสุด</th>
                        {canManage && (
                            <th className="px-3.5 py-2.5 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">จัดการ</th>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {admins.length === 0 ? (
                        <tr>
                            <td colSpan={canManage ? 6 : 5} className="px-4 py-12 text-center text-slate-500 font-normal text-sm">
                                ไม่พบข้อมูลผู้ดูแลระบบ
                            </td>
                        </tr>
                    ) : (
                        admins.map((admin) => (
                            <tr key={admin.id} className="hover:bg-slate-50/60 transition-colors group">
                                {/* Name & Avatar */}
                                <td className="px-3.5 py-2.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-medium text-xs flex items-center justify-center shrink-0 ring-1 ring-slate-200">
                                            {admin.name ? admin.name.charAt(0) : "?"}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-medium text-slate-800 leading-tight">
                                                {admin.name}
                                            </span>
                                            {admin.lineUserId && (
                                                <div
                                                    className="w-4 h-4 bg-[#06C755] rounded-full flex items-center justify-center shrink-0"
                                                    title={`LINE: ${admin.lineUserId}`}
                                                >
                                                    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="white">
                                                        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>

                                {/* Email */}
                                <td className="px-3.5 py-2.5">
                                    <span className="text-sm font-normal text-slate-700">
                                        {admin.email}
                                    </span>
                                </td>

                                {/* Role */}
                                <td className="px-3.5 py-2.5 whitespace-nowrap">
                                    <span className={cn(
                                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-normal border",
                                        admin.role === "super_admin"
                                            ? "bg-purple-50 text-purple-700 border-purple-200/80"
                                            : "bg-blue-50 text-blue-700 border-blue-200/80"
                                    )}>
                                        <span className={cn(
                                            "w-1.5 h-1.5 rounded-full",
                                            admin.role === "super_admin" ? "bg-purple-500" : "bg-blue-500"
                                        )} />
                                        {admin.role === "super_admin" ? "Super Admin" : "Admin"}
                                    </span>
                                </td>

                                {/* Created At */}
                                <td className="px-3.5 py-2.5 whitespace-nowrap">
                                    <span className="text-xs font-normal text-slate-500 tabular-nums">
                                        {admin.createdAt ? format(admin.createdAt, "dd-MM-yyyy") : "-"}
                                    </span>
                                </td>

                                {/* Last Login */}
                                <td className="px-3.5 py-2.5 whitespace-nowrap">
                                    <span className="text-xs font-normal text-slate-500 tabular-nums">
                                        {admin.lastLogin ? format(admin.lastLogin, "dd-MM-yyyy HH:mm") : "-"}
                                    </span>
                                </td>

                                {/* Actions */}
                                {canManage && (
                                    <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                                        <div className="inline-flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => onEdit(admin)}
                                                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title="แก้ไข"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`คุณต้องการลบผู้ดูแลระบบ "${admin.name}" ใช่หรือไม่?`)) {
                                                        onDelete(admin);
                                                    }
                                                }}
                                                className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                title="ลบ"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
