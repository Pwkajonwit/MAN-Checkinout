"use client";

import { useState, useEffect } from "react";
import { X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { attendanceService, employeeService, type Attendance, type Employee } from "@/lib/firestore";

interface AttendanceFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    attendance?: Attendance | null;
    onSuccess: () => void;
}

export function AttendanceFormModal({ isOpen, onClose, attendance, onSuccess }: AttendanceFormModalProps) {
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [formData, setFormData] = useState({
        employeeId: "",
        employeeName: "",
        date: "",
        checkInTime: "",
        checkOutTime: "",
        status: "เข้างาน" as "เข้างาน" | "ออกงาน" | "ลางาน" | "สาย" | "ก่อนพัก" | "หลังพัก" | "ออกนอกพื้นที่ขาไป" | "ออกนอกพื้นที่ขากลับ",
        location: "",
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

    // Update form when attendance prop changes
    useEffect(() => {
        if (attendance) {
            setFormData({
                employeeId: attendance.employeeId || "",
                employeeName: attendance.employeeName || "",
                date: attendance.date ? new Date(attendance.date).toISOString().split('T')[0] : "",
                checkInTime: attendance.checkIn ? new Date(attendance.checkIn).toTimeString().slice(0, 5) : "",
                checkOutTime: attendance.checkOut ? new Date(attendance.checkOut).toTimeString().slice(0, 5) : "",
                status: attendance.status || "เข้างาน",
                location: attendance.location || "",
            });
        } else {
            // Set default to today
            const today = new Date().toISOString().split('T')[0];
            setFormData({
                employeeId: "",
                employeeName: "",
                date: today,
                checkInTime: "",
                checkOutTime: "",
                status: "เข้างาน",
                location: "",
            });
        }
    }, [attendance]);

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
            const dateStr = formData.date;
            const checkInDateTime = formData.checkInTime
                ? new Date(`${dateStr}T${formData.checkInTime}:00`)
                : null;
            const checkOutDateTime = formData.checkOutTime
                ? new Date(`${dateStr}T${formData.checkOutTime}:00`)
                : null;

            const attendanceData = {
                employeeId: formData.employeeId,
                employeeName: formData.employeeName,
                date: new Date(dateStr),
                checkIn: checkInDateTime,
                checkOut: checkOutDateTime,
                status: formData.status,
                location: formData.location,
            };

            if (attendance?.id) {
                await attendanceService.update(attendance.id, attendanceData);
            } else {
                await attendanceService.create(attendanceData);
            }
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error saving attendance:", error);
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
                        {attendance ? "แก้ไขการลงเวลา" : "บันทึกการลงเวลา"}
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
                            disabled={!!attendance}
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
                            วันที่ <span className="text-red-500">*</span>
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
                                เวลาเข้างาน <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="time"
                                    value={formData.checkInTime}
                                    onChange={(e) => setFormData({ ...formData, checkInTime: e.target.value })}
                                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                เวลาออกงาน
                            </label>
                            <div className="relative">
                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="time"
                                    value={formData.checkOutTime}
                                    onChange={(e) => setFormData({ ...formData, checkOutTime: e.target.value })}
                                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            สถานะ <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                            required
                        >
                            <option value="เข้างาน">เข้างาน</option>
                            <option value="ออกงาน">ออกงาน</option>
                            <option value="ลางาน">ลางาน</option>
                            <option value="สาย">สาย</option>
                            <option value="ก่อนพัก">ก่อนพัก</option>
                            <option value="หลังพัก">หลังพัก</option>
                            <option value="ออกนอกพื้นที่ขาไป">ออกนอกพื้นที่ขาไป</option>
                            <option value="ออกนอกพื้นที่ขากลับ">ออกนอกพื้นที่ขากลับ</option>
                        </select>
                    </div>

                    {/* Location */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            สถานที่
                        </label>
                        <input
                            type="text"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent"
                            placeholder="เช่น สำนักงาน, ออนไซต์, ทำงานที่บ้าน"
                        />
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
                            {loading ? "กำลังบันทึก..." : attendance ? "บันทึกการแก้ไข" : "บันทึกการลงเวลา"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
