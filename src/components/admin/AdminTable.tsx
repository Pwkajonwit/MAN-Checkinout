import { cn } from "@/lib/utils";
import { type Admin } from "@/lib/firestore";
import { Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface AdminTableProps {
    admins: Admin[];
    onEdit: (admin: Admin) => void;
    onDelete: (admin: Admin) => void;
    canManage?: boolean;
}

export function AdminTable({ admins, onEdit, onDelete, canManage = false }: AdminTableProps) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100 text-left">
                            <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                            <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                            <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
                            <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">Created At</th>
                            <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">Last Login</th>
                            {canManage && <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {admins.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-12 text-center text-gray-500">
                                    ไม่มีข้อมูลผู้ดูแลระบบ
                                </td>
                            </tr>
                        ) : (
                            admins.map((admin) => (
                                <tr key={admin.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                                                {admin.name.charAt(0)}
                                            </div>
                                            <span className="text-sm font-medium text-gray-700">{admin.name}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className="text-sm text-gray-600">{admin.email}</span>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className={cn(
                                            "px-3 py-1 rounded-full text-xs font-medium",
                                            admin.role === "super_admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                                        )}>
                                            {admin.role === "super_admin" ? "Super Admin" : "Admin"}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className="text-sm text-gray-500">
                                            {admin.createdAt ? format(admin.createdAt, "dd-MM-yyyy") : "-"}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className="text-sm text-gray-500">
                                            {admin.lastLogin ? format(admin.lastLogin, "dd-MM-yyyy HH:mm") : "-"}
                                        </span>
                                    </td>
                                    {canManage && (
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => onEdit(admin)}
                                                    className="p-2 hover:bg-blue-50 rounded-lg transition-colors group"
                                                    title="แก้ไข"
                                                >
                                                    <Pencil className="w-4 h-4 text-gray-600 group-hover:text-blue-600" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`คุณต้องการลบผู้ดูแลระบบ "${admin.name}" ใช่หรือไม่?`)) {
                                                            onDelete(admin);
                                                        }
                                                    }}
                                                    className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
                                                    title="ลบ"
                                                >
                                                    <Trash2 className="w-4 h-4 text-gray-600 group-hover:text-red-600" />
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
        </div>
    );
}
