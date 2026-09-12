"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { shiftService, type Shift } from "@/lib/firestore";
import { useAdmin } from "@/components/auth/AuthProvider";
import { Plus, Clock, Pencil, Trash2, Star, Search, X, Users, CheckCircle2 } from "lucide-react";
import { CustomAlert } from "@/components/ui/custom-alert";

export default function ShiftsPage() {
    const { user } = useAdmin();
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingShift, setEditingShift] = useState<Shift | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<"all" | "default" | "normal">("all");
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

    const [formData, setFormData] = useState({
        name: "",
        checkInHour: 9,
        checkInMinute: 0,
        checkOutHour: 18,
        checkOutMinute: 0,
        lateGracePeriod: 0,
        isDefault: false,
    });

    const loadShifts = async () => {
        try {
            const data = await shiftService.getAll();
            setShifts(data);
        } catch (error) {
            console.error("Error loading shifts:", error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เกิดข้อผิดพลาดในการโหลดข้อมูลกะเวลาทำงาน",
                type: "error",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            loadShifts();
        }
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingShift?.id) {
                await shiftService.update(editingShift.id, formData);
                setAlertState({
                    isOpen: true,
                    title: "สำเร็จ",
                    message: "บันทึกการแก้ไขกะเวลาทำงานเรียบร้อยแล้ว",
                    type: "success",
                });
            } else {
                await shiftService.create({
                    ...formData,
                    createdAt: new Date(),
                });
                setAlertState({
                    isOpen: true,
                    title: "สำเร็จ",
                    message: "สร้างกะเวลาทำงานใหม่เรียบร้อยแล้ว",
                    type: "success",
                });
            }
            setShowModal(false);
            setEditingShift(null);
            resetForm();
            loadShifts();
        } catch (error) {
            console.error("Error saving shift:", error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล",
                type: "error",
            });
        }
    };

    const handleEdit = (shift: Shift) => {
        setEditingShift(shift);
        setFormData({
            name: shift.name,
            checkInHour: shift.checkInHour,
            checkInMinute: shift.checkInMinute,
            checkOutHour: shift.checkOutHour,
            checkOutMinute: shift.checkOutMinute,
            lateGracePeriod: shift.lateGracePeriod || 0,
            isDefault: shift.isDefault || false,
        });
        setShowModal(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`คุณต้องการลบกะ "${name}" หรือไม่?`)) return;
        try {
            await shiftService.delete(id);
            setAlertState({
                isOpen: true,
                title: "สำเร็จ",
                message: `ลบกะ "${name}" เรียบร้อยแล้ว`,
                type: "success",
            });
            loadShifts();
        } catch (error) {
            console.error("Error deleting shift:", error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เกิดข้อผิดพลาดในการลบกะ",
                type: "error",
            });
        }
    };

    const resetForm = () => {
        setFormData({
            name: "",
            checkInHour: 9,
            checkInMinute: 0,
            checkOutHour: 18,
            checkOutMinute: 0,
            lateGracePeriod: 0,
            isDefault: false,
        });
    };

    const formatTime = (hour: number, minute: number) => {
        return `${(hour ?? 0).toString().padStart(2, "0")}:${(minute ?? 0).toString().padStart(2, "0")} น.`;
    };

    const calculateShiftDuration = (startHour: number, startMin: number, endHour: number, endMin: number) => {
        let startMinutes = startHour * 60 + startMin;
        let endMinutes = endHour * 60 + endMin;
        if (endMinutes < startMinutes) {
            endMinutes += 24 * 60; // Overnight shift
        }
        const totalMinutes = endMinutes - startMinutes;
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        if (mins === 0) return `${hours} ชม.`;
        return `${hours} ชม. ${mins} นาที`;
    };

    // Calculate stats
    const defaultShift = shifts.find((s) => s.isDefault);
    const maxGracePeriod = shifts.length > 0 ? Math.max(...shifts.map((s) => s.lateGracePeriod || 0)) : 0;
    const stats = {
        total: shifts.length,
        defaultCount: shifts.filter((s) => s.isDefault).length,
        normalCount: shifts.filter((s) => !s.isDefault).length,
    };

    // Filter shifts
    const filteredShifts = shifts.filter((shift) => {
        if (typeFilter === "default" && !shift.isDefault) return false;
        if (typeFilter === "normal" && shift.isDefault) return false;

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const matchName = shift.name?.toLowerCase().includes(query);
            const timeStr = `${formatTime(shift.checkInHour, shift.checkInMinute)} - ${formatTime(shift.checkOutHour, shift.checkOutMinute)}`;
            const matchTime = timeStr.includes(query);
            if (!matchName && !matchTime) return false;
        }

        return true;
    });

    if (!user) {
        return (
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-12 text-center text-slate-500 font-normal">
                กรุณาเข้าสู่ระบบเพื่อจัดการข้อมูลกะเวลาทำงาน
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                            จัดการกะเวลาทำงาน
                        </h1>
                        <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            Work Shifts
                        </span>
                        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            ทั้งหมด {shifts.length} กะ
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm font-normal text-slate-500 mt-1">
                        จัดการเวลาเข้า-ออกงาน ค่าผ่อนผันสาย และกะเริ่มต้นของระบบ
                    </p>
                </div>
            </div>

            {/* Compact & Clean Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                {/* กะทั้งหมด */}
                <div
                    onClick={() => setTypeFilter("all")}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        typeFilter === "all"
                            ? "border-slate-700 ring-2 ring-slate-100 bg-slate-50/50"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">กะทั้งหมด</span>
                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">
                        {stats.total}
                    </div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">กะการทำงาน</div>
                </div>

                {/* กะหลัก */}
                <div
                    onClick={() => setTypeFilter(typeFilter === "default" ? "all" : "default")}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        typeFilter === "default"
                            ? "border-amber-500 ring-2 ring-amber-100 bg-amber-50/20"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">กะหลัก (Default)</span>
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    </div>
                    <div className="text-base sm:text-lg font-bold text-slate-800 mt-1 truncate">
                        {defaultShift ? defaultShift.name : "-"}
                    </div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">
                        {defaultShift
                            ? `${formatTime(defaultShift.checkInHour, defaultShift.checkInMinute)} - ${formatTime(defaultShift.checkOutHour, defaultShift.checkOutMinute)}`
                            : "ยังไม่ได้ระบุ"}
                    </div>
                </div>

                {/* กะทั่วไป */}
                <div
                    onClick={() => setTypeFilter(typeFilter === "normal" ? "all" : "normal")}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        typeFilter === "normal"
                            ? "border-blue-500 ring-2 ring-blue-100 bg-blue-50/20"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">กะทั่วไป</span>
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">
                        {stats.normalCount}
                    </div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">กะการทำงาน</div>
                </div>

                {/* ผ่อนผันสายสูงสุด */}
                <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">ผ่อนผันสายสูงสุด</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">
                        {maxGracePeriod} <span className="text-sm font-medium">นาที</span>
                    </div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">
                        {maxGracePeriod > 0 ? "มีระยะเวลายืดหยุ่น" : "ไม่มีการผ่อนผัน"}
                    </div>
                </div>
            </div>

            {/* Compact Toolbar (Search, Filter Pills & Action Buttons) */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-2.5 sm:p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Search Input */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อกะ หรือ เวลา..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-9 pl-8 pr-7 py-1 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 w-52 sm:w-64 transition-all"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-0.5"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Filter Pills */}
                    <div className="hidden sm:inline-flex items-center bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60">
                        <button
                            type="button"
                            onClick={() => setTypeFilter("all")}
                            className={`h-7 px-2.5 rounded-md text-xs font-medium transition-all ${
                                typeFilter === "all"
                                    ? "bg-white text-slate-800 shadow-2xs font-semibold"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            ทั้งหมด ({stats.total})
                        </button>
                        <button
                            type="button"
                            onClick={() => setTypeFilter("default")}
                            className={`h-7 px-2.5 rounded-md text-xs font-medium transition-all ${
                                typeFilter === "default"
                                    ? "bg-white text-slate-800 shadow-2xs font-semibold"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            กะหลัก ({stats.defaultCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setTypeFilter("normal")}
                            className={`h-7 px-2.5 rounded-md text-xs font-medium transition-all ${
                                typeFilter === "normal"
                                    ? "bg-white text-slate-800 shadow-2xs font-semibold"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            กะทั่วไป ({stats.normalCount})
                        </button>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-auto">
                    <Link
                        href="/admin/shifts/assign"
                        className="h-9 inline-flex items-center gap-1.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs sm:text-sm font-medium shadow-2xs transition-all"
                    >
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        <span>กำหนดกะพนักงาน</span>
                    </Link>
                    <button
                        onClick={() => {
                            resetForm();
                            setEditingShift(null);
                            setShowModal(true);
                        }}
                        className="h-9 inline-flex items-center gap-1.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-medium shadow-xs transition-all"
                    >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>เพิ่มกะใหม่</span>
                    </button>
                </div>
            </div>

            {/* Table Container */}
            {loading ? (
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-10 text-center text-slate-500 font-normal">
                    <div className="animate-spin w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                    กำลังโหลดข้อมูลกะเวลาทำงาน...
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50/80 border-b border-slate-200">
                                <tr>
                                    <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        ชื่อกะ
                                    </th>
                                    <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        เวลาเข้างาน
                                    </th>
                                    <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        เวลาออกงาน
                                    </th>
                                    <th className="px-3.5 py-2.5 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        ระยะเวลาทำงาน
                                    </th>
                                    <th className="px-3.5 py-2.5 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        ผ่อนผันสาย
                                    </th>
                                    <th className="px-3.5 py-2.5 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        ประเภทกะ
                                    </th>
                                    <th className="px-3.5 py-2.5 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        จัดการ
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredShifts.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center text-slate-500 font-normal text-sm">
                                            {searchQuery || typeFilter !== "all"
                                                ? "ไม่พบกะเวลาทำงานที่ตรงตามเงื่อนไข"
                                                : 'ยังไม่มีกะเวลาทำงาน กดปุ่ม "เพิ่มกะใหม่" เพื่อเริ่มต้นสร้าง'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredShifts.map((shift) => (
                                        <tr key={shift.id} className="hover:bg-slate-50/60 transition-colors group">
                                            {/* Shift Name */}
                                            <td className="px-3.5 py-2.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center shrink-0 text-blue-600">
                                                        <Clock className="w-3.5 h-3.5" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-medium text-slate-800 leading-tight flex items-center gap-1.5">
                                                            {shift.name}
                                                            {shift.isDefault && (
                                                                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Check-In */}
                                            <td className="px-3.5 py-2.5 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                                    <span className="text-sm font-normal text-slate-800">
                                                        {formatTime(shift.checkInHour, shift.checkInMinute)}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Check-Out */}
                                            <td className="px-3.5 py-2.5 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                                                    <span className="text-sm font-normal text-slate-800">
                                                        {formatTime(shift.checkOutHour, shift.checkOutMinute)}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Duration */}
                                            <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                <span className="text-xs font-medium text-slate-700 bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200/80">
                                                    {calculateShiftDuration(
                                                        shift.checkInHour,
                                                        shift.checkInMinute,
                                                        shift.checkOutHour,
                                                        shift.checkOutMinute
                                                    )}
                                                </span>
                                            </td>

                                            {/* Grace Period */}
                                            <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                <span className="text-xs font-normal text-slate-600">
                                                    {shift.lateGracePeriod ? `${shift.lateGracePeriod} นาที` : "-"}
                                                </span>
                                            </td>

                                            {/* Type Badge */}
                                            <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                {shift.isDefault ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-normal border bg-amber-50 text-amber-800 border-amber-200/80 whitespace-nowrap">
                                                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                                        กะหลัก
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-normal border bg-slate-50 text-slate-600 border-slate-200 whitespace-nowrap">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                                        กะทั่วไป
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                                                <div className="inline-flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleEdit(shift)}
                                                        className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                        title="แก้ไขกะ"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => shift.id && handleDelete(shift.id, shift.name)}
                                                        className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                        title="ลบกะ"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Table Footer */}
                    <div className="px-3.5 py-2.5 bg-slate-50/80 border-t border-slate-200 text-xs font-normal text-slate-500 flex flex-wrap items-center justify-between gap-2">
                        <span>
                            แสดงผล <span className="font-semibold text-slate-800">{filteredShifts.length}</span> จากทั้งหมด{" "}
                            <span className="font-semibold text-slate-800">{shifts.length}</span> กะ
                        </span>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                            <span className="text-amber-700">กะหลัก: {defaultShift?.name || "ยังไม่ได้ตั้ง"}</span>
                            <span>•</span>
                            <span className="text-blue-700">กะทั่วไป: {stats.normalCount}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="bg-slate-50/80 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-700" />
                                <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                                    {editingShift ? "แก้ไขกะเวลาทำงาน" : "เพิ่มกะเวลาทำงานใหม่"}
                                </h2>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-1.5 hover:bg-slate-200/70 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    ชื่อกะ <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 transition-all"
                                    placeholder="เช่น กะเช้า, กะบ่าย, กะดึก"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        เวลาเข้างาน
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="number"
                                            min="0"
                                            max="23"
                                            value={formData.checkInHour}
                                            onChange={(e) =>
                                                setFormData({ ...formData, checkInHour: Number(e.target.value) })
                                            }
                                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-center font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                            placeholder="ชม."
                                        />
                                        <span className="text-slate-400 font-bold">:</span>
                                        <input
                                            type="number"
                                            min="0"
                                            max="59"
                                            value={formData.checkInMinute}
                                            onChange={(e) =>
                                                setFormData({ ...formData, checkInMinute: Number(e.target.value) })
                                            }
                                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-center font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                            placeholder="นาที"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        เวลาออกงาน
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="number"
                                            min="0"
                                            max="23"
                                            value={formData.checkOutHour}
                                            onChange={(e) =>
                                                setFormData({ ...formData, checkOutHour: Number(e.target.value) })
                                            }
                                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-center font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                            placeholder="ชม."
                                        />
                                        <span className="text-slate-400 font-bold">:</span>
                                        <input
                                            type="number"
                                            min="0"
                                            max="59"
                                            value={formData.checkOutMinute}
                                            onChange={(e) =>
                                                setFormData({ ...formData, checkOutMinute: Number(e.target.value) })
                                            }
                                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-center font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                            placeholder="นาที"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    ผ่อนผันสาย (นาที)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.lateGracePeriod}
                                    onChange={(e) =>
                                        setFormData({ ...formData, lateGracePeriod: Number(e.target.value) })
                                    }
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 transition-all"
                                    placeholder="เช่น 15"
                                />
                                <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                                    จำนวนนาทีที่อนุญาตให้สแกนเข้างานหลังเวลาเริ่มงานโดยไม่ถือว่าสาย
                                </p>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="isDefault"
                                    checked={formData.isDefault}
                                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 cursor-pointer"
                                />
                                <label
                                    htmlFor="isDefault"
                                    className="text-xs sm:text-sm font-normal text-slate-700 cursor-pointer select-none flex items-center gap-1.5"
                                >
                                    <span>ตั้งเป็นกะหลัก (Default Shift)</span>
                                    <span className="text-[11px] text-slate-400 font-normal">
                                        (จะถูกนำไปใช้กับพนักงานที่ไม่ได้กำหนดกะเฉพาะ)
                                    </span>
                                </label>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200/80 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="h-9 px-3.5 text-xs sm:text-sm font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-medium shadow-xs transition-all"
                                >
                                    บันทึก
                                </button>
                            </div>
                        </form>
                    </div>
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
