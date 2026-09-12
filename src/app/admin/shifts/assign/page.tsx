"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { employeeService, shiftService, type Employee, type Shift } from "@/lib/firestore";
import { useAdmin } from "@/components/auth/AuthProvider";
import { Clock, GripVertical, ArrowLeft, Users, Info } from "lucide-react";
import { CustomAlert } from "@/components/ui/custom-alert";

export default function ShiftAssignmentPage() {
    const { user } = useAdmin();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [draggedEmployee, setDraggedEmployee] = useState<Employee | null>(null);
    const [alertState, setAlertState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: "success" | "error" | "warning" | "info";
    }>({
        isOpen: false,
        title: "",
        message: "",
        type: "info",
    });

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user]);

    const loadData = async () => {
        try {
            const [empData, shiftData] = await Promise.all([
                employeeService.getActive(),
                shiftService.getAll(),
            ]);
            setEmployees(empData.filter((e) => e.status === "ทำงาน"));
            setShifts(shiftData);
        } catch (error) {
            console.error("Error loading data:", error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เกิดข้อผิดพลาดในการโหลดข้อมูล",
                type: "error",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDrop = async (shiftId: string | null) => {
        if (!draggedEmployee?.id) return;

        setSaving(draggedEmployee.id);
        try {
            await employeeService.update(draggedEmployee.id, { shiftId: shiftId || undefined });
            setEmployees((prev) =>
                prev.map((e) =>
                    e.id === draggedEmployee.id ? { ...e, shiftId: shiftId || undefined } : e
                )
            );
            setAlertState({
                isOpen: true,
                title: "สำเร็จ",
                message: `อัปเดตกะของ ${draggedEmployee.name} เรียบร้อยแล้ว`,
                type: "success",
            });
        } catch (error) {
            console.error("Error updating shift:", error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เกิดข้อผิดพลาดในการอัปเดตกะ",
                type: "error",
            });
        } finally {
            setSaving(null);
            setDraggedEmployee(null);
        }
    };

    const formatTime = (hour: number, minute: number) => {
        return `${(hour ?? 0).toString().padStart(2, "0")}:${(minute ?? 0).toString().padStart(2, "0")} น.`;
    };

    const getEmployeesForShift = (shiftId: string | null) => {
        if (shiftId === null) {
            return employees.filter((e) => !e.shiftId);
        }
        return employees.filter((e) => e.shiftId === shiftId);
    };

    // All shift columns including default
    const allShiftColumns = [
        {
            id: null,
            name: "กะหลัก (Default)",
            subtitle: "ใช้ค่ากะหลักของระบบ",
            headerBg: "bg-slate-50",
            badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
        },
        ...shifts.map((s) => ({
            id: s.id,
            name: s.name,
            subtitle: `${formatTime(s.checkInHour, s.checkInMinute)} - ${formatTime(s.checkOutHour, s.checkOutMinute)}`,
            headerBg: s.isDefault ? "bg-amber-50/60" : "bg-blue-50/60",
            badgeColor: s.isDefault
                ? "bg-amber-100 text-amber-800 border-amber-200"
                : "bg-blue-100 text-blue-800 border-blue-200",
        })),
    ];

    if (!user) {
        return (
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-12 text-center text-slate-500 font-normal">
                กรุณาเข้าสู่ระบบเพื่อกำหนดกะพนักงาน
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
                <div>
                    <div className="flex items-center gap-2.5">
                        <Link
                            href="/admin/shifts"
                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                            title="กลับไปยังจัดการกะ"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                            กำหนดกะพนักงาน
                        </h1>
                        <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            Shift Assignments
                        </span>
                        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            พนักงาน {employees.length} คน
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm font-normal text-slate-500 mt-1">
                        ลากการ์ดพนักงานแล้วปล่อยในคอลัมน์กะที่ต้องการเพื่อเปลี่ยนกะทำงาน
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Link
                        href="/admin/shifts"
                        className="h-9 inline-flex items-center gap-1.5 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs sm:text-sm font-medium shadow-2xs transition-all"
                    >
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>จัดการกะเวลา</span>
                    </Link>
                </div>
            </div>

            {/* Hint Notice */}
            <div className="bg-blue-50/60 border border-blue-200/70 rounded-xl p-2.5 px-3 flex items-center gap-2 text-xs font-normal text-blue-800">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>คลิกค้างแล้วลากการ์ดพนักงานไปยังคอลัมน์กะที่ต้องการ ข้อมูลจะบันทึกอัตโนมัติทันที</span>
            </div>

            {/* Board Columns */}
            {loading ? (
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-10 text-center text-slate-500 font-normal">
                    <div className="animate-spin w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                    กำลังโหลดข้อมูลการจัดกะ...
                </div>
            ) : (
                <div
                    className="grid gap-3 overflow-x-auto pb-2"
                    style={{
                        gridTemplateColumns: `repeat(${allShiftColumns.length}, minmax(240px, 1fr))`,
                    }}
                >
                    {allShiftColumns.map((column) => {
                        const shiftEmployees = getEmployeesForShift(column.id || null);

                        return (
                            <div
                                key={column.id || "default"}
                                className={`rounded-xl border bg-slate-50/60 transition-all flex flex-col min-h-[460px] ${
                                    draggedEmployee
                                        ? "border-dashed border-slate-400/80 bg-slate-100/50"
                                        : "border-slate-200/90"
                                }`}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => handleDrop(column.id || null)}
                            >
                                {/* Column Header */}
                                <div className={`p-3 border-b border-slate-200/80 rounded-t-xl ${column.headerBg}`}>
                                    <div className="flex items-center justify-between gap-1.5">
                                        <h3 className="text-sm font-semibold text-slate-800 truncate">
                                            {column.name}
                                        </h3>
                                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${column.badgeColor} shrink-0 tabular-nums`}>
                                            {shiftEmployees.length} คน
                                        </span>
                                    </div>
                                    <p className="text-[11px] font-normal text-slate-500 mt-0.5 truncate">
                                        {column.subtitle}
                                    </p>
                                </div>

                                {/* Employee Cards List */}
                                <div className="p-2.5 space-y-2 flex-1 overflow-y-auto max-h-[600px]">
                                    {shiftEmployees.map((employee) => (
                                        <div
                                            key={employee.id}
                                            draggable
                                            onDragStart={() => setDraggedEmployee(employee)}
                                            onDragEnd={() => setDraggedEmployee(null)}
                                            className={`bg-white rounded-lg p-2.5 shadow-2xs border border-slate-200/80 cursor-grab active:cursor-grabbing hover:border-slate-300 hover:shadow-xs transition-all ${
                                                saving === employee.id ? "opacity-50 pointer-events-none" : ""
                                            } ${draggedEmployee?.id === employee.id ? "opacity-30 scale-95" : ""}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                {employee.avatar ? (
                                                    <div className="relative w-7 h-7 shrink-0 rounded-full overflow-hidden ring-1 ring-slate-200">
                                                        <img
                                                            src={employee.avatar}
                                                            alt={employee.name}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = "none";
                                                                if (e.currentTarget.nextElementSibling) {
                                                                    (e.currentTarget.nextElementSibling as HTMLElement).style.display = "flex";
                                                                }
                                                            }}
                                                        />
                                                        <div className="hidden w-full h-full bg-slate-100 items-center justify-center text-slate-700 font-medium text-xs">
                                                            {employee.name.charAt(0)}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="w-7 h-7 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-medium text-xs ring-1 ring-slate-200">
                                                        {employee.name.charAt(0)}
                                                    </div>
                                                )}

                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs sm:text-sm font-medium text-slate-800 leading-tight truncate">
                                                        {employee.name}
                                                    </div>
                                                    <div className="text-[11px] font-normal text-slate-500 truncate mt-0.5">
                                                        {employee.department || employee.position || "พนักงาน"}
                                                    </div>
                                                </div>

                                                {saving === employee.id && (
                                                    <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin shrink-0" />
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {shiftEmployees.length === 0 && (
                                        <div className="text-center py-10 text-slate-400 text-xs font-normal border-2 border-dashed border-slate-200 rounded-lg">
                                            ลากพนักงานมาวางที่นี่
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <CustomAlert
                isOpen={alertState.isOpen}
                onClose={() => setAlertState((prev) => ({ ...prev, isOpen: false }))}
                title={alertState.title}
                message={alertState.message}
                type={alertState.type}
            />
        </div>
    );
}
