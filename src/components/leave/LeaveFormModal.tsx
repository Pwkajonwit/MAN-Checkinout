"use client";

import { useState, useEffect, useRef } from "react";
import { X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { leaveService, employeeService, type LeaveRequest, type Employee } from "@/lib/firestore";
import { compressBase64Image } from "@/lib/storage";
import { getLeaveDayUnits, formatLeaveDuration } from "@/lib/leaveUtils";

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
    type LeaveType = LeaveRequest["leaveType"];
    type LeaveStatus = LeaveRequest["status"];
    const [formData, setFormData] = useState({
        employeeId: "",
        employeeName: "",
        leaveType: "ลาพักร้อน" as "ลาพักร้อน" | "ลาป่วย" | "ลากิจ",
        startDate: "",
        endDate: "",
        durationUnit: "day" as "day" | "hour",
        startTime: "",
        endTime: "",
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
                durationUnit: leave.durationUnit || "day",
                startTime: leave.startTime || "",
                endTime: leave.endTime || "",
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
                durationUnit: "day",
                startTime: "",
                endTime: "",
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
            if (end < start) return 0;
            return getLeaveDayUnits({
                durationUnit: formData.durationUnit,
                startDate: start,
                endDate: end,
                totalHours: calculateTotalHours(),
            });
        }
        return 0;
    };

    const calculateTotalHours = () => {
        if (formData.durationUnit !== "hour" || !formData.startDate || !formData.startTime || !formData.endTime) {
            return undefined;
        }

        const start = new Date(`${formData.startDate}T${formData.startTime}`);
        const end = new Date(`${formData.startDate}T${formData.endTime}`);
        return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
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

        if (formData.endDate < formData.startDate) {
            alert("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น");
            return;
        }

        if (formData.durationUnit === "hour") {
            if (formData.leaveType !== "ลากิจ") {
                alert("ลารายชั่วโมงใช้ได้กับลากิจเท่านั้น");
                return;
            }
            if (!formData.startTime || !formData.endTime) {
                alert("กรุณาระบุเวลาเริ่มและเวลาสิ้นสุด");
                return;
            }
            if (!calculateTotalHours()) {
                alert("เวลาสิ้นสุดต้องหลังเวลาเริ่มต้น");
                return;
            }
        }

        setLoading(true);

        try {
            // Parse dates using local components to avoid UTC timezone shifts
            const [sY, sM, sD] = formData.startDate.split('-').map(Number);
            const [eY, eM, eD] = formData.endDate.split('-').map(Number);
            
            const leaveData = {
                employeeId: formData.employeeId,
                employeeName: formData.employeeName,
                leaveType: formData.leaveType,
                startDate: new Date(sY, sM - 1, sD),
                endDate: formData.durationUnit === "hour" ? new Date(sY, sM - 1, sD) : new Date(eY, eM - 1, eD),
                durationUnit: formData.durationUnit,
                startTime: formData.durationUnit === "hour" ? formData.startTime : undefined,
                endTime: formData.durationUnit === "hour" ? formData.endTime : undefined,
                totalHours: formData.durationUnit === "hour" ? calculateTotalHours() : undefined,
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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-800">
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
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Employee Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                            เลือกพนักงาน <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={formData.employeeId}
                            onChange={(e) => handleEmployeeChange(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
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
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                            ประเภทการลา <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={formData.leaveType}
                            onChange={(e) => {
                                const leaveType = e.target.value as LeaveType;
                                setFormData({
                                    ...formData,
                                    leaveType,
                                    durationUnit: leaveType === "ลากิจ" ? formData.durationUnit : "day",
                                    startTime: leaveType === "ลากิจ" ? formData.startTime : "",
                                    endTime: leaveType === "ลากิจ" ? formData.endTime : "",
                                });
                            }}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                            required
                        >
                            <option value="ลาพักร้อน">ลาพักร้อน</option>
                            <option value="ลาป่วย">ลาป่วย</option>
                            <option value="ลากิจ">ลากิจ</option>
                        </select>
                    </div>

                    {formData.leaveType === "ลากิจ" && (
                        <div>
                            <label className="block text-sm font-semibold text-slate-800 mb-1">
                                รูปแบบการลา
                            </label>
                            <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-100 p-1">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, durationUnit: "day", startTime: "", endTime: "" })}
                                    className={`h-9 rounded text-sm font-medium ${formData.durationUnit === "day" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                                >
                                    เต็มวัน
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, durationUnit: "hour", endDate: formData.startDate || formData.endDate })}
                                    className={`h-9 rounded text-sm font-medium ${formData.durationUnit === "hour" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                                >
                                    รายชั่วโมง
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Date Range */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-800 mb-1">
                                วันที่เริ่มต้น <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={formData.startDate}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    startDate: e.target.value,
                                    endDate: formData.durationUnit === "hour" ? e.target.value : formData.endDate,
                                })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                                required
                            />
                        </div>

                        {formData.durationUnit === "day" && (
                        <div>
                            <label className="block text-sm font-semibold text-slate-800 mb-1">
                                วันที่สิ้นสุด <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={formData.endDate}
                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                                required
                                min={formData.startDate}
                            />
                        </div>
                        )}
                    </div>

                    {formData.durationUnit === "hour" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-800 mb-1">
                                    เวลาเริ่ม <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="time"
                                    value={formData.startTime}
                                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-800 mb-1">
                                    เวลาสิ้นสุด <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="time"
                                    value={formData.endTime}
                                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                                    required
                                />
                            </div>
                        </div>
                    )}

                    {/* Days Display */}
                    {formData.startDate && formData.endDate && (
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 shadow-sm">
                            <p className="text-sm text-blue-700">
                                ระยะเวลาลา: <span className="font-bold text-lg">
                                    {formData.durationUnit === "hour"
                                        ? formatLeaveDuration({
                                            durationUnit: formData.durationUnit,
                                            startDate: new Date(formData.startDate),
                                            endDate: new Date(formData.startDate),
                                            totalHours: calculateTotalHours(),
                                        })
                                        : `${calculateDays()} วัน`}
                                </span>
                                {formData.durationUnit === "hour" && (
                                    <span className="ml-2 text-xs">({calculateDays().toFixed(2)} วันลา)</span>
                                )}
                            </p>
                        </div>
                    )}

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                            เหตุผล <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                            rows={3}
                            placeholder="กรอกเหตุผลการลา"
                            required
                        />
                    </div>

                    {/* Attachment */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
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
                                    className="w-full h-32 border-2 border-dashed border-gray-300 rounded-md flex flex-col items-center justify-center text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition-colors"
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
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                            สถานะ
                        </label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as LeaveStatus })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
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
                            className="flex-1 h-10 rounded-md text-sm font-medium"
                            disabled={loading}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 h-10 bg-primary-dark hover:bg-primary-dark/90 text-white rounded-md text-sm font-medium"
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
