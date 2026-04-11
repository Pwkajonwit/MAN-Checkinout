"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";

import { EmployeeTable } from "@/components/employee/EmployeeTable";
import { EmployeeFormModal } from "@/components/employee/EmployeeFormModal";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, Search, Filter, Users } from "lucide-react";
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
                e.position.toLowerCase().includes(query)
            );
        }

        // Filter by Type
        if (filterType !== "all") {
            if (filterType === "ชั่วคราว") {
                result = result.filter(e => e.employmentType === "ชั่วคราว" || e.type === "ชั่วคราว");
            } else {
                // For "รายเดือน" and "รายวัน", exclude "ชั่วคราว" unless specifically requested
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
        <div className="flex-1 px-8 py-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <PageHeader
                    title="รายชื่อพนักงาน (Employees)"
                    subtitle={`จัดการข้อมูลพนักงานทั้งหมด ${stats.total} คน`}
                />

                {isSuperAdmin && (
                    <button
                        onClick={handleAddEmployee}
                        className="inline-flex items-center justify-center px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-all shadow-sm shadow-blue-200 gap-2 min-w-[160px]"
                    >
                        <Plus className="w-4 h-4" />
                        เพิ่มพนักงานใหม่
                    </button>
                )}
            </div>

            {/* KPI / Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div onClick={() => { setFilterType("รายเดือน"); setStatusFilter("active"); }} className="cursor-pointer group">
                    <div className={`h-full p-4 rounded-xl border transition-all duration-200 ${filterType === "รายเดือน" && statusFilter === "active"
                        ? "bg-blue-50 border-blue-200 shadow-sm"
                        : "bg-white border-gray-200 hover:border-blue-300 hover:shadow-md"
                        }`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">ประจำ - รายเดือน</span>
                            <div className={`w-2 h-2 rounded-full ${filterType === "รายเดือน" && statusFilter === "active" ? "bg-blue-500" : "bg-gray-300"}`} />
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-gray-900">{stats.monthly}</span>
                            <span className="text-xs text-gray-500">คน</span>
                        </div>
                    </div>
                </div>

                <div onClick={() => { setFilterType("รายวัน"); setStatusFilter("active"); }} className="cursor-pointer group">
                    <div className={`h-full p-4 rounded-xl border transition-all duration-200 ${filterType === "รายวัน" && statusFilter === "active"
                        ? "bg-orange-50 border-orange-200 shadow-sm"
                        : "bg-white border-gray-200 hover:border-orange-300 hover:shadow-md"
                        }`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">ประจำ - รายวัน</span>
                            <div className={`w-2 h-2 rounded-full ${filterType === "รายวัน" && statusFilter === "active" ? "bg-orange-500" : "bg-gray-300"}`} />
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-gray-900">{stats.daily}</span>
                            <span className="text-xs text-gray-500">คน</span>
                        </div>
                    </div>
                </div>

                <div onClick={() => { setFilterType("ชั่วคราว"); setStatusFilter("active"); }} className="cursor-pointer group">
                    <div className={`h-full p-4 rounded-xl border transition-all duration-200 ${filterType === "ชั่วคราว" && statusFilter === "active"
                        ? "bg-purple-50 border-purple-200 shadow-sm"
                        : "bg-white border-gray-200 hover:border-purple-300 hover:shadow-md"
                        }`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">พนักงานชั่วคราว</span>
                            <div className={`w-2 h-2 rounded-full ${filterType === "ชั่วคราว" && statusFilter === "active" ? "bg-purple-500" : "bg-gray-300"}`} />
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-gray-900">{stats.temporary}</span>
                            <span className="text-xs text-gray-500">คน</span>
                        </div>
                    </div>
                </div>

                <div onClick={() => { setFilterType("all"); setStatusFilter("active"); }} className="cursor-pointer group">
                    <div className={`h-full p-4 rounded-xl border transition-all duration-200 ${filterType === "all" && statusFilter === "active"
                        ? "bg-gray-50 border-gray-300 shadow-sm"
                        : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-md"
                        }`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">ทั้งหมด (Active)</span>
                            <div className={`w-2 h-2 rounded-full ${filterType === "all" && statusFilter === "active" ? "bg-gray-900" : "bg-gray-300"}`} />
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
                            <span className="text-xs text-gray-500">คน</span>
                        </div>
                    </div>
                </div>

                <div onClick={() => { setFilterType("all"); setStatusFilter("inactive"); }} className="cursor-pointer group">
                    <div className={`h-full p-4 rounded-xl border transition-all duration-200 ${statusFilter === "inactive"
                        ? "bg-red-50 border-red-200 shadow-sm"
                        : "bg-white border-gray-200 hover:border-red-300 hover:shadow-md"
                        }`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">ลาออก/พ้นสภาพ</span>
                            <div className={`w-2 h-2 rounded-full ${statusFilter === "inactive" ? "bg-red-500" : "bg-gray-300"}`} />
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-gray-900">{stats.inactive}</span>
                            <span className="text-xs text-gray-500">คน</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls & Search */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-96">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="ค้นหาชื่อ, รหัส, หรือตำแหน่งงาน..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:bg-gray-50 focus:bg-white"
                    />
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                    <Filter className="w-3.5 h-3.5" />
                    <span>สถานะ: <span className="font-medium text-gray-700">
                        {statusFilter === "active" ? (filterType === "all" ? "พนักงานปัจจุบันทั้งหมด" : filterType) : "พ้นสภาพ"}
                    </span></span>
                </div>
            </div>

            {/* Loading / Data Table */}
            {loading ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 flex flex-col items-center justify-center text-gray-500">
                    <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                    <p className="font-medium">กำลังโหลดข้อมูลพนักงาน...</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
                    <EmployeeTable
                        employees={filteredEmployees}
                        onEdit={handleEditEmployee}
                        onDelete={handleDeleteEmployee}
                        onView={handleViewEmployee}
                        canManage={isSuperAdmin}
                    />
                    {filteredEmployees.length === 0 && (
                        <div className="px-6 py-16 text-center text-gray-500">
                            <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
                                <Users className="w-6 h-6 text-gray-400" />
                            </div>
                            <p>ไม่พบข้อมูลพนักงานตามเงื่อนไขที่ระบุ</p>
                        </div>
                    )}
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
