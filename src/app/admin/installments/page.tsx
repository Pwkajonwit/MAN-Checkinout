"use client";

import { useEffect, useMemo, useState } from "react";
import { employeeService, installmentService, type Employee, type InstallmentPlan } from "@/lib/firestore";
import { CheckCircle2, Pause, Pencil, Play, Plus, Search, X, XCircle } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { CustomAlert } from "@/components/ui/custom-alert";

type PlanForm = {
    employeeId: string;
    itemName: string;
    itemCategory: string;
    principalAmount: string;
    monthlyDeduction: string;
    totalMonths: string;
    startMonth: string;
    notes: string;
};

const currentMonth = () => new Date().toISOString().slice(0, 7);
const money = (value: number | string | undefined) => Number(value || 0).toLocaleString();

const parseDate = (d: any): Date | null => {
    if (!d) return null;
    if (d instanceof Date) return d;
    if (typeof d?.toDate === "function") return d.toDate();
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
};

export default function InstallmentsPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [plans, setPlans] = useState<InstallmentPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | InstallmentPlan["status"]>("all");
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [closePlan, setClosePlan] = useState<InstallmentPlan | null>(null);
    const [closeAmount, setCloseAmount] = useState("");
    const [closeReason, setCloseReason] = useState("manual_settlement");
    const [closeNote, setCloseNote] = useState("");
    const [editPlan, setEditPlan] = useState<InstallmentPlan | null>(null);
    const [alertState, setAlertState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: "success" | "error" | "warning" | "info";
    }>({
        isOpen: false,
        title: "",
        message: "",
        type: "info",
    });

    const [editForm, setEditForm] = useState<PlanForm>({
        employeeId: "",
        itemName: "",
        itemCategory: "computer",
        principalAmount: "",
        monthlyDeduction: "",
        totalMonths: "",
        startMonth: currentMonth(),
        notes: "",
    });

    const [form, setForm] = useState<PlanForm>({
        employeeId: "",
        itemName: "",
        itemCategory: "computer",
        principalAmount: "",
        monthlyDeduction: "",
        totalMonths: "",
        startMonth: currentMonth(),
        notes: "",
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [employeeData, planData] = await Promise.all([
                employeeService.getAll(),
                installmentService.getAll(),
            ]);
            setEmployees(employeeData.filter((employee) => employee.status === "ทำงาน"));
            setPlans(planData);
        } catch (error) {
            console.error("Error loading installments:", error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "โหลดข้อมูลรายการผ่อนสินค้าไม่สำเร็จ",
                type: "error",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const selectedEmployee = employees.find((employee) => employee.id === form.employeeId);
    const principal = Number(form.principalAmount || 0);
    const monthlyDeduction = Number(form.monthlyDeduction || 0);
    const calculatedMonths =
        principal > 0 && monthlyDeduction > 0 ? Math.ceil(principal / monthlyDeduction) : 0;

    const filteredPlans = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return plans.filter((plan) => {
            const matchesStatus = statusFilter === "all" || plan.status === statusFilter;
            const matchesQuery =
                !normalizedQuery ||
                plan.employeeName.toLowerCase().includes(normalizedQuery) ||
                plan.itemName.toLowerCase().includes(normalizedQuery) ||
                (plan.employeeCode || "").toLowerCase().includes(normalizedQuery);
            return matchesStatus && matchesQuery;
        });
    }, [plans, query, statusFilter]);

    const summary = useMemo(() => {
        return plans.reduce(
            (acc, plan) => {
                acc.totalPrincipal += Number(plan.principalAmount || 0);
                acc.totalRemaining += Number(plan.remainingAmount || 0);
                if (plan.status === "active") acc.active += 1;
                if (plan.status === "closed" || plan.status === "paid_off") acc.closed += 1;
                return acc;
            },
            { totalPrincipal: 0, totalRemaining: 0, active: 0, closed: 0 }
        );
    }, [plans]);

    const resetForm = () => {
        setForm({
            employeeId: "",
            itemName: "",
            itemCategory: "computer",
            principalAmount: "",
            monthlyDeduction: "",
            totalMonths: "",
            startMonth: currentMonth(),
            notes: "",
        });
    };

    const handleCreate = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedEmployee?.id) {
            setAlertState({
                isOpen: true,
                title: "ข้อมูลไม่ครบถ้วน",
                message: "กรุณาเลือกพนักงาน",
                type: "warning",
            });
            return;
        }
        if (!form.itemName.trim() || principal <= 0 || monthlyDeduction <= 0) {
            setAlertState({
                isOpen: true,
                title: "ข้อมูลไม่ถูกต้อง",
                message: "กรุณากรอกสินค้า ยอดรวม และยอดหักต่อเดือนให้ถูกต้อง",
                type: "warning",
            });
            return;
        }

        setSaving(true);
        try {
            await installmentService.create({
                employeeId: selectedEmployee.id,
                employeeCode: selectedEmployee.employeeId || "",
                employeeName: selectedEmployee.name,
                itemName: form.itemName.trim(),
                itemCategory: form.itemCategory.trim() || "equipment",
                principalAmount: principal,
                monthlyDeduction,
                totalMonths: Number(form.totalMonths || calculatedMonths || 1),
                startMonth: form.startMonth || currentMonth(),
                notes: form.notes.trim(),
            });
            resetForm();
            setShowCreateModal(false);
            setAlertState({
                isOpen: true,
                title: "สำเร็จ",
                message: "สร้างรายการผ่อนสินค้าเรียบร้อยแล้ว",
                type: "success",
            });
            await loadData();
        } catch (error) {
            console.error("Error creating installment:", error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "สร้างรายการผ่อนไม่สำเร็จ",
                type: "error",
            });
        } finally {
            setSaving(false);
        }
    };

    const openEditModal = (plan: InstallmentPlan) => {
        setEditPlan(plan);
        setEditForm({
            employeeId: plan.employeeId,
            itemName: plan.itemName,
            itemCategory: plan.itemCategory || "equipment",
            principalAmount: String(plan.principalAmount || 0),
            monthlyDeduction: String(plan.monthlyDeduction || 0),
            totalMonths: String(plan.totalMonths || 1),
            startMonth: plan.startMonth || currentMonth(),
            notes: plan.notes || "",
        });
    };

    const handleUpdatePlan = async () => {
        if (!editPlan?.id) return;

        const nextPrincipal = Number(editForm.principalAmount || 0);
        const nextMonthlyDeduction = Number(editForm.monthlyDeduction || 0);
        const nextTotalMonths = Number(editForm.totalMonths || 0);
        const paidAmount = Number(editPlan.paidAmount || 0);

        if (
            !editForm.itemName.trim() ||
            nextPrincipal <= 0 ||
            nextMonthlyDeduction <= 0 ||
            nextTotalMonths <= 0
        ) {
            setAlertState({
                isOpen: true,
                title: "ข้อมูลไม่ครบถ้วน",
                message: "กรุณากรอกสินค้า ยอดรวม ยอดหักต่อเดือน และจำนวนงวดให้ถูกต้อง",
                type: "warning",
            });
            return;
        }

        if (nextPrincipal < paidAmount) {
            const confirmed = window.confirm(
                `ยอดรวมใหม่ต่ำกว่ายอดที่จ่ายแล้ว ฿${money(paidAmount)} ระบบจะตั้งยอดคงเหลือเป็น 0 และเปลี่ยนเป็นผ่อนครบ ต้องการดำเนินการต่อไหม?`
            );
            if (!confirmed) return;
        }

        const remainingAmount = Math.max(0, nextPrincipal - paidAmount);
        const nextStatus =
            remainingAmount <= 0 && (editPlan.status === "active" || editPlan.status === "paused")
                ? "paid_off"
                : editPlan.status === "paid_off" && remainingAmount > 0
                ? "active"
                : editPlan.status;

        setSaving(true);
        try {
            await installmentService.update(editPlan.id, {
                itemName: editForm.itemName.trim(),
                itemCategory: editForm.itemCategory.trim() || "equipment",
                principalAmount: nextPrincipal,
                monthlyDeduction: nextMonthlyDeduction,
                totalMonths: nextTotalMonths,
                startMonth: editForm.startMonth || currentMonth(),
                notes: editForm.notes.trim(),
                remainingAmount,
                status: nextStatus,
                closedAt: nextStatus === "paid_off" ? new Date() : undefined,
                closeReason: nextStatus === "paid_off" ? "adjusted_to_paid_off" : editPlan.closeReason,
            });
            setEditPlan(null);
            setAlertState({
                isOpen: true,
                title: "สำเร็จ",
                message: "บันทึกการแก้ไขรายการผ่อนเรียบร้อยแล้ว",
                type: "success",
            });
            await loadData();
        } catch (error) {
            console.error("Error updating installment:", error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "แก้ไขรายการผ่อนไม่สำเร็จ",
                type: "error",
            });
        } finally {
            setSaving(false);
        }
    };

    const updateStatus = async (plan: InstallmentPlan, status: InstallmentPlan["status"]) => {
        if (!plan.id) return;
        const confirmed =
            status === "cancelled"
                ? window.confirm(`ต้องการยกเลิกรายการผ่อน "${plan.itemName}" ใช่ไหม?`)
                : true;
        if (!confirmed) return;

        try {
            await installmentService.update(plan.id, { status });
            setAlertState({
                isOpen: true,
                title: "สำเร็จ",
                message: `อัปเดตสถานะเป็น "${getStatusLabel(status)}" เรียบร้อยแล้ว`,
                type: "success",
            });
            await loadData();
        } catch (error) {
            console.error("Error updating status:", error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "อัปเดตสถานะไม่สำเร็จ",
                type: "error",
            });
        }
    };

    const openCloseModal = (plan: InstallmentPlan) => {
        setClosePlan(plan);
        setCloseAmount(String(plan.remainingAmount || 0));
        setCloseReason("manual_settlement");
        setCloseNote("");
    };

    const handleClosePlan = async () => {
        if (!closePlan?.id) return;
        const amount = Number(closeAmount || 0);
        if (amount < 0) {
            setAlertState({
                isOpen: true,
                title: "ข้อมูลไม่ถูกต้อง",
                message: "จำนวนเงินปิดยอดไม่ถูกต้อง",
                type: "warning",
            });
            return;
        }

        setSaving(true);
        try {
            await installmentService.close(closePlan.id, {
                amount,
                reason: closeReason,
                note: closeNote,
                periodMonth: currentMonth(),
            });
            setClosePlan(null);
            setAlertState({
                isOpen: true,
                title: "สำเร็จ",
                message: "ปิดจบรายการผ่อนสินค้าเรียบร้อยแล้ว",
                type: "success",
            });
            await loadData();
        } catch (error) {
            console.error("Error closing installment:", error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "ปิดจบรายการไม่สำเร็จ",
                type: "error",
            });
        } finally {
            setSaving(false);
        }
    };

    const getStatusLabel = (status: InstallmentPlan["status"]) => {
        switch (status) {
            case "active":
                return "กำลังผ่อน";
            case "paused":
                return "พักชำระ";
            case "paid_off":
                return "ผ่อนครบ";
            case "closed":
                return "ปิดจบ";
            case "cancelled":
                return "ยกเลิก";
            default:
                return status;
        }
    };

    const getStatusBadge = (status: InstallmentPlan["status"]) => {
        switch (status) {
            case "active":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-normal border bg-emerald-50 text-emerald-700 border-emerald-200/80 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        กำลังผ่อน
                    </span>
                );
            case "paused":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-normal border bg-amber-50 text-amber-800 border-amber-200/80 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        พักชำระ
                    </span>
                );
            case "paid_off":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-normal border bg-blue-50 text-blue-700 border-blue-200/80 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        ผ่อนครบ
                    </span>
                );
            case "closed":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-normal border bg-slate-100 text-slate-700 border-slate-200 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                        ปิดจบ
                    </span>
                );
            case "cancelled":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-normal border bg-rose-50 text-rose-700 border-rose-200/80 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        ยกเลิก
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal border bg-slate-50 text-slate-600 border-slate-200 whitespace-nowrap">
                        {status}
                    </span>
                );
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                            ผ่อนสินค้ากับบริษัท
                        </h1>
                        <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            Installments
                        </span>
                        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            ทั้งหมด {plans.length} สัญญา
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm font-normal text-slate-500 mt-1">
                        จัดการสัญญาผ่อน ตรวจสอบยอดคงเหลือ และหักเงินเดือนพนักงาน
                    </p>
                </div>
            </div>

            {/* Compact & Clean Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                {/* ยอดตั้งต้นทั้งหมด */}
                <div
                    onClick={() => setStatusFilter("all")}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        statusFilter === "all"
                            ? "border-slate-700 ring-2 ring-slate-100 bg-slate-50/50"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">ยอดตั้งต้นทั้งหมด</span>
                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">
                        ฿{money(summary.totalPrincipal)}
                    </div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">จาก {plans.length} สัญญา</div>
                </div>

                {/* ยอดคงเหลือ */}
                <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">ยอดคงเหลือรวม</span>
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">
                        ฿{money(summary.totalRemaining)}
                    </div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">รอชำระทั้งหมด</div>
                </div>

                {/* กำลังผ่อน */}
                <div
                    onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        statusFilter === "active"
                            ? "border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/20"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">กำลังผ่อน</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">
                        {summary.active}
                    </div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">รายการที่หักอยู่</div>
                </div>

                {/* ปิดจบ/ผ่อนครบ */}
                <div
                    onClick={() => setStatusFilter(statusFilter === "paid_off" ? "all" : "paid_off")}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs ${
                        statusFilter === "paid_off" || statusFilter === "closed"
                            ? "border-blue-500 ring-2 ring-blue-100 bg-blue-50/20"
                            : "border-slate-200/90 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">ปิดจบแล้ว</span>
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tabular-nums">
                        {summary.closed}
                    </div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">สิ้นสุดสัญญา</div>
                </div>
            </div>

            {/* Compact Toolbar (Search, Filter, & Add Button) */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-2.5 sm:p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Search Input */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อพนักงาน หรือ สินค้า..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="h-9 pl-8 pr-7 py-1 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 w-52 sm:w-64 transition-all"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-0.5"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                        className="h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                    >
                        <option value="all">ทุกสถานะ ({plans.length})</option>
                        <option value="active">กำลังผ่อน ({summary.active})</option>
                        <option value="paused">พักชำระ</option>
                        <option value="paid_off">ผ่อนครบ</option>
                        <option value="closed">ปิดจบ</option>
                        <option value="cancelled">ยกเลิก</option>
                    </select>
                </div>

                {/* Add Plan Button */}
                <div className="flex items-center gap-2 ml-auto">
                    <button
                        onClick={() => {
                            resetForm();
                            setShowCreateModal(true);
                        }}
                        className="h-9 inline-flex items-center gap-1.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-medium shadow-xs transition-all"
                    >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>สร้างรายการผ่อน</span>
                    </button>
                </div>
            </div>

            {/* Table Container */}
            {loading ? (
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-10 text-center text-slate-500 font-normal">
                    <div className="animate-spin w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                    กำลังโหลดข้อมูลรายการผ่อนสินค้า...
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50/80 border-b border-slate-200">
                                <tr>
                                    <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        พนักงาน
                                    </th>
                                    <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        สินค้า
                                    </th>
                                    <th className="px-3.5 py-2.5 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        ยอดรวม
                                    </th>
                                    <th className="px-3.5 py-2.5 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        ชำระแล้ว
                                    </th>
                                    <th className="px-3.5 py-2.5 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        คงเหลือ
                                    </th>
                                    <th className="px-3.5 py-2.5 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        งวด
                                    </th>
                                    <th className="px-3.5 py-2.5 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        สถานะ
                                    </th>
                                    <th className="px-3.5 py-2.5 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        จัดการ
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredPlans.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center text-slate-500 font-normal text-sm">
                                            {query || statusFilter !== "all"
                                                ? "ไม่พบรายการผ่อนที่ตรงกับเงื่อนไขการค้นหา"
                                                : "ยังไม่มีรายการผ่อนสินค้า"}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPlans.map((plan) => {
                                        const employee = employees.find(
                                            (e) => e.id === plan.employeeId || e.employeeId === plan.employeeCode
                                        );
                                        const progress =
                                            plan.principalAmount > 0
                                                ? Math.min(
                                                      100,
                                                      (Number(plan.paidAmount || 0) / Number(plan.principalAmount || 1)) * 100
                                                  )
                                                : 0;

                                        const closedDate = parseDate(plan.closedAt);

                                        return (
                                            <tr key={plan.id} className="hover:bg-slate-50/60 transition-colors group">
                                                {/* Employee */}
                                                <td className="px-3.5 py-2.5">
                                                    <div className="flex items-center gap-2.5">
                                                        {employee?.avatar ? (
                                                            <div className="relative w-7 h-7 shrink-0 rounded-full overflow-hidden ring-1 ring-slate-200">
                                                                <img
                                                                    src={employee.avatar}
                                                                    alt={plan.employeeName}
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => {
                                                                        e.currentTarget.style.display = "none";
                                                                        if (e.currentTarget.nextElementSibling) {
                                                                            (
                                                                                e.currentTarget.nextElementSibling as HTMLElement
                                                                            ).style.display = "flex";
                                                                        }
                                                                    }}
                                                                />
                                                                <div className="hidden w-full h-full bg-slate-100 items-center justify-center text-slate-700 font-medium text-xs">
                                                                    {plan.employeeName ? plan.employeeName.charAt(0) : "?"}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="w-7 h-7 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-medium text-xs ring-1 ring-slate-200">
                                                                {plan.employeeName ? plan.employeeName.charAt(0) : "?"}
                                                            </div>
                                                        )}
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-medium text-slate-800 leading-tight truncate">
                                                                {plan.employeeName}
                                                            </div>
                                                            <div className="text-[11px] font-normal text-slate-400 leading-tight">
                                                                {plan.employeeCode || plan.employeeId}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Item */}
                                                <td className="px-3.5 py-2.5 max-w-[200px]">
                                                    <div className="text-sm font-normal text-slate-800 leading-tight truncate">
                                                        {plan.itemName}
                                                    </div>
                                                    <div className="text-[11px] font-normal text-slate-400 leading-tight mt-0.5 truncate">
                                                        เริ่ม {plan.startMonth}
                                                        {closedDate ? ` • ปิด ${format(closedDate, "d MMM yy", { locale: th })}` : ""}
                                                    </div>
                                                    {plan.notes && (
                                                        <div className="text-[11px] font-normal text-slate-500 truncate" title={plan.notes}>
                                                            {plan.notes}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Principal Amount (Numbers normal font) */}
                                                <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                                                    <span className="text-sm font-normal text-slate-800 tabular-nums">
                                                        ฿{money(plan.principalAmount)}
                                                    </span>
                                                </td>

                                                {/* Paid Amount (Numbers normal font) */}
                                                <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                                                    <span className="text-sm font-normal text-emerald-700 tabular-nums">
                                                        ฿{money(plan.paidAmount)}
                                                    </span>
                                                </td>

                                                {/* Remaining Amount & Progress Bar (Numbers normal font) */}
                                                <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                                                    <div className="text-sm font-normal text-amber-800 tabular-nums">
                                                        ฿{money(plan.remainingAmount)}
                                                    </div>
                                                    <div className="mt-1 h-1 w-20 ml-auto rounded-full bg-slate-100 overflow-hidden">
                                                        <div
                                                            className="h-1 rounded-full bg-blue-500 transition-all"
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                </td>

                                                {/* Installments (Numbers normal font) */}
                                                <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                    <div className="text-xs font-normal text-slate-800 tabular-nums">
                                                        {plan.paidMonths || 0}/{plan.totalMonths || 0}
                                                    </div>
                                                    <div className="text-[11px] font-normal text-slate-400 tabular-nums mt-0.5">
                                                        ฿{money(plan.monthlyDeduction)}/ด.
                                                    </div>
                                                </td>

                                                {/* Status */}
                                                <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                    {getStatusBadge(plan.status)}
                                                </td>

                                                {/* Actions */}
                                                <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                                                    <div className="inline-flex items-center justify-end gap-1">
                                                        {(plan.status === "active" ||
                                                            plan.status === "paused" ||
                                                            plan.status === "paid_off") && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openEditModal(plan)}
                                                                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                title="แก้ไขรายการ"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        {plan.status === "active" && (
                                                            <button
                                                                type="button"
                                                                onClick={() => updateStatus(plan, "paused")}
                                                                className="p-1 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                                                title="พักชำระ"
                                                            >
                                                                <Pause className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        {plan.status === "paused" && (
                                                            <button
                                                                type="button"
                                                                onClick={() => updateStatus(plan, "active")}
                                                                className="p-1 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                                title="เปิดต่อ"
                                                            >
                                                                <Play className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        {(plan.status === "active" || plan.status === "paused") && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openCloseModal(plan)}
                                                                    className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                    title="ปิดจบยอด"
                                                                >
                                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateStatus(plan, "cancelled")}
                                                                    className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                                    title="ยกเลิกสัญญา"
                                                                >
                                                                    <XCircle className="w-3.5 h-3.5" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Table Footer */}
                    <div className="px-3.5 py-2.5 bg-slate-50/80 border-t border-slate-200 text-xs font-normal text-slate-500 flex flex-wrap items-center justify-between gap-2">
                        <span>
                            แสดงผล <span className="font-semibold text-slate-800">{filteredPlans.length}</span> จากทั้งหมด{" "}
                            <span className="font-semibold text-slate-800">{plans.length}</span> รายการ
                        </span>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                            <span className="text-emerald-700">กำลังผ่อน: {summary.active}</span>
                            <span>•</span>
                            <span className="text-blue-700">ปิดจบ/ผ่อนครบ: {summary.closed}</span>
                            <span>•</span>
                            <span className="text-amber-700 font-normal">ยอดคงเหลือรวม: ฿{money(summary.totalRemaining)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="bg-slate-50/80 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
                            <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                                สร้างรายการผ่อนสินค้าใหม่
                            </h2>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="p-1.5 hover:bg-slate-200/70 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="p-5 space-y-3.5">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        พนักงาน <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={form.employeeId}
                                        onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                        required
                                    >
                                        <option value="">เลือกพนักงาน</option>
                                        {employees.map((employee) => (
                                            <option key={employee.id} value={employee.id}>
                                                {employee.name} {employee.employeeId ? `(${employee.employeeId})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        สินค้า <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        value={form.itemName}
                                        onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                        placeholder="เช่น Notebook, โทรศัพท์"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        หมวดหมู่
                                    </label>
                                    <input
                                        value={form.itemCategory}
                                        onChange={(e) => setForm({ ...form, itemCategory: e.target.value })}
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                        placeholder="เช่น computer, mobile"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        เดือนเริ่มหัก
                                    </label>
                                    <input
                                        type="month"
                                        value={form.startMonth}
                                        onChange={(e) => setForm({ ...form, startMonth: e.target.value })}
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        ยอดรวม (บาท) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.principalAmount}
                                        onChange={(e) => setForm({ ...form, principalAmount: e.target.value })}
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-normal text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                        placeholder="0"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        หักต่อเดือน (บาท) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.monthlyDeduction}
                                        onChange={(e) => setForm({ ...form, monthlyDeduction: e.target.value })}
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-normal text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                        placeholder="0"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        จำนวนงวด
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={form.totalMonths || (calculatedMonths || "")}
                                        onChange={(e) => setForm({ ...form, totalMonths: e.target.value })}
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-normal text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                        placeholder="คำนวณอัตโนมัติ"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        หมายเหตุ
                                    </label>
                                    <input
                                        value={form.notes}
                                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                        placeholder="เลขเครื่อง หรือ เงื่อนไข"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200/80 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="h-9 px-3.5 text-xs sm:text-sm font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-medium shadow-xs transition-all disabled:opacity-50"
                                >
                                    {saving ? "กำลังบันทึก..." : "บันทึกรายการผ่อน"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editPlan && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="bg-slate-50/80 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
                            <div>
                                <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                                    แก้ไขรายการผ่อน
                                </h2>
                                <p className="text-xs font-normal text-slate-500 mt-0.5">{editPlan.employeeName}</p>
                            </div>
                            <button
                                onClick={() => setEditPlan(null)}
                                className="p-1.5 hover:bg-slate-200/70 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-3.5">
                            {/* Numbers normal font in summary bar */}
                            <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 text-center">
                                <div>
                                    <div className="text-[11px] font-normal text-slate-500">ชำระแล้ว</div>
                                    <div className="text-sm font-normal text-emerald-700 tabular-nums mt-0.5">
                                        ฿{money(editPlan.paidAmount)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[11px] font-normal text-slate-500">คงเหลือเดิม</div>
                                    <div className="text-sm font-normal text-amber-800 tabular-nums mt-0.5">
                                        ฿{money(editPlan.remainingAmount)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[11px] font-normal text-slate-500">คงเหลือใหม่</div>
                                    <div className="text-sm font-normal text-blue-700 tabular-nums mt-0.5">
                                        ฿{money(
                                            Math.max(
                                                0,
                                                Number(editForm.principalAmount || 0) - Number(editPlan.paidAmount || 0)
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        สินค้า
                                    </label>
                                    <input
                                        value={editForm.itemName}
                                        onChange={(e) => setEditForm({ ...editForm, itemName: e.target.value })}
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        หมวดหมู่
                                    </label>
                                    <input
                                        value={editForm.itemCategory}
                                        onChange={(e) => setEditForm({ ...editForm, itemCategory: e.target.value })}
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        ยอดรวมใหม่
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editForm.principalAmount}
                                        onChange={(e) =>
                                            setEditForm({ ...editForm, principalAmount: e.target.value })
                                        }
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-normal text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        หักต่อเดือน
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editForm.monthlyDeduction}
                                        onChange={(e) =>
                                            setEditForm({ ...editForm, monthlyDeduction: e.target.value })
                                        }
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-normal text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        จำนวนงวด
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={editForm.totalMonths}
                                        onChange={(e) => setEditForm({ ...editForm, totalMonths: e.target.value })}
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-normal text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        เดือนเริ่มหัก
                                    </label>
                                    <input
                                        type="month"
                                        value={editForm.startMonth}
                                        onChange={(e) => setEditForm({ ...editForm, startMonth: e.target.value })}
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        หมายเหตุ
                                    </label>
                                    <input
                                        value={editForm.notes}
                                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200/80 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setEditPlan(null)}
                                    className="h-9 px-3.5 text-xs sm:text-sm font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="button"
                                    onClick={handleUpdatePlan}
                                    disabled={saving}
                                    className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-medium shadow-xs transition-all disabled:opacity-50"
                                >
                                    {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Close Modal */}
            {closePlan && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="bg-slate-50/80 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
                            <div>
                                <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                                    ปิดจบรายการผ่อน
                                </h2>
                                <p className="text-xs font-normal text-slate-500 mt-0.5">
                                    {closePlan.employeeName} • {closePlan.itemName}
                                </p>
                            </div>
                            <button
                                onClick={() => setClosePlan(null)}
                                className="p-1.5 hover:bg-slate-200/70 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-3.5">
                            <div className="rounded-lg bg-amber-50/80 border border-amber-200/70 p-2.5 text-xs font-normal text-amber-800 flex items-center justify-between">
                                <span>ยอดคงเหลือปัจจุบัน:</span>
                                <span className="font-normal tabular-nums text-sm text-amber-900">
                                    ฿{money(closePlan.remainingAmount)}
                                </span>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    จำนวนเงินปิดยอด (บาท)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={closeAmount}
                                    onChange={(e) => setCloseAmount(e.target.value)}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-normal text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    วิธีปิดยอด
                                </label>
                                <select
                                    value={closeReason}
                                    onChange={(e) => setCloseReason(e.target.value)}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                >
                                    <option value="manual_settlement">พนักงานชำระเอง</option>
                                    <option value="payroll_final_deduction">หักในเงินเดือนงวดสุดท้าย</option>
                                    <option value="waive">บริษัทออกให้ / ยกหนี้</option>
                                    <option value="other">อื่นๆ</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    หมายเหตุ
                                </label>
                                <input
                                    value={closeNote}
                                    onChange={(e) => setCloseNote(e.target.value)}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                    placeholder="เช่น โอนปิดยอดแล้ว / บริษัทออกให้"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200/80 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setClosePlan(null)}
                                    className="h-9 px-3.5 text-xs sm:text-sm font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="button"
                                    onClick={handleClosePlan}
                                    disabled={saving}
                                    className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-medium shadow-xs transition-all disabled:opacity-50"
                                >
                                    {saving ? "กำลังบันทึก..." : "ยืนยันปิดจบ"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <CustomAlert
                isOpen={alertState.isOpen}
                onClose={() => setAlertState((prev) => ({ ...prev, isOpen: false }))}
                title={alertState.title}
                message={alertState.message}
                type={alertState.type}
            />
        </div>
    );
}
