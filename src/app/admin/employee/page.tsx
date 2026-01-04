"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { EmployeeTable } from "@/components/employee/EmployeeTable";
import { EmployeeFormModal } from "@/components/employee/EmployeeFormModal";
import { Button } from "@/components/ui/button";
import { Pencil, Plus } from "lucide-react";
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
        <div>
            <PageHeader
                title="พนักงานทั้งหมด"
                subtitle={`${filteredEmployees.length} results found`}
                searchPlaceholder="ค้นหา ชื่อ, รหัส, ตำแหน่ง..."
                onSearch={setSearchQuery}
                action={
                    isSuperAdmin ? (
                        <div className="flex gap-2">
                            <Button
                                onClick={handleAddEmployee}
                                className="bg-primary-dark hover:bg-primary-dark/90 text-white rounded-xl px-6 gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                เพิ่มพนักงาน
                            </Button>

                        </div>
                    ) : null
                }
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                <div onClick={() => { setFilterType("รายเดือน"); setStatusFilter("active"); }} className="cursor-pointer transition-transform hover:scale-105">
                    <StatsCard
                        title="ประจำ - รายเดือน"
                        value={stats.monthly}
                        className={filterType === "รายเดือน" && statusFilter === "active" ? "ring-2 ring-blue-500 bg-blue-50" : ""}
                    />
                </div>
                <div onClick={() => { setFilterType("รายวัน"); setStatusFilter("active"); }} className="cursor-pointer transition-transform hover:scale-105">
                    <StatsCard
                        title="ประจำ - รายวัน"
                        value={stats.daily}
                        className={filterType === "รายวัน" && statusFilter === "active" ? "ring-2 ring-orange-500 bg-orange-50" : ""}
                    />
                </div>
                <div onClick={() => { setFilterType("ชั่วคราว"); setStatusFilter("active"); }} className="cursor-pointer transition-transform hover:scale-105">
                    <StatsCard
                        title="พนักงานชั่วคราว"
                        value={stats.temporary}
                        className={filterType === "ชั่วคราว" && statusFilter === "active" ? "ring-2 ring-purple-500 bg-purple-50" : ""}
                    />
                </div>
                <div onClick={() => { setFilterType("all"); setStatusFilter("active"); }} className="cursor-pointer transition-transform hover:scale-105">
                    <StatsCard
                        title="พนักงานทั้งหมด"
                        value={stats.total}
                        className={filterType === "all" && statusFilter === "active" ? "ring-2 ring-gray-500 bg-gray-50" : ""}
                    />
                </div>
                <div onClick={() => { setFilterType("all"); setStatusFilter("inactive"); }} className="cursor-pointer transition-transform hover:scale-105">
                    <StatsCard
                        title="ลาออก/พ้นสภาพ"
                        value={stats.inactive}
                        className={statusFilter === "inactive" ? "ring-2 ring-red-500 bg-red-50" : ""}
                    />
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="w-12 h-12 border-4 border-gray-100 border-t-primary rounded-full animate-spin mx-auto"></div>
                    <p className="text-gray-600 mt-4">กำลังโหลดข้อมูล...</p>
                </div>
            ) : (
                <EmployeeTable
                    employees={filteredEmployees}
                    onEdit={handleEditEmployee}
                    onDelete={handleDeleteEmployee}
                    onView={handleViewEmployee}
                    canManage={isSuperAdmin}
                />
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
