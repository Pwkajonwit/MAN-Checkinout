"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { employeeService, shiftService, type Employee, type Shift } from "@/lib/firestore";
import { useAdmin } from "@/components/auth/AuthProvider";
import { Users, Clock, GripVertical, Check } from "lucide-react";

export default function ShiftAssignmentPage() {
    const { user } = useAdmin();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [draggedEmployee, setDraggedEmployee] = useState<Employee | null>(null);

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user]);

    const loadData = async () => {
        try {
            const [empData, shiftData] = await Promise.all([
                employeeService.getAll(),
                shiftService.getAll(),
            ]);
            setEmployees(empData.filter(e => e.status === "ทำงาน"));
            setShifts(shiftData);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDrop = async (shiftId: string | null) => {
        if (!draggedEmployee?.id) return;

        setSaving(draggedEmployee.id);
        try {
            await employeeService.update(draggedEmployee.id, { shiftId: shiftId || undefined });
            setEmployees(prev => prev.map(e =>
                e.id === draggedEmployee.id ? { ...e, shiftId: shiftId || undefined } : e
            ));
        } catch (error) {
            console.error("Error updating shift:", error);
            alert("เกิดข้อผิดพลาด");
        } finally {
            setSaving(null);
            setDraggedEmployee(null);
        }
    };

    const formatTime = (hour: number, minute: number) => {
        return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    };

    const getEmployeesForShift = (shiftId: string | null) => {
        if (shiftId === null) {
            return employees.filter(e => !e.shiftId);
        }
        return employees.filter(e => e.shiftId === shiftId);
    };

    // All shift columns including default
    const allShiftColumns = [
        { id: null, name: "กะหลัก", subtitle: "ใช้ค่าจาก Settings", color: "bg-gray-100 border-gray-200" },
        ...shifts.map(s => ({
            id: s.id,
            name: s.name,
            subtitle: `${formatTime(s.checkInHour, s.checkInMinute)} - ${formatTime(s.checkOutHour, s.checkOutMinute)}`,
            color: "bg-blue-50 border-blue-200"
        }))
    ];

    if (!user) {
        return <div className="p-8 text-center">กรุณาเข้าสู่ระบบ</div>;
    }

    return (
        <div className="flex-1 p-8">
            <PageHeader
                title="กำหนดกะพนักงาน"
                subtitle="ลากวางพนักงานไปยังกะที่ต้องการ"
            />

            {loading ? (
                <div className="text-center py-8">กำลังโหลด...</div>
            ) : (
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${allShiftColumns.length}, minmax(200px, 1fr))` }}>
                    {allShiftColumns.map(column => (
                        <div
                            key={column.id || "default"}
                            className={`rounded-2xl border-2 ${column.color} min-h-[400px] transition-all ${draggedEmployee ? "border-dashed" : ""
                                }`}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDrop(column.id || null)}
                        >
                            {/* Column Header */}
                            <div className="p-4 border-b border-gray-200/50">
                                <h3 className="font-bold text-gray-800">{column.name}</h3>
                                <p className="text-xs text-gray-500">{column.subtitle}</p>
                                <div className="mt-2 text-sm font-medium text-gray-600">
                                    {getEmployeesForShift(column.id || null).length} คน
                                </div>
                            </div>

                            {/* Employee Cards */}
                            <div className="p-3 space-y-2">
                                {getEmployeesForShift(column.id || null).map(employee => (
                                    <div
                                        key={employee.id}
                                        draggable
                                        onDragStart={() => setDraggedEmployee(employee)}
                                        onDragEnd={() => setDraggedEmployee(null)}
                                        className={`bg-white rounded-xl p-3 shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${saving === employee.id ? "opacity-50" : ""
                                            } ${draggedEmployee?.id === employee.id ? "opacity-30 scale-95" : ""
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <GripVertical className="w-4 h-4 text-gray-300" />
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-medium text-sm">
                                                {employee.name.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-gray-800 text-sm truncate">
                                                    {employee.name}
                                                </div>
                                                <div className="text-xs text-gray-500 truncate">
                                                    {employee.department || employee.position}
                                                </div>
                                            </div>
                                            {saving === employee.id && (
                                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {getEmployeesForShift(column.id || null).length === 0 && (
                                    <div className="text-center py-8 text-gray-400 text-sm">
                                        ลากพนักงานมาวางที่นี่
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Help Text */}
            <div className="mt-6 text-center text-sm text-gray-500">
                💡 ลากการ์ดพนักงานแล้ววางในคอลัมน์กะที่ต้องการ
            </div>
        </div>
    );
}
