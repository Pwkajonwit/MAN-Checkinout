"use client";

import { useEffect, useState } from "react";
import { EmployeeTable } from "@/components/employee/EmployeeTable";
import { EmployeeFormModal } from "@/components/employee/EmployeeFormModal";
import { Plus, Search, Filter, Users } from "lucide-react";
import { employeeService, type Employee } from "@/lib/firestore";
import { useAdmin } from "@/components/auth/AuthProvider";
import { CustomAlert } from "@/components/ui/custom-alert";

export default function EmployeePage() {
    const { isSuperAdmin } = useAdmin();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<"all" | "รายเดือน" | "รายวัน" | "ชั่วคราว">("all");
    const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
    const [searchQuery, setSearchQuery] = useState("");
    const [alertState, setAlertState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: "success" | "error" | "warning" | "info";
    }>({
        isOpen: false,
        title: "",
        message: "",
        type: "info"
    });

    const loadEmployees = async () => {
        try {
            const data = await employeeService.getAll();
            setEmployees(data);
            setFilteredEmployees(data);
        } catch (error) {
            console.error("Error loading employees:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEmployees();
    }, []);

    useEffect(() => {
        let result = employees;

        // Filter by Search Query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(e =>
                e.name.toLowerCase().includes(query) ||
                e.employeeId?.toLowerCase().includes(query) ||
                e.position?.toLowerCase().includes(query) ||
                e.department?.toLowerCase().includes(query)
            );
        }

        // Filter by Type
        if (filterType !== "all") {
            if (filterType === "ชั่วคราว") {
                result = result.filter(e => e.employmentType === "ชั่วคราว" || e.type === "ชั่วคราว");
            } else {
                result = result.filter(e =>
                    e.type === filterType &&
                    e.employmentType !== "ชั่วคราว"
                );
            }
        }

        // Filter by Status
        if (statusFilter === "active") {
            result = result.filter(e => !e.status || e.status === "ทำงาน");
        } else if (statusFilter === "inactive") {
            result = result.filter(e => e.status === "ลาออก" || e.status === "พ้นสภาพ");
        }

        setFilteredEmployees(result);
    }, [filterType, statusFilter, searchQuery, employees]);

    const [isReadOnly, setIsReadOnly] = useState(false);

    const handleAddEmployee = () => {
        setSelectedEmployee(null);
        setIsReadOnly(false);
        setIsModalOpen(true);
    };

    const handleEditEmployee = (employee: Employee) => {
        setSelectedEmployee(employee);
        setIsReadOnly(false);
        setIsModalOpen(true);
    };

    const handleViewEmployee = (employee: Employee) => {
        setSelectedEmployee(employee);
        setIsReadOnly(true);
        setIsModalOpen(true);
    };

    const handleDeleteEmployee = async (employee: Employee) => {
        try {
            if (employee.id) {
                await employeeService.delete(employee.id);
                await loadEmployees();
            }
        } catch (error) {
            console.error("Error deleting employee:", error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เกิดข้อผิดพลาดในการลบพนักงาน",
                type: "error"
            });
        }
    };

    const handleSuccess = () => {
        loadEmployees();
    };

    // Calculate stats
    const stats = {
        monthly: employees.filter(e => e.type === "รายเดือน" && (e.employmentType !== "ชั่วคราว") && (!e.status || e.status === "ทำงาน")).length,
        daily: employees.filter(e => e.type === "รายวัน" && (e.employmentType !== "ชั่วคราว") && (!e.status || e.status === "ทำงาน")).length,
        temporary: employees.filter(e => (e.employmentType === "ชั่วคราว" || e.type === "ชั่วคราว") && (!e.status || e.status === "ทำงาน")).length,
        total: employees.filter(e => !e.status || e.status === "ทำงาน").length,
        inactive: employees.filter(e => e.status === "ลาออก" || e.status === "พ้นสภาพ").length,
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                            รายชื่อพนักงาน
                        </h1>
                        <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            Employees
                        </span>
                        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            ทั้งหมด {stats.total} คน
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm font-normal text-slate-500 mt-1">
                        จัดการข้อมูลพนักงาน ฝ่าย แผนก และสิทธิ์การใช้งานระบบ
                    </p>
                </div>
            </div>

            {/* Compact & Clean KPI / Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5">
                {/* ประจำ - รายเดือน */}
                <div
                    onClick={() => { setFilterType("รายเดือน"); setStatusFilter("active"); }}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        filterType === "รายเดือน" && statusFilter === "active"
                            ? "border-blue-500 ring-2 ring-blue-100 bg-blue-50/20"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">ประจำ - รายเดือน</span>
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">{stats.monthly}</div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">คน</div>
                </div>

                {/* ประจำ - รายวัน */}
                <div
                    onClick={() => { setFilterType("รายวัน"); setStatusFilter("active"); }}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        filterType === "รายวัน" && statusFilter === "active"
                            ? "border-amber-500 ring-2 ring-amber-100 bg-amber-50/20"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">ประจำ - รายวัน</span>
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">{stats.daily}</div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">คน</div>
                </div>

                {/* พนักงานชั่วคราว */}
                <div
                    onClick={() => { setFilterType("ชั่วคราว"); setStatusFilter("active"); }}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        filterType === "ชั่วคราว" && statusFilter === "active"
                            ? "border-purple-500 ring-2 ring-purple-100 bg-purple-50/20"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">พนักงานชั่วคราว</span>
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">{stats.temporary}</div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">คน</div>
                </div>

                {/* ทั้งหมด (Active) */}
                <div
                    onClick={() => { setFilterType("all"); setStatusFilter("active"); }}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        filterType === "all" && statusFilter === "active"
                            ? "border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/20"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">พนักงานปัจจุบัน</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">{stats.total}</div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">คน</div>
                </div>

                {/* ลาออก / พ้นสภาพ */}
                <div
                    onClick={() => { setFilterType("all"); setStatusFilter("inactive"); }}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs col-span-2 sm:col-span-1 lg:col-span-1 ${
                        statusFilter === "inactive"
                            ? "border-rose-500 ring-2 ring-rose-100 bg-rose-50/20"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">ลาออก / พ้นสภาพ</span>
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">{stats.inactive}</div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">คน</div>
                </div>
            </div>

            {/* Compact Toolbar (Search, Filter Indicator, & Add Button) */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-2.5 sm:p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Search Input */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อ, รหัส, แผนก, หรือตำแหน่ง..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-9 pl-8 pr-7 py-1 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 w-52 sm:w-72 transition-all"
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

                    {/* Filter Status Pill */}
                    <div className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 inline-flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <span>สถานะ: <span className="font-medium text-slate-800">
                            {statusFilter === "active" ? (filterType === "all" ? "ปัจจุบันทั้งหมด" : filterType) : "พ้นสภาพ"}
                        </span></span>
                    </div>
                </div>

                {/* Add Employee Button (if super admin) */}
                {isSuperAdmin && (
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={handleAddEmployee}
                            className="h-9 inline-flex items-center gap-1.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-medium shadow-xs transition-all"
                        >
                            <Plus className="w-3.5 h-3.5 shrink-0" />
                            <span>เพิ่มพนักงานใหม่</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Table Container */}
            {loading ? (
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-10 text-center text-slate-500 font-normal">
                    <div className="animate-spin w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                    กำลังโหลดข้อมูลพนักงาน...
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden">
                    <EmployeeTable
                        employees={filteredEmployees}
                        onEdit={handleEditEmployee}
                        onDelete={handleDeleteEmployee}
                        onView={handleViewEmployee}
                        canManage={isSuperAdmin}
                    />

                    {/* Table Footer Summary */}
                    <div className="px-3.5 py-2.5 bg-slate-50/80 border-t border-slate-200 text-xs font-normal text-slate-500 flex flex-wrap items-center justify-between gap-2">
                        <span>
                            แสดงผล <span className="font-semibold text-slate-800">{filteredEmployees.length}</span> จากทั้งหมด <span className="font-semibold text-slate-800">{employees.length}</span> คน
                        </span>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                            <span>รายเดือน: {stats.monthly}</span>
                            <span>•</span>
                            <span>รายวัน: {stats.daily}</span>
                            <span>•</span>
                            <span>ชั่วคราว: {stats.temporary}</span>
                            <span>•</span>
                            <span>พ้นสภาพ: {stats.inactive}</span>
                        </div>
                    </div>
                </div>
            )}

            <EmployeeFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                employee={selectedEmployee}
                onSuccess={handleSuccess}
                readOnly={isReadOnly}
            />

            <CustomAlert
                isOpen={alertState.isOpen}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
                title={alertState.title}
                message={alertState.message}
                type={alertState.type}
            />
        </div>
    );
}
