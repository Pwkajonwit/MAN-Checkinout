"use client";

import { useState, useEffect, useRef } from "react";
import { X, Clock, Search, ChevronDown } from "lucide-react";
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
    const [searchTerm, setSearchTerm] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        if (isDropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isDropdownOpen]);

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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white border border-slate-100 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 p-6 flex items-center justify-between ">
                    <h2 className="text-xl font-semibold text-slate-900">
                        {attendance ? "แก้ไขการลงเวลา" : "บันทึกการลงเวลา"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Employee Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            เลือกพนักงาน <span className="text-red-500">*</span>
                        </label>
                        <div className="relative" ref={dropdownRef}>
                            <button
                                type="button"
                                onClick={() => !attendance && setIsDropdownOpen(!isDropdownOpen)}
                                className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#009966]/20 focus:border-[#009966] transition-all ${attendance ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}`}
                                disabled={!!attendance}
                            >
                                <span className={formData.employeeName ? 'text-slate-900' : 'text-slate-400'}>
                                    {formData.employeeName || "-- เลือกพนักงาน --"}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isDropdownOpen && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden">
                                    <div className="p-2 border-b border-slate-100 bg-slate-50">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                type="text"
                                                autoFocus
                                                placeholder="ค้นหาชื่อพนักงาน..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#009966]/20 focus:border-[#009966]"
                                            />
                                        </div>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto">
                                        {employees
                                            .filter(emp => (emp.name || "").toLowerCase().includes(searchTerm.toLowerCase()))
                                            .map((emp) => (
                                                <button
                                                    key={emp.id}
                                                    type="button"
                                                    onClick={() => {
                                                        if (emp.id) {
                                                            handleEmployeeChange(emp.id);
                                                            setIsDropdownOpen(false);
                                                            setSearchTerm("");
                                                        }
                                                    }}
                                                    className={`w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex flex-col gap-0.5 ${formData.employeeId === emp.id ? 'bg-[#009966]/5 text-[#009966]' : 'text-slate-700'}`}
                                                >
                                                    <span className="font-medium">{emp.name}</span>
                                                    <span className="text-xs text-slate-400">{emp.type}</span>
                                                </button>
                                            ))}
                                        {employees.filter(emp => (emp.name || "").toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                                            <div className="px-3 py-4 text-sm text-center text-slate-400">
                                                ไม่พบพนักงานที่ค้นหา
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            วันที่ <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#009966]/20 focus:border-[#009966] transition-all"
                            required
                        />
                    </div>

                    {/* Time Range */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                เวลาเข้างาน <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="time"
                                    value={formData.checkInTime}
                                    onChange={(e) => setFormData({ ...formData, checkInTime: e.target.value })}
                                    className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#009966]/20 focus:border-[#009966] transition-all"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                เวลาออกงาน
                            </label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="time"
                                    value={formData.checkOutTime}
                                    onChange={(e) => setFormData({ ...formData, checkOutTime: e.target.value })}
                                    className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#009966]/20 focus:border-[#009966] transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            สถานะ <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#009966]/20 focus:border-[#009966] transition-all"
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
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            สถานที่
                        </label>
                        <input
                            type="text"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#009966]/20 focus:border-[#009966] transition-all placeholder:text-slate-400"
                            placeholder="เช่น สำนักงาน, ออนไซต์, ทำงานที่บ้าน"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-10 rounded-md text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                            disabled={loading}
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            className="flex-1 h-10 bg-[#009966] hover:bg-[#008f60] text-white rounded-md text-sm font-medium transition-all shadow-md shadow-[#009966]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading}
                        >
                            {loading ? "กำลังบันทึก..." : attendance ? "บันทึกการแก้ไข" : "บันทึกการลงเวลา"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
