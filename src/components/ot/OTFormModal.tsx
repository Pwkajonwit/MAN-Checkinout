"use client";

import { useState, useEffect } from "react";
import { X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { otService, employeeService, type OTRequest, type Employee } from "@/lib/firestore";

interface OTFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    ot?: OTRequest | null;
    onSuccess: () => void;
}

export function OTFormModal({ isOpen, onClose, ot, onSuccess }: OTFormModalProps) {
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [formData, setFormData] = useState({
        employeeId: "",
        employeeName: "",
        date: "",
        startTime: "",
        endTime: "",
        hours: 0,
        reason: "",
        status: "รออนุมัติ" as "รออนุมัติ" | "อนุมัติ" | "ไม่อนุมัติ",
    });

    // Load employees
    useEffect(() => {
        const loadEmployees = async () => {
            try {
                const data = await employeeService.getAll();
                setEmployees(data);
            } catch (error) {
                console.error("Error loading employees:", error);
            }
        };
        loadEmployees();
    }, []);

    // Update form when ot prop changes
    useEffect(() => {
        if (ot) {
            setFormData({
                employeeId: ot.employeeId || "",
                employeeName: ot.employeeName || "",
                date: ot.date ? new Date(ot.date).toISOString().split('T')[0] : "",
                startTime: "",
                endTime: "",
                hours: ot.startTime && ot.endTime
                    ? (() => {
                        const start = new Date(ot.startTime);
                        const end = new Date(ot.endTime);
                        const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                        return diff > 0 ? diff : 0;
                    })()
                    : 0,
                reason: ot.reason || "",
                status: ot.status || "รออนุมัติ",
            });
        } else {
            setFormData({
                employeeId: "",
                employeeName: "",
                date: "",
                startTime: "",
                endTime: "",
                hours: 0,
                reason: "",
                status: "รออนุมัติ",
            });
        }
    }, [ot]);

    // Calculate hours from time range
    useEffect(() => {
        if (formData.startTime && formData.endTime) {
            const [startHour, startMin] = formData.startTime.split(':').map(Number);
            const [endHour, endMin] = formData.endTime.split(':').map(Number);

            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;

            let diffMinutes = endMinutes - startMinutes;
            if (diffMinutes < 0) {
                diffMinutes += 24 * 60; // Handle overnight OT
            }

            const hours = diffMinutes / 60;
            setFormData(prev => ({ ...prev, hours: parseFloat(hours.toFixed(2)) }));
        }
    }, [formData.startTime, formData.endTime]);

    if (!isOpen) return null;

    const handleEmployeeChange = (employeeId: string) => {
        const employee = employees.find(e => e.id === employeeId);
        setFormData({
            ...formData,
            employeeId,
            employeeName: employee?.name || "",
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const otData = {
                employeeId: formData.employeeId,
                employeeName: formData.employeeName,
                date: new Date(formData.date),
                startTime: formData.startTime ? new Date(`${formData.date}T${formData.startTime}`) : new Date(formData.date),
                endTime: formData.endTime ? new Date(`${formData.date}T${formData.endTime}`) : new Date(formData.date),
                reason: formData.reason,
                status: formData.status,
            };

            if (ot?.id) {
                // Update existing OT
                await otService.update(ot.id, otData);
            } else {
                // Create new OT
                await otService.create({
                    ...otData,
                    createdAt: new Date(),
                });
            }
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error saving OT:", error);
            alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between rounded-t-3xl">
                    <h2 className="text-2xl font-bold text-gray-800">
                        {ot ? "แก้ไขข้อมูล OT" : "เพิ่มข้อมูล OT"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Employee Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            เลือกพนักงาน <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={formData.employeeId}
                            onChange={(e) => handleEmployeeChange(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                            required
                            disabled={!!ot}
                        >
                            <option value="">-- เลือกพนักงาน --</option>
                            {employees.map((emp) => (
                                <option key={emp.id} value={emp.id}>
                                    {emp.name} ({emp.type})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            วันที่ทำ OT <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                            required
                        />
                    </div>

                    {/* Time Range */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                เวลาเริ่มต้น <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="time"
                                    value={formData.startTime}
                                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                เวลาสิ้นสุด <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="time"
                                    value={formData.endTime}
                                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Hours Display */}
                    {formData.hours > 0 && (
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-purple-700">
                                    จำนวนชั่วโมง OT: <span className="font-bold text-lg">{formData.hours}</span> ชั่วโมง
                                </p>
                                <p className="text-xs text-purple-600">
                                    {formData.startTime} - {formData.endTime}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            เหตุผล / รายละเอียดงาน <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                            rows={3}
                            placeholder="กรอกรายละเอียดงานที่ทำ OT"
                            required
                        />
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            สถานะ
                        </label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                        >
                            <option value="รออนุมัติ">รออนุมัติ</option>
                            <option value="อนุมัติ">อนุมัติ</option>
                            <option value="ไม่อนุมัติ">ไม่อนุมัติ</option>
                        </select>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            onClick={onClose}
                            variant="outline"
                            className="flex-1 h-12 rounded-xl"
                            disabled={loading}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 h-12 bg-primary-dark hover:bg-primary-dark/90 text-white rounded-xl"
                            disabled={loading}
                        >
                            {loading ? "กำลังบันทึก..." : ot ? "บันทึกการแก้ไข" : "เพิ่มข้อมูล OT"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
