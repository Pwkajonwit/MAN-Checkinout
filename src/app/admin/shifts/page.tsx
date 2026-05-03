"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { shiftService, type Shift } from "@/lib/firestore";
import { useAdmin } from "@/components/auth/AuthProvider";
import { Plus, Clock, Pencil, Trash2, Star } from "lucide-react";

export default function ShiftsPage() {
    const { user } = useAdmin();
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingShift, setEditingShift] = useState<Shift | null>(null);

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
            } else {
                await shiftService.create({
                    ...formData,
                    createdAt: new Date(),
                });
            }
            setShowModal(false);
            setEditingShift(null);
            resetForm();
            loadShifts();
        } catch (error) {
            console.error("Error saving shift:", error);
            alert("เกิดข้อผิดพลาด");
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

    const handleDelete = async (id: string) => {
        if (!confirm("ต้องการลบกะนี้หรือไม่?")) return;
        try {
            await shiftService.delete(id);
            loadShifts();
        } catch (error) {
            console.error("Error deleting shift:", error);
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
        return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    };

    if (!user) {
        return <div className="p-8 text-center">กรุณาเข้าสู่ระบบ</div>;
    }

    return (
        <div className="flex-1 p-8">
            <PageHeader
                title="จัดการกะเวลาทำงาน"
                subtitle="เพิ่ม แก้ไข ลบ กะเวลาทำงาน"
            />

            <div className="mb-6 flex gap-3">
                <Button
                    onClick={() => {
                        resetForm();
                        setEditingShift(null);
                        setShowModal(true);
                    }}
                    className="bg-primary-dark hover:bg-primary-dark/90"
                >
                    <Plus className="w-4 h-4 mr-2" /> เพิ่มกะใหม่
                </Button>
                <a
                    href="/admin/shifts/assign"
                    className="inline-flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-colors"
                >
                    <Clock className="w-4 h-4 mr-2" /> กำหนดกะพนักงาน
                </a>
            </div>

            {loading ? (
                <div className="text-center py-8">กำลังโหลด...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {shifts.map((shift) => (
                        <div
                            key={shift.id}
                            className={`bg-white rounded-2xl p-6 shadow-sm border ${shift.isDefault ? "border-amber-300 ring-2 ring-amber-100" : "border-gray-100"}`}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                        <Clock className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                            {shift.name}
                                            {shift.isDefault && <Star className="w-4 h-4 text-amber-500" />}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            {formatTime(shift.checkInHour, shift.checkInMinute)} - {formatTime(shift.checkOutHour, shift.checkOutMinute)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="text-sm text-gray-600 mb-4">
                                ผ่อนผันสาย: {shift.lateGracePeriod || 0} นาที
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEdit(shift)}
                                >
                                    <Pencil className="w-4 h-4 mr-1" /> แก้ไข
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 hover:bg-red-50"
                                    onClick={() => shift.id && handleDelete(shift.id)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ))}

                    {shifts.length === 0 && (
                        <div className="col-span-full text-center py-12 text-gray-500">
                            ยังไม่มีกะเวลาทำงาน กดปุ่ม "เพิ่มกะใหม่" เพื่อสร้าง
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white border border-slate-100 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 p-6 flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-slate-900">
                                {editingShift ? "แก้ไขกะ" : "เพิ่มกะใหม่"}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                            >
                                <Plus className="w-5 h-5 rotate-45" /> {/* Using Plus rotated as X */}
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    ชื่อกะ <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#009966]/20 focus:border-[#009966] transition-all"
                                    placeholder="เช่น กะเช้า, กะบ่าย"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        เวลาเข้างาน
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            max="23"
                                            value={formData.checkInHour}
                                            onChange={(e) => setFormData({ ...formData, checkInHour: Number(e.target.value) })}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#009966]/20 focus:border-[#009966]"
                                        />
                                        <span className="text-slate-400">:</span>
                                        <input
                                            type="number"
                                            min="0"
                                            max="59"
                                            value={formData.checkInMinute}
                                            onChange={(e) => setFormData({ ...formData, checkInMinute: Number(e.target.value) })}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#009966]/20 focus:border-[#009966]"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        เวลาออกงาน
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            max="23"
                                            value={formData.checkOutHour}
                                            onChange={(e) => setFormData({ ...formData, checkOutHour: Number(e.target.value) })}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#009966]/20 focus:border-[#009966]"
                                        />
                                        <span className="text-slate-400">:</span>
                                        <input
                                            type="number"
                                            min="0"
                                            max="59"
                                            value={formData.checkOutMinute}
                                            onChange={(e) => setFormData({ ...formData, checkOutMinute: Number(e.target.value) })}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#009966]/20 focus:border-[#009966]"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    ผ่อนผันสาย (นาที)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.lateGracePeriod}
                                    onChange={(e) => setFormData({ ...formData, lateGracePeriod: Number(e.target.value) })}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#009966]/20 focus:border-[#009966] transition-all text-slate-900"
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="isDefault"
                                    checked={formData.isDefault}
                                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                                    className="w-4 h-4 rounded border-slate-300 text-[#009966] focus:ring-[#009966]/20"
                                />
                                <label htmlFor="isDefault" className="text-sm text-slate-600 cursor-pointer select-none">
                                    ตั้งเป็นกะหลัก (Default)
                                </label>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 h-10 rounded-md text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 h-10 bg-[#009966] hover:bg-[#008f60] text-white rounded-md text-sm font-medium transition-all shadow-md shadow-[#009966]/20"
                                >
                                    บันทึก
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
