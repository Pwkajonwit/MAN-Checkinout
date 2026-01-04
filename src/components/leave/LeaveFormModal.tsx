"use client";

import { useState, useEffect, useRef } from "react";
import { X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { leaveService, employeeService, type LeaveRequest, type Employee } from "@/lib/firestore";
import { compressBase64Image } from "@/lib/storage";

interface LeaveFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    leave?: LeaveRequest | null;
    onSuccess: () => void;
}

export function LeaveFormModal({ isOpen, onClose, leave, onSuccess }: LeaveFormModalProps) {
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [formData, setFormData] = useState({
        employeeId: "",
        employeeName: "",
        leaveType: "ลาพักร้อน" as "ลาพักร้อน" | "ลาป่วย" | "ลากิจ",
        startDate: "",
        endDate: "",
        reason: "",
        status: "รออนุมัติ" as "รออนุมัติ" | "อนุมัติ" | "ไม่อนุมัติ",
        attachment: null as string | null,
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

    // Update form when leave prop changes
    useEffect(() => {
        if (leave) {
            setFormData({
                employeeId: leave.employeeId || "",
                employeeName: leave.employeeName || "",
                leaveType: leave.leaveType || "ลาพักร้อน",
                startDate: leave.startDate ? new Date(leave.startDate).toISOString().split('T')[0] : "",
                endDate: leave.endDate ? new Date(leave.endDate).toISOString().split('T')[0] : "",
                reason: leave.reason || "",
                status: leave.status || "รออนุมัติ",
                attachment: leave.attachment || null,
            });
        } else {
            setFormData({
                employeeId: "",
                employeeName: "",
                leaveType: "ลาพักร้อน",
                startDate: "",
                endDate: "",
                reason: "",
                status: "รออนุมัติ",
                attachment: null,
            });
        }
    }, [leave]);

    if (!isOpen) return null;

    const calculateDays = () => {
        if (formData.startDate && formData.endDate) {
            const start = new Date(formData.startDate);
            const end = new Date(formData.endDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            return diffDays;
        }
        return 0;
    };

    const handleEmployeeChange = (employeeId: string) => {
        const employee = employees.find(e => e.id === employeeId);
        setFormData({
            ...formData,
            employeeId,
            employeeName: employee?.name || "",
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validations
        if (!file.type.startsWith('image/')) {
            alert('กรุณาอัพโหลดไฟล์รูปภาพเท่านั้น');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB
            alert('ขนาดไฟล์ต้องไม่เกิน 5MB');
            return;
        }

        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = event.target?.result as string;
                // Compress image
                const compressed = await compressBase64Image(base64);
                setFormData({ ...formData, attachment: compressed });
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error processing image:', error);
            alert('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const leaveData = {
                employeeId: formData.employeeId,
                employeeName: formData.employeeName,
                leaveType: formData.leaveType,
                startDate: new Date(formData.startDate),
                endDate: new Date(formData.endDate),
                reason: formData.reason,
                status: formData.status,
                attachment: formData.attachment || undefined,
            };

            if (leave?.id) {
                // Update existing leave
                await leaveService.update(leave.id, leaveData);
            } else {
                // Create new leave
                await leaveService.create({
                    ...leaveData,
                    createdAt: new Date(),
                });
            }
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error saving leave:", error);
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
                        {leave ? "แก้ไขการลางาน" : "เพิ่มการลางาน"}
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
                            disabled={!!leave}
                        >
                            <option value="">-- เลือกพนักงาน --</option>
                            {employees.map((emp) => (
                                <option key={emp.id} value={emp.id}>
                                    {emp.name} ({emp.type})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Leave Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            ประเภทการลา <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={formData.leaveType}
                            onChange={(e) => setFormData({ ...formData, leaveType: e.target.value as any })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                            required
                        >
                            <option value="ลาพักร้อน">ลาพักร้อน</option>
                            <option value="ลาป่วย">ลาป่วย</option>
                            <option value="ลากิจ">ลากิจ</option>
                        </select>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                วันที่เริ่มต้น <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={formData.startDate}
                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                วันที่สิ้นสุด <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={formData.endDate}
                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                                required
                                min={formData.startDate}
                            />
                        </div>
                    </div>

                    {/* Days Display */}
                    {formData.startDate && formData.endDate && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <p className="text-sm text-blue-700">
                                จำนวนวันลา: <span className="font-bold text-lg">{calculateDays()}</span> วัน
                            </p>
                        </div>
                    )}

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            เหตุผล <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                            rows={3}
                            placeholder="กรอกเหตุผลการลา"
                            required
                        />
                    </div>

                    {/* Attachment */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            หลักฐานประกอบ (ถ้ามี)
                        </label>
                        <div className="flex items-start gap-4">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/*"
                                className="hidden"
                            />

                            {formData.attachment ? (
                                <div className="relative group">
                                    <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200">
                                        <img
                                            src={formData.attachment}
                                            alt="Evidence"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="mt-2 text-xs text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                        <Camera className="w-3 h-3" />
                                        เปลี่ยนรูป
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, attachment: null })}
                                        className="mt-1 text-xs text-red-600 hover:underline"
                                    >
                                        ลบรูป
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                                >
                                    <Camera className="w-8 h-8 mb-2 text-gray-400" />
                                    <span className="text-sm">คลิกเพื่อแนบรูปภาพ</span>
                                    <span className="text-xs text-gray-400 mt-1">สูงสุด 5MB</span>
                                </button>
                            )}
                        </div>
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
                            <option value="รอการอนุมัติ">รอการอนุมัติ</option>
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
                            {loading ? "กำลังบันทึก..." : leave ? "บันทึกการแก้ไข" : "เพิ่มการลางาน"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
