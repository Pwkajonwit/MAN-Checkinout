"use client";

import { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { employeeService, shiftService, systemConfigService, type Employee, type Shift, type WorkLocation } from "@/lib/firestore";

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
    const [availableLocations, setAvailableLocations] = useState<WorkLocation[]>([]);
    const [locationEnabled, setLocationEnabled] = useState(false);
    const [useIndividualHolidays, setUseIndividualHolidays] = useState(false);


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
        lineUserId: "",
        weeklyHolidays: [0] as number[], // Default: วันอาทิตย์หยุด
        shiftId: "" as string, // กะเวลา
        allowedLocationIds: [] as string[],
        leaveQuota: {
            personal: 3,
            sick: 30,
            vacation: 5,
        },
    });

    // Load shifts when modal opens
    useEffect(() => {
        if (isOpen) {
            shiftService.getAll()
                .then(data => setShifts(data))
                .catch(err => console.error("Error loading shifts:", err));

            systemConfigService.get()
                .then(config => {
                    setAvailableLocations(config?.workLocations || []);
                    setLocationEnabled(config?.locationEnabled ?? false);
                    setUseIndividualHolidays(config?.useIndividualHolidays ?? false);
                })
                .catch(err => console.error("Error loading work locations:", err));
        }
    }, [isOpen]);

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
                lineUserId: employee.lineUserId || "",
                weeklyHolidays: employee.weeklyHolidays || [0],
                shiftId: employee.shiftId || "",
                allowedLocationIds: employee.allowedLocationIds || [],
                leaveQuota: {
                    personal: employee.leaveQuota?.personal || 3,
                    sick: employee.leaveQuota?.sick || 30,
                    vacation: employee.leaveQuota?.vacation || 5,
                },
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
                lineUserId: "",
                weeklyHolidays: [0],
                shiftId: "",
                allowedLocationIds: [],
                leaveQuota: {
                    personal: 6,
                    sick: 30,
                    vacation: 10,
                },
            });
        }
    }, [employee, isOpen]);

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
                lineUserId: "",
                weeklyHolidays: [0],
                shiftId: "",
                allowedLocationIds: [],
                leaveQuota: {
                    personal: 6,
                    sick: 30,
                    vacation: 10,
                },
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800">
                            {readOnly ? "ข้อมูลพนักงาน (Employee Details)" : (employee ? "แก้ไขข้อมูลพนักงาน (Edit Employee)" : "เพิ่มพนักงานใหม่ (New Employee)")}
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">จัดการข้อมูลส่วนตัว การจ้างงาน และการตั้งค่าระบบ</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto flex-1 p-6 custom-scrollbar">
                    <form id="employee-form" onSubmit={handleSubmit} className="space-y-6">

                        {/* 1. ข้อมูลส่วนตัว (Personal Info) */}
                        <section>
                            <div className="flex items-center gap-2 mb-3 text-blue-800">
                                <span className="bg-blue-100 p-1.5 rounded-lg"><div className="w-2 h-2 rounded-full bg-blue-600" /></span>
                                <h3 className="text-sm font-semibold uppercase tracking-wider">ข้อมูลส่วนตัว</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3">
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-sm font-semibold text-slate-800 mb-1">
                                        ชื่อ-นามสกุล <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                                        placeholder="ตัวอย่าง: สมชาย ใจดี"
                                        required
                                        disabled={readOnly}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-800 mb-1">อีเมล</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                                        placeholder="user@example.com"
                                        disabled={readOnly}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-800 mb-1">
                                        เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                                        placeholder="08x-xxx-xxxx"
                                        required
                                        disabled={readOnly}
                                    />
                                </div>
                            </div>
                        </section>

                        <div className="border-t border-gray-100" />

                        {/* 2. ข้อมูลการทำงาน (Employment Details) */}
                        <section>
                            <div className="flex items-center gap-2 mb-3 text-orange-800">
                                <span className="bg-orange-100 p-1.5 rounded-lg"><div className="w-2 h-2 rounded-full bg-orange-600" /></span>
                                <h3 className="text-sm font-semibold uppercase tracking-wider">ข้อมูลการจ้างงาน</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-800 mb-1">รหัสพนักงาน</label>
                                    <input
                                        type="text"
                                        value={formData.employeeId}
                                        onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-slate-50 disabled:text-slate-500 font-mono"
                                        placeholder="EMP-XXXX"
                                        disabled={readOnly}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-800 mb-1">
                                        สถานะ <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                                        required
                                        disabled={readOnly}
                                    >
                                        <option value="ทำงาน">🟢 กำลังทำงาน (Active)</option>
                                        <option value="ลาออก">🔴 ลาออก (Resigned)</option>
                                        <option value="พ้นสภาพ">⚫ พ้นสภาพ (Terminated)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-800 mb-1">
                                        ตำแหน่ง <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.position}
                                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                                        required
                                        disabled={readOnly}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-800 mb-1">แผนก/สังกัด</label>
                                    <input
                                        type="text"
                                        value={formData.department}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                                        placeholder="ตัวอย่าง: IT, HR, Sales"
                                        disabled={readOnly}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-800 mb-1">
                                        รูปแบบสัญญาจ้าง <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.employmentType}
                                        onChange={(e) => setFormData({ ...formData, employmentType: e.target.value as any })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                                        required
                                        disabled={readOnly}
                                    >
                                        <option value="ประจำ">พนักงานประจำ</option>
                                        <option value="ชั่วคราว">พนักงานชั่วคราว/Contract</option>
                                    </select>
                                </div>
                                {((formData.status as string) !== "ทำงาน" || formData.type === "ชั่วคราว" || formData.employmentType === "ชั่วคราว") && (
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                                            วันที่สิ้นสุด <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.endDate ? new Date(formData.endDate).toISOString().split('T')[0] : ""}
                                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value ? new Date(e.target.value) : undefined })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                            required
                                            disabled={readOnly}
                                        />
                                    </div>
                                )}
                            </div>
                        </section>

                        <div className="border-t border-gray-100" />

                        {/* 3. การจ่ายเงินและกะเวลา (Payroll & Shift) */}
                        <section>
                            <div className="flex items-center gap-2 mb-3 text-purple-800">
                                <span className="bg-purple-100 p-1.5 rounded-lg"><div className="w-2 h-2 rounded-full bg-purple-600" /></span>
                                <h3 className="text-sm font-semibold uppercase tracking-wider">บัญชีและเวลาทำงาน</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-800 mb-1">
                                        ประเภทการจ่าย <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                                        required
                                        disabled={readOnly}
                                    >
                                        <option value="รายเดือน">รายเดือน (Monthly)</option>
                                        <option value="รายวัน">รายวัน (Daily)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-800 mb-1">
                                        {formData.type === "รายวัน" ? "ค่าจ้างรายวัน (บาท)" : "เงินเดือน (บาท)"}
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.baseSalary}
                                        onChange={(e) => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-slate-50 disabled:text-slate-500 font-mono"
                                        disabled={readOnly}
                                    />
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-sm font-semibold text-slate-800 mb-1">
                                        กะเวลาทำงาน (Work Shift)
                                    </label>
                                    <select
                                        value={formData.shiftId}
                                        onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                                        disabled={readOnly}
                                    >
                                        <option value="">⚙️ ใช้ค่าเริ่มต้นของระบบ (Default System Settings)</option>
                                        {shifts.map(shift => (
                                            <option key={shift.id} value={shift.id}>
                                                🕒 {shift.name} ({String(shift.checkInHour).padStart(2, '0')}:{String(shift.checkInMinute).padStart(2, '0')} - {String(shift.checkOutHour).padStart(2, '0')}:{String(shift.checkOutMinute).padStart(2, '0')})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className={`col-span-1 md:col-span-2 ${!useIndividualHolidays ? 'opacity-40 pointer-events-none' : ''}`}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-sm font-semibold text-slate-800">
                                            วันหยุดประจำสัปดาห์
                                        </label>
                                        {useIndividualHolidays ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                โหมดรายบุคคล
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                โหมดวันหยุดกลาง (ตั้งค่าใน Settings)
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { day: 1, label: "จันทร์" },
                                            { day: 2, label: "อังคาร" },
                                            { day: 3, label: "พุธ" },
                                            { day: 4, label: "พฤหัส" },
                                            { day: 5, label: "ศุกร์" },
                                            { day: 6, label: "เสาร์" },
                                            { day: 0, label: "อาทิตย์" },
                                        ].map(({ day, label }) => {
                                            const isSelected = formData.weeklyHolidays.includes(day);
                                            return (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    onClick={() => {
                                                        if (readOnly || !useIndividualHolidays) return;
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            weeklyHolidays: isSelected
                                                                ? prev.weeklyHolidays.filter(d => d !== day)
                                                                : [...prev.weeklyHolidays, day].sort()
                                                        }));
                                                    }}
                                                    disabled={readOnly || !useIndividualHolidays}
                                                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${isSelected
                                                        ? "bg-gray-800 text-white border-gray-800 shadow-sm"
                                                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                                                        } ${(readOnly || !useIndividualHolidays) ? "opacity-60 cursor-not-allowed" : ""}`}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className={`col-span-1 md:col-span-2 ${!locationEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                                    <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                                        Work Locations
                                        {!locationEnabled && (
                                            <span className="ml-2 text-xs font-normal text-gray-400">(ปิดใช้งาน GPS ใน Settings)</span>
                                        )}
                                    </label>
                                    {availableLocations.length > 0 ? (
                                        <>
                                            <div className="flex flex-wrap gap-2">
                                                {availableLocations.map((location) => {
                                                    const isSelected = formData.allowedLocationIds.includes(location.id);
                                                    return (
                                                        <button
                                                            key={location.id}
                                                            type="button"
                                                            onClick={() => {
                                                                if (readOnly || !locationEnabled) return;
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    allowedLocationIds: isSelected
                                                                        ? prev.allowedLocationIds.filter(id => id !== location.id)
                                                                        : [...prev.allowedLocationIds, location.id]
                                                                }));
                                                            }}
                                                            disabled={readOnly || !locationEnabled}
                                                            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${isSelected
                                                                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                                                : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                                                                } ${(readOnly || !locationEnabled) ? "opacity-60 cursor-not-allowed" : ""}`}
                                                        >
                                                            {location.name}
                                                            <span className="ml-2 text-[10px] opacity-80">{location.radius}m</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2">
                                                หากไม่เลือกเลย ระบบจะอนุญาตทุก Work Location ที่ตั้งไว้ใน Settings
                                            </p>
                                        </>
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                                            ยังไม่มี Work Location ใน System Settings
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        <div className="border-t border-gray-100" />

                        {/* 4. สิทธิ์การลา (Leave Quotas) */}
                        <section>
                            <div className="flex items-center gap-2 mb-3 text-teal-800">
                                <span className="bg-teal-100 p-1.5 rounded-lg"><div className="w-2 h-2 rounded-full bg-teal-600" /></span>
                                <h3 className="text-sm font-semibold uppercase tracking-wider">โควต้าวันลา (ต่อปี)</h3>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-2.5 bg-slate-50 rounded-lg border border-gray-100 text-center">
                                    <label className="block text-xs font-semibold text-slate-600 mb-0.5">ลากิจ</label>
                                    <input
                                        type="number"
                                        value={formData.leaveQuota.personal}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            leaveQuota: { ...formData.leaveQuota, personal: parseInt(e.target.value) || 0 }
                                        })}
                                        className="w-full text-center bg-transparent font-bold text-gray-900 focus:outline-none p-0"
                                        disabled={readOnly}
                                    />
                                    <span className="text-[10px] text-gray-400">วัน</span>
                                </div>
                                <div className="p-2.5 bg-slate-50 rounded-lg border border-gray-100 text-center">
                                    <label className="block text-xs font-semibold text-slate-600 mb-0.5">ลาป่วย</label>
                                    <input
                                        type="number"
                                        value={formData.leaveQuota.sick}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            leaveQuota: { ...formData.leaveQuota, sick: parseInt(e.target.value) || 0 }
                                        })}
                                        className="w-full text-center bg-transparent font-bold text-gray-900 focus:outline-none p-0"
                                        disabled={readOnly}
                                    />
                                    <span className="text-[10px] text-gray-400">วัน</span>
                                </div>
                                <div className="p-2.5 bg-slate-50 rounded-lg border border-gray-100 text-center">
                                    <label className="block text-xs font-semibold text-slate-600 mb-0.5">พักร้อน</label>
                                    <input
                                        type="number"
                                        value={formData.leaveQuota.vacation}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            leaveQuota: { ...formData.leaveQuota, vacation: parseInt(e.target.value) || 0 }
                                        })}
                                        className="w-full text-center bg-transparent font-bold text-gray-900 focus:outline-none p-0"
                                        disabled={readOnly}
                                    />
                                    <span className="text-[10px] text-gray-400">วัน</span>
                                </div>
                            </div>
                        </section>

                        {employee && (
                            <section className="bg-gray-50/50 p-4 rounded-xl border border-gray-200 mt-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-medium text-gray-900">LINE Connection</h3>
                                    {formData.lineUserId ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                            Connected
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                            Not Connected
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={formData.lineUserId || "ยังไม่ได้ผูกบัญชี LINE"}
                                        readOnly
                                        className="flex-1 bg-white px-3 py-2 border border-slate-300 rounded-md shadow-sm text-xs font-mono text-gray-500"
                                    />
                                    {formData.lineUserId && !readOnly && (
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, lineUserId: "" })}
                                            className="px-3 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50 transition-colors"
                                        >
                                            Unlink
                                        </button>
                                    )}
                                </div>
                            </section>
                        )}

                    </form>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-100 transition-colors bg-white shadow-sm"
                        disabled={loading}
                    >
                        {readOnly ? "ปิดหน้าต่าง" : "ยกเลิก"}
                    </button>
                    {!readOnly && (
                        <button
                            onClick={() => (document.getElementById("employee-form") as HTMLFormElement)?.requestSubmit()}
                            className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    กำลังบันทึก...
                                </span>
                            ) : (
                                employee ? "บันทึกการแก้ไข" : "เพิ่มพนักงาน"
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
