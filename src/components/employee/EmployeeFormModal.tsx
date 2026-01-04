"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { employeeService, shiftService, systemConfigService, type Employee, type Shift } from "@/lib/firestore";

interface EmployeeFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee?: Employee | null;
    onSuccess: () => void;
    readOnly?: boolean;
}

export function EmployeeFormModal({ isOpen, onClose, employee, onSuccess, readOnly = false }: EmployeeFormModalProps) {
    const [loading, setLoading] = useState(false);
    const [shifts, setShifts] = useState<Shift[]>([]);

    // Load shifts on mount
    const [defaultHolidays, setDefaultHolidays] = useState<number[]>([0, 6]);

    // Load shifts and system config on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                const [shiftsData, configData] = await Promise.all([
                    shiftService.getAll(),
                    systemConfigService.get()
                ]);
                setShifts(shiftsData);
                if (configData?.weeklyHolidays) {
                    setDefaultHolidays(configData.weeklyHolidays);
                }
            } catch (error) {
                console.error("Error loading initial data:", error);
            }
        };
        loadData();
    }, []);

    const [formData, setFormData] = useState({
        employeeId: "",
        name: "",
        email: "",
        phone: "",
        type: "รายเดือน" as "รายเดือน" | "รายวัน" | "ชั่วคราว",
        employmentType: "ประจำ" as "ประจำ" | "ชั่วคราว",
        position: "",
        department: "",
        baseSalary: 0,
        status: "ทำงาน" as "ทำงาน" | "ลาออก" | "พ้นสภาพ",
        endDate: undefined as Date | undefined,
        leaveQuota: {
            personal: 3,
            sick: 30,
            vacation: 5,
        },
        weeklyHolidays: [0, 6] as number[], // เสาร์-อาทิตย์ เป็นค่าเริ่มต้น
        shiftId: "" as string,
    });

    // Update form when employee prop changes
    useEffect(() => {
        if (employee) {
            setFormData({
                employeeId: employee.employeeId || "",
                name: employee.name || "",
                email: employee.email || "",
                phone: employee.phone || "",
                type: employee.type || "รายเดือน",
                employmentType: employee.employmentType || (employee.type === "ชั่วคราว" ? "ชั่วคราว" : "ประจำ"),
                position: employee.position || "",
                department: employee.department || "",
                baseSalary: employee.baseSalary || 0,
                status: employee.status || "ทำงาน",
                endDate: employee.endDate,
                leaveQuota: {
                    personal: employee.leaveQuota?.personal || 3,
                    sick: employee.leaveQuota?.sick || 30,
                    vacation: employee.leaveQuota?.vacation || 5,
                },
                weeklyHolidays: employee.weeklyHolidays || [0, 6],
                shiftId: employee.shiftId || "",
            });
        } else {
            // Reset form for new employee
            setFormData({
                employeeId: "",
                name: "",
                email: "",
                phone: "",
                type: "รายเดือน",
                employmentType: "ประจำ",
                position: "",
                department: "",
                baseSalary: 0,
                status: "ทำงาน",
                endDate: undefined,
                leaveQuota: {
                    personal: 6,
                    sick: 30,
                    vacation: 10,
                },
                weeklyHolidays: defaultHolidays,
                shiftId: "",
            });
        }
    }, [employee, isOpen, defaultHolidays]); // Added isOpen and defaultHolidays to reset/update properly

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;
        setLoading(true);

        try {
            if (employee?.id) {
                // Update existing employee
                await employeeService.update(employee.id, formData);
            } else {
                // Create new employee
                await employeeService.create({
                    ...formData,
                    registeredDate: new Date(),
                });
            }

            // Reset form
            setFormData({
                employeeId: "",
                name: "",
                email: "",
                phone: "",
                type: "รายเดือน",
                employmentType: "ประจำ",
                position: "",
                department: "",
                baseSalary: 0,
                status: "ทำงาน",
                endDate: undefined,
                leaveQuota: {
                    personal: 6,
                    sick: 30,
                    vacation: 10,
                },
                weeklyHolidays: [0, 6],
                shiftId: "",
            });

            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error saving employee:", error);
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
                        {readOnly ? "ข้อมูลพนักงาน" : (employee ? "แก้ไขข้อมูลพนักงาน" : "เพิ่มพนักงานใหม่")}
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
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-700">ข้อมูลพื้นฐาน</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    รหัสพนักงาน
                                </label>
                                <input
                                    type="text"
                                    value={formData.employeeId}
                                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                                    placeholder="เช่น EMP001"
                                    disabled={readOnly}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    ชื่อ-นามสกุล <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                                    placeholder="กรอกชื่อ-นามสกุล"
                                    required
                                    disabled={readOnly}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    อีเมล
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                                    placeholder="example@email.com"
                                    disabled={readOnly}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                                    placeholder="0xx-xxx-xxxx"
                                    required
                                    disabled={readOnly}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    ตำแหน่ง <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.position}
                                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                                    placeholder="กรอกตำแหน่ง"
                                    required
                                    disabled={readOnly}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    แผนก/สังกัด
                                </label>
                                <input
                                    type="text"
                                    value={formData.department}
                                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                                    placeholder="กรอกแผนกหรือสังกัด"
                                    disabled={readOnly}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    รูปแบบการจ้าง <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.employmentType}
                                    onChange={(e) => setFormData({ ...formData, employmentType: e.target.value as any })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                                    required
                                    disabled={readOnly}
                                >
                                    <option value="ประจำ">ประจำ</option>
                                    <option value="ชั่วคราว">ชั่วคราว</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    การจ่ายเงิน <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                                    required
                                    disabled={readOnly}
                                >
                                    <option value="รายเดือน">รายเดือน</option>
                                    <option value="รายวัน">รายวัน</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {formData.type === "รายวัน" ? "ค่าจ้างรายวัน (บาท)" : "เงินเดือน (บาท)"}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.baseSalary}
                                    onChange={(e) => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                                    placeholder="0.00"
                                    disabled={readOnly}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    สถานะ <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                                    required
                                    disabled={readOnly}
                                >
                                    <option value="ทำงาน">ทำงาน</option>
                                    <option value="ลาออก">ลาออก</option>
                                    <option value="พ้นสภาพ">พ้นสภาพ</option>
                                </select>
                            </div>

                            {((formData.status as string) !== "ทำงาน" || formData.type === "ชั่วคราว") && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        {(formData.status as string) !== "ทำงาน" ? "วันที่สิ้นสุดการทำงาน" : "วันสิ้นสุดสัญญา"}
                                        {(formData.status as string) !== "ทำงาน" && <span className="text-red-500">*</span>}
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.endDate ? new Date(formData.endDate).toISOString().split('T')[0] : ""}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value ? new Date(e.target.value) : undefined })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                                        required={(formData.status as string) !== "ทำงาน"}
                                        disabled={readOnly}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Shift Selection */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-700">กะเวลาทำงาน</h3>
                        <select
                            value={formData.shiftId}
                            onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                            disabled={readOnly}
                        >
                            <option value="">ใช้กะหลัก (Default)</option>
                            {shifts.map((shift) => (
                                <option key={shift.id} value={shift.id}>
                                    {shift.name} ({shift.checkInHour.toString().padStart(2, "0")}:{shift.checkInMinute.toString().padStart(2, "0")} - {shift.checkOutHour.toString().padStart(2, "0")}:{shift.checkOutMinute.toString().padStart(2, "0")})
                                </option>
                            ))}
                        </select>
                        {shifts.length === 0 && (
                            <p className="text-xs text-gray-500">ยังไม่มีกะที่กำหนด ไปสร้างกะได้ที่ Admin &gt; กะเวลาทำงาน</p>
                        )}
                    </div>

                    {/* Leave Quota */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-700">สิทธิ์การลา</h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    ลากิจ (วัน)
                                </label>
                                <input
                                    type="number"
                                    value={formData.leaveQuota.personal}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        leaveQuota: { ...formData.leaveQuota, personal: parseInt(e.target.value) || 0 }
                                    })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                                    min="0"
                                    disabled={readOnly}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    ลาป่วย (วัน)
                                </label>
                                <input
                                    type="number"
                                    value={formData.leaveQuota.sick}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        leaveQuota: { ...formData.leaveQuota, sick: parseInt(e.target.value) || 0 }
                                    })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                                    min="0"
                                    disabled={readOnly}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    ลาพักร้อน (วัน)
                                </label>
                                <input
                                    type="number"
                                    value={formData.leaveQuota.vacation}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        leaveQuota: { ...formData.leaveQuota, vacation: parseInt(e.target.value) || 0 }
                                    })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                                    min="0"
                                    disabled={readOnly}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Weekly Holidays */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-700">วันหยุดประจำสัปดาห์</h3>
                            {!readOnly && (
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, weeklyHolidays: defaultHolidays })}
                                    className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors"
                                >
                                    รีเซ็ตเป็นค่าเริ่มต้น
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-7 gap-2">
                            {["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."].map((day, index) => (
                                <label
                                    key={index}
                                    className={`flex flex-col items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${formData.weeklyHolidays.includes(index)
                                        ? "bg-red-500 border-red-500 text-white shadow-md"
                                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                                        } ${readOnly ? "cursor-not-allowed opacity-60" : ""}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={formData.weeklyHolidays.includes(index)}
                                        onChange={(e) => {
                                            if (readOnly) return;
                                            if (e.target.checked) {
                                                setFormData({
                                                    ...formData,
                                                    weeklyHolidays: [...formData.weeklyHolidays, index].sort()
                                                });
                                            } else {
                                                setFormData({
                                                    ...formData,
                                                    weeklyHolidays: formData.weeklyHolidays.filter(d => d !== index)
                                                });
                                            }
                                        }}
                                        className="sr-only"
                                        disabled={readOnly}
                                    />
                                    <span className="text-xs font-medium">{day}</span>
                                </label>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500">คลิกเพื่อเลือก/ยกเลิก วันหยุดประจำสัปดาห์</p>
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
                            {readOnly ? "ปิด" : "ยกเลิก"}
                        </Button>
                        {!readOnly && (
                            <Button
                                type="submit"
                                className="flex-1 h-12 bg-primary-dark hover:bg-primary-dark/90 text-white rounded-xl"
                                disabled={loading}
                            >
                                {loading ? "กำลังบันทึก..." : employee ? "บันทึกการแก้ไข" : "เพิ่มพนักงาน"}
                            </Button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
