"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { employeeService, installmentService, type Employee, type InstallmentPlan } from "@/lib/firestore";
import { CheckCircle2, CircleDollarSign, Pause, Pencil, Play, Plus, Search, XCircle } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";

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

const getStatusClass = (status: InstallmentPlan["status"]) => {
    switch (status) {
        case "active":
            return "border-emerald-100 bg-emerald-50 text-emerald-700";
        case "paused":
            return "border-amber-100 bg-amber-50 text-amber-700";
        case "paid_off":
        case "closed":
            return "border-blue-100 bg-blue-50 text-blue-700";
        case "cancelled":
            return "border-red-100 bg-red-50 text-red-700";
        default:
            return "border-gray-100 bg-gray-50 text-gray-700";
    }
};

export default function InstallmentsPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [plans, setPlans] = useState<InstallmentPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | InstallmentPlan["status"]>("all");
    const [closePlan, setClosePlan] = useState<InstallmentPlan | null>(null);
    const [closeAmount, setCloseAmount] = useState("");
    const [closeReason, setCloseReason] = useState("manual_settlement");
    const [closeNote, setCloseNote] = useState("");
    const [editPlan, setEditPlan] = useState<InstallmentPlan | null>(null);
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
            setEmployees(employeeData.filter(employee => employee.status === "ทำงาน"));
            setPlans(planData);
        } catch (error) {
            console.error("Error loading installments:", error);
            alert("โหลดข้อมูลผ่อนสินค้าไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const selectedEmployee = employees.find(employee => employee.id === form.employeeId);
    const principal = Number(form.principalAmount || 0);
    const monthlyDeduction = Number(form.monthlyDeduction || 0);
    const calculatedMonths = principal > 0 && monthlyDeduction > 0 ? Math.ceil(principal / monthlyDeduction) : 0;

    const filteredPlans = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return plans.filter(plan => {
            const matchesStatus = statusFilter === "all" || plan.status === statusFilter;
            const matchesQuery = !normalizedQuery ||
                plan.employeeName.toLowerCase().includes(normalizedQuery) ||
                plan.itemName.toLowerCase().includes(normalizedQuery) ||
                (plan.employeeCode || "").toLowerCase().includes(normalizedQuery);
            return matchesStatus && matchesQuery;
        });
    }, [plans, query, statusFilter]);

    const summary = useMemo(() => {
        return plans.reduce((acc, plan) => {
            acc.totalPrincipal += Number(plan.principalAmount || 0);
            acc.totalRemaining += Number(plan.remainingAmount || 0);
            if (plan.status === "active") acc.active += 1;
            if (plan.status === "closed" || plan.status === "paid_off") acc.closed += 1;
            return acc;
        }, { totalPrincipal: 0, totalRemaining: 0, active: 0, closed: 0 });
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
            alert("กรุณาเลือกพนักงาน");
            return;
        }
        if (!form.itemName.trim() || principal <= 0 || monthlyDeduction <= 0) {
            alert("กรุณากรอกสินค้า ยอดรวม และยอดหักต่อเดือนให้ถูกต้อง");
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
            await loadData();
        } catch (error) {
            console.error("Error creating installment:", error);
            alert("สร้างรายการผ่อนไม่สำเร็จ");
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

        if (!editForm.itemName.trim() || nextPrincipal <= 0 || nextMonthlyDeduction <= 0 || nextTotalMonths <= 0) {
            alert("กรุณากรอกสินค้า ยอดรวม ยอดหักต่อเดือน และจำนวนงวดให้ถูกต้อง");
            return;
        }

        if (nextPrincipal < paidAmount) {
            const confirmed = window.confirm(
                `ยอดรวมใหม่ต่ำกว่ายอดที่จ่ายแล้ว ฿${money(paidAmount)} ระบบจะตั้งยอดคงเหลือเป็น 0 และเปลี่ยนเป็นผ่อนครบ ต้องการดำเนินการต่อไหม?`
            );
            if (!confirmed) return;
        }

        const remainingAmount = Math.max(0, nextPrincipal - paidAmount);
        const nextStatus = remainingAmount <= 0 && (editPlan.status === "active" || editPlan.status === "paused")
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
            await loadData();
        } catch (error) {
            console.error("Error updating installment:", error);
            alert("แก้ไขรายการผ่อนไม่สำเร็จ");
        } finally {
            setSaving(false);
        }
    };

    const updateStatus = async (plan: InstallmentPlan, status: InstallmentPlan["status"]) => {
        if (!plan.id) return;
        const confirmed = status === "cancelled"
            ? window.confirm(`ต้องการยกเลิกรายการผ่อน "${plan.itemName}" ใช่ไหม?`)
            : true;
        if (!confirmed) return;

        await installmentService.update(plan.id, { status });
        await loadData();
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
            alert("จำนวนเงินปิดยอดไม่ถูกต้อง");
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
            await loadData();
        } catch (error) {
            console.error("Error closing installment:", error);
            alert("ปิดจบรายการไม่สำเร็จ");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="ผ่อนสินค้ากับบริษัท"
                subtitle="จัดการสัญญาผ่อน ตรวจยอดคงเหลือ และปิดจบรายการหักเงินเดือน"
            />

            <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="text-xs font-medium text-gray-500">ยอดตั้งต้นทั้งหมด</div>
                    <div className="mt-2 text-xl font-bold text-gray-900">฿{money(summary.totalPrincipal)}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="text-xs font-medium text-gray-500">ยอดคงเหลือ</div>
                    <div className="mt-2 text-xl font-bold text-amber-700">฿{money(summary.totalRemaining)}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="text-xs font-medium text-gray-500">กำลังผ่อน</div>
                    <div className="mt-2 text-xl font-bold text-emerald-700">{summary.active} รายการ</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="text-xs font-medium text-gray-500">ปิดจบแล้ว</div>
                    <div className="mt-2 text-xl font-bold text-blue-700">{summary.closed} รายการ</div>
                </div>
            </div>

            <form onSubmit={handleCreate} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                    <Plus className="h-5 w-5 text-blue-600" />
                    <h2 className="text-base font-semibold text-gray-900">สร้างรายการผ่อน</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="space-y-1">
                        <span className="text-xs font-medium text-gray-500">พนักงาน</span>
                        <select
                            value={form.employeeId}
                            onChange={(event) => setForm({ ...form, employeeId: event.target.value })}
                            className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        >
                            <option value="">เลือกพนักงาน</option>
                            {employees.map(employee => (
                                <option key={employee.id} value={employee.id}>
                                    {employee.name} {employee.employeeId ? `(${employee.employeeId})` : ""}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-medium text-gray-500">สินค้า</span>
                        <input
                            value={form.itemName}
                            onChange={(event) => setForm({ ...form, itemName: event.target.value })}
                            className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                            placeholder="เช่น Computer, Notebook"
                        />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-medium text-gray-500">หมวดหมู่</span>
                        <input
                            value={form.itemCategory}
                            onChange={(event) => setForm({ ...form, itemCategory: event.target.value })}
                            className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                            placeholder="computer"
                        />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-medium text-gray-500">เดือนเริ่มหัก</span>
                        <input
                            type="month"
                            value={form.startMonth}
                            onChange={(event) => setForm({ ...form, startMonth: event.target.value })}
                            className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-medium text-gray-500">ยอดรวม</span>
                        <input
                            type="number"
                            min="0"
                            value={form.principalAmount}
                            onChange={(event) => setForm({ ...form, principalAmount: event.target.value })}
                            className="h-10 w-full rounded-md border border-gray-200 px-3 text-right text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200"
                            placeholder="0"
                        />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-medium text-gray-500">หักต่อเดือน</span>
                        <input
                            type="number"
                            min="0"
                            value={form.monthlyDeduction}
                            onChange={(event) => setForm({ ...form, monthlyDeduction: event.target.value })}
                            className="h-10 w-full rounded-md border border-gray-200 px-3 text-right text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200"
                            placeholder="0"
                        />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-medium text-gray-500">จำนวนงวด</span>
                        <input
                            type="number"
                            min="1"
                            value={form.totalMonths || (calculatedMonths || "")}
                            onChange={(event) => setForm({ ...form, totalMonths: event.target.value })}
                            className="h-10 w-full rounded-md border border-gray-200 px-3 text-right text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200"
                            placeholder="คำนวณอัตโนมัติ"
                        />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-medium text-gray-500">หมายเหตุ</span>
                        <input
                            value={form.notes}
                            onChange={(event) => setForm({ ...form, notes: event.target.value })}
                            className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                            placeholder="เลขเครื่อง/เงื่อนไข"
                        />
                    </label>
                </div>
                <div className="mt-4 flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        <CircleDollarSign className="h-4 w-4" />
                        บันทึกรายการผ่อน
                    </button>
                </div>
            </form>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-gray-100 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="relative w-full md:max-w-sm">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            className="h-10 w-full rounded-md border border-gray-200 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                            placeholder="ค้นหาพนักงานหรือสินค้า"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                        className="h-10 rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                        <option value="all">ทุกสถานะ</option>
                        <option value="active">กำลังผ่อน</option>
                        <option value="paused">พักชำระ</option>
                        <option value="paid_off">ผ่อนครบ</option>
                        <option value="closed">ปิดจบ</option>
                        <option value="cancelled">ยกเลิก</option>
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1000px]">
                        <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                            <tr>
                                <th className="px-4 py-3 text-left">พนักงาน</th>
                                <th className="px-4 py-3 text-left">สินค้า</th>
                                <th className="px-4 py-3 text-right">ยอดรวม</th>
                                <th className="px-4 py-3 text-right">จ่ายแล้ว</th>
                                <th className="px-4 py-3 text-right">คงเหลือ</th>
                                <th className="px-4 py-3 text-center">งวด</th>
                                <th className="px-4 py-3 text-center">สถานะ</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-500">กำลังโหลดข้อมูล...</td>
                                </tr>
                            ) : filteredPlans.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">ยังไม่มีรายการผ่อนสินค้า</td>
                                </tr>
                            ) : filteredPlans.map(plan => {
                                const progress = plan.principalAmount > 0
                                    ? Math.min(100, (Number(plan.paidAmount || 0) / Number(plan.principalAmount || 1)) * 100)
                                    : 0;
                                return (
                                    <tr key={plan.id} className="hover:bg-gray-50/70">
                                        <td className="px-4 py-4">
                                            <div className="font-medium text-gray-900">{plan.employeeName}</div>
                                            <div className="text-xs text-gray-400">{plan.employeeCode || plan.employeeId}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="font-medium text-gray-800">{plan.itemName}</div>
                                            <div className="text-xs text-gray-400">
                                                เริ่ม {plan.startMonth} {plan.closedAt ? `| ปิด ${format(plan.closedAt, "d MMM yyyy", { locale: th })}` : ""}
                                            </div>
                                            {plan.notes && <div className="mt-1 text-xs text-gray-500">{plan.notes}</div>}
                                        </td>
                                        <td className="px-4 py-4 text-right font-mono">฿{money(plan.principalAmount)}</td>
                                        <td className="px-4 py-4 text-right font-mono text-emerald-700">฿{money(plan.paidAmount)}</td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="font-mono font-semibold text-amber-700">฿{money(plan.remainingAmount)}</div>
                                            <div className="mt-1 h-1.5 rounded-full bg-gray-100">
                                                <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${progress}%` }} />
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center text-sm">
                                            <div className="font-mono">{plan.paidMonths || 0}/{plan.totalMonths || 0}</div>
                                            <div className="text-xs text-gray-400">เดือนละ ฿{money(plan.monthlyDeduction)}</div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClass(plan.status)}`}>
                                                {getStatusLabel(plan.status)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex justify-end gap-2">
                                                {(plan.status === "active" || plan.status === "paused" || plan.status === "paid_off") && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditModal(plan)}
                                                        className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-200 px-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                        แก้ไข
                                                    </button>
                                                )}
                                                {plan.status === "active" && (
                                                    <button
                                                        type="button"
                                                        onClick={() => updateStatus(plan, "paused")}
                                                        className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-200 px-2 text-xs font-medium text-amber-700 hover:bg-amber-50"
                                                    >
                                                        <Pause className="h-3.5 w-3.5" />
                                                        พัก
                                                    </button>
                                                )}
                                                {plan.status === "paused" && (
                                                    <button
                                                        type="button"
                                                        onClick={() => updateStatus(plan, "active")}
                                                        className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-200 px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                                                    >
                                                        <Play className="h-3.5 w-3.5" />
                                                        เปิดต่อ
                                                    </button>
                                                )}
                                                {(plan.status === "active" || plan.status === "paused") && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => openCloseModal(plan)}
                                                            className="inline-flex h-8 items-center gap-1 rounded-md border border-blue-200 px-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
                                                        >
                                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                                            ปิดจบ
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => updateStatus(plan, "cancelled")}
                                                            className="inline-flex h-8 items-center gap-1 rounded-md border border-red-200 px-2 text-xs font-medium text-red-700 hover:bg-red-50"
                                                        >
                                                            <XCircle className="h-3.5 w-3.5" />
                                                            ยกเลิก
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {editPlan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">แก้ไขรายการผ่อน</h2>
                                <p className="mt-1 text-sm text-gray-500">{editPlan.employeeName}</p>
                            </div>
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClass(editPlan.status)}`}>
                                {getStatusLabel(editPlan.status)}
                            </span>
                        </div>

                        <div className="mt-4 grid gap-3 rounded-lg bg-gray-50 p-3 text-sm md:grid-cols-3">
                            <div>
                                <div className="text-xs text-gray-500">ยอดจ่ายแล้ว</div>
                                <div className="mt-1 font-mono font-semibold text-emerald-700">฿{money(editPlan.paidAmount)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">ยอดคงเหลือเดิม</div>
                                <div className="mt-1 font-mono font-semibold text-amber-700">฿{money(editPlan.remainingAmount)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">ยอดคงเหลือใหม่</div>
                                <div className="mt-1 font-mono font-semibold text-blue-700">
                                    ฿{money(Math.max(0, Number(editForm.principalAmount || 0) - Number(editPlan.paidAmount || 0)))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <label className="space-y-1">
                                <span className="text-xs font-medium text-gray-500">สินค้า</span>
                                <input
                                    value={editForm.itemName}
                                    onChange={(event) => setEditForm({ ...editForm, itemName: event.target.value })}
                                    className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-medium text-gray-500">หมวดหมู่</span>
                                <input
                                    value={editForm.itemCategory}
                                    onChange={(event) => setEditForm({ ...editForm, itemCategory: event.target.value })}
                                    className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-medium text-gray-500">ยอดรวมใหม่</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={editForm.principalAmount}
                                    onChange={(event) => setEditForm({ ...editForm, principalAmount: event.target.value })}
                                    className="h-10 w-full rounded-md border border-gray-200 px-3 text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-medium text-gray-500">หักต่อเดือน</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={editForm.monthlyDeduction}
                                    onChange={(event) => setEditForm({ ...editForm, monthlyDeduction: event.target.value })}
                                    className="h-10 w-full rounded-md border border-gray-200 px-3 text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-medium text-gray-500">จำนวนงวด</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={editForm.totalMonths}
                                    onChange={(event) => setEditForm({ ...editForm, totalMonths: event.target.value })}
                                    className="h-10 w-full rounded-md border border-gray-200 px-3 text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-medium text-gray-500">เดือนเริ่มหัก</span>
                                <input
                                    type="month"
                                    value={editForm.startMonth}
                                    onChange={(event) => setEditForm({ ...editForm, startMonth: event.target.value })}
                                    className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </label>
                            <label className="space-y-1 md:col-span-2">
                                <span className="text-xs font-medium text-gray-500">หมายเหตุ</span>
                                <textarea
                                    value={editForm.notes}
                                    onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })}
                                    className="min-h-20 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </label>
                        </div>

                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setEditPlan(null)}
                                className="h-10 rounded-md border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={handleUpdatePlan}
                                disabled={saving}
                                className="h-10 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                                บันทึกการแก้ไข
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {closePlan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
                        <h2 className="text-lg font-semibold text-gray-900">ปิดจบรายการผ่อน</h2>
                        <p className="mt-1 text-sm text-gray-500">{closePlan.employeeName} - {closePlan.itemName}</p>
                        <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                            ยอดคงเหลือปัจจุบัน ฿{money(closePlan.remainingAmount)}
                        </div>
                        <div className="mt-4 space-y-3">
                            <label className="block space-y-1">
                                <span className="text-xs font-medium text-gray-500">จำนวนที่ปิดยอด</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={closeAmount}
                                    onChange={(event) => setCloseAmount(event.target.value)}
                                    className="h-10 w-full rounded-md border border-gray-200 px-3 text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium text-gray-500">วิธีปิดยอด</span>
                                <select
                                    value={closeReason}
                                    onChange={(event) => setCloseReason(event.target.value)}
                                    className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                                >
                                    <option value="manual_settlement">พนักงานชำระเอง</option>
                                    <option value="payroll_final_deduction">หักในเงินเดือนงวดสุดท้าย</option>
                                    <option value="waive">บริษัทออกให้ / ยกหนี้</option>
                                    <option value="other">อื่นๆ</option>
                                </select>
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium text-gray-500">หมายเหตุ</span>
                                <textarea
                                    value={closeNote}
                                    onChange={(event) => setCloseNote(event.target.value)}
                                    className="min-h-20 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    placeholder="เช่น โอนปิดยอดแล้ว / บริษัท waive"
                                />
                            </label>
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setClosePlan(null)}
                                className="h-10 rounded-md border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={handleClosePlan}
                                disabled={saving}
                                className="h-10 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                                ยืนยันปิดจบ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
