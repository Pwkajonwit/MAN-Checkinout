"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
    Save, Clock, AlertCircle, CheckCircle2, DollarSign, HardDrive,
    Calendar, Plus, Trash2, MapPin, Crosshair, Database, ExternalLink,
    RefreshCw, Copy, FileJson, Briefcase, ArrowLeftRight, Users,
    Bell, Shield, Image as ImageIcon, Settings, UserPlus, FileText
} from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { WORK_TIME_CONFIG } from "@/lib/workTime";
import { systemConfigService, type SystemConfig, type WorkLocation, employeeService } from "@/lib/firestore";
import { getStorageUsage, deleteOldPhotos, type StorageStats, PHOTO_STORAGE_LIMIT } from "@/lib/storage";
import { checkAllIndexes, type IndexCheckResult } from "@/lib/indexChecker";
import { CustomAlert } from "@/components/ui/custom-alert";

function createWorkLocation(index: number): WorkLocation {
    return {
        id: `loc_${Date.now()}_${index}`,
        name: `จุดเช็กอิน ${index}`,
        latitude: 0,
        longitude: 0,
        radius: 100,
    };
}

export default function SettingsPage() {
    const [settings, setSettings] = useState<SystemConfig>({
        checkInHour: WORK_TIME_CONFIG.standardCheckIn.hour,
        checkInMinute: WORK_TIME_CONFIG.standardCheckIn.minute,
        checkOutHour: WORK_TIME_CONFIG.standardCheckOut.hour,
        checkOutMinute: WORK_TIME_CONFIG.standardCheckOut.minute,
        lateGracePeriod: WORK_TIME_CONFIG.lateGracePeriod,
        minOTMinutes: WORK_TIME_CONFIG.minOTMinutes,
        otMultiplier: 1.5,
        otMultiplierHoliday: 3.0,
        weeklyHolidays: [0, 6], // Sun, Sat
        useIndividualHolidays: false, // Use global holidays by default
        lateDeductionType: "pro-rated",
        lateDeductionRate: 0,
        requirePhoto: true,
        adminLineGroupId: "",
        enableDailyReport: false,
        enableLineCheckInNotification: false,
        lineCheckInGroupId: "",
        enableTelegramCheckInNotification: false,
        telegramChatId: "",
        customHolidays: [],
        allowNewRegistration: true,
        workTimeEnabled: true, // Enable work time tracking by default
        locationEnabled: false,
        workLocations: [createWorkLocation(1)],
        locationConfig: {
            enabled: false,
            latitude: 0,
            longitude: 0,
            radius: 100
        },
        swapAdvanceDays: 3,
        storageType: "base64",
        enableBreak: true,
        enableOffsite: true
    });

    const [newHoliday, setNewHoliday] = useState({
        date: new Date().toLocaleDateString('en-CA'),
        name: "",
        workdayMultiplier: 2.0,
        otMultiplier: 3.0
    });

    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [storageUsage, setStorageUsage] = useState<StorageStats | null>(null);
    const [loadingStorage, setLoadingStorage] = useState(false);
    const [cleanupLoading, setCleanupLoading] = useState(false);
    const [gettingLocationId, setGettingLocationId] = useState<string | null>(null);
    const [updatingAllHolidays, setUpdatingAllHolidays] = useState(false);

    // Index Checker State
    const [indexResults, setIndexResults] = useState<IndexCheckResult[]>([]);
    const [checkingIndexes, setCheckingIndexes] = useState(false);
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
    const [showIndexModal, setShowIndexModal] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    const [departments, setDepartments] = useState<string[]>([]);
    const [positions, setPositions] = useState<string[]>([]);
    const [loadingDepartments, setLoadingDepartments] = useState(true);

    // Bulk Department Config State
    const [selectedDepartmentsBulk, setSelectedDepartmentsBulk] = useState<string[]>([]);
    const [bulkTimeConfig, setBulkTimeConfig] = useState({
        checkInHour: 9,
        checkInMinute: 0,
        checkOutHour: 18,
        checkOutMinute: 0
    });

    useEffect(() => {
        const loadEmployeeData = async () => {
            try {
                const employees = await employeeService.getAll();

                // Departments
                const uniqueDepts = Array.from(new Set(employees.map(e => e.department).filter(Boolean))) as string[];
                setDepartments(uniqueDepts.sort());

                // Positions
                const uniquePositions = Array.from(new Set(employees.map(e => e.position).filter(Boolean))) as string[];
                setPositions(uniquePositions.sort());

            } catch (error) {
                console.error("Error loading employee data:", error);
            } finally {
                setLoadingDepartments(false);
            }
        };
        loadEmployeeData();
    }, []);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const config = await systemConfigService.get();
                if (config) {
                    setSettings({
                        checkInHour: config.checkInHour ?? WORK_TIME_CONFIG.standardCheckIn.hour,
                        checkInMinute: config.checkInMinute ?? WORK_TIME_CONFIG.standardCheckIn.minute,
                        checkOutHour: config.checkOutHour ?? WORK_TIME_CONFIG.standardCheckOut.hour,
                        checkOutMinute: config.checkOutMinute ?? WORK_TIME_CONFIG.standardCheckOut.minute,
                        lateGracePeriod: config.lateGracePeriod ?? WORK_TIME_CONFIG.lateGracePeriod,
                        minOTMinutes: config.minOTMinutes ?? WORK_TIME_CONFIG.minOTMinutes,
                        otMultiplier: config.otMultiplier ?? 1.5,
                        otMultiplierHoliday: config.otMultiplierHoliday ?? 3.0,
                        weeklyHolidays: config.weeklyHolidays ?? [0, 6],
                        useIndividualHolidays: config.useIndividualHolidays ?? false,
                        lateDeductionType: config.lateDeductionType ?? "pro-rated",
                        lateDeductionRate: config.lateDeductionRate ?? 0,
                        requirePhoto: config.requirePhoto ?? true,
                        adminLineGroupId: config.adminLineGroupId ?? "",
                        enableDailyReport: config.enableDailyReport ?? false,
                        enableLineCheckInNotification: config.enableLineCheckInNotification ?? false,
                        lineCheckInGroupId: config.lineCheckInGroupId ?? "",
                        enableTelegramCheckInNotification: config.enableTelegramCheckInNotification ?? false,
                        telegramChatId: config.telegramChatId ?? "",
                        customHolidays: config.customHolidays ?? [],
                        allowNewRegistration: config.allowNewRegistration ?? true,
                        workTimeEnabled: config.workTimeEnabled ?? true,
                        locationEnabled: config.locationEnabled ?? false,
                        workLocations: (config.workLocations && config.workLocations.length > 0)
                            ? config.workLocations
                            : [createWorkLocation(1)],
                        locationConfig: config.locationConfig ?? {
                            enabled: false,
                            latitude: 0,
                            longitude: 0,
                            radius: 100
                        },
                        swapAdvanceDays: config.swapAdvanceDays ?? 3,
                        storageType: config.storageType ?? "base64",
                        enableBreak: config.enableBreak ?? true,
                        enableOffsite: config.enableOffsite ?? true
                    });
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            } finally {
                setInitialLoading(false);
            }
        };

        fetchSettings();
    }, []);

    // Storage loading is now lazy (on-demand) to improve page load performance
    const loadStorageUsage = async () => {
        setLoadingStorage(true);
        try {
            const usage = await getStorageUsage();
            setStorageUsage(usage);
        } catch (error) {
            console.error("Error loading storage:", error);
        } finally {
            setLoadingStorage(false);
        }
    };

    const handleAddHoliday = () => {
        if (!newHoliday.name) return;

        // Parse date details explicitly to create a Date in local time, avoiding UTC shift
        const [y, m, d] = newHoliday.date.split('-').map(Number);
        const holidayDate = new Date(y, m - 1, d);
        const holidays = [...(settings.customHolidays || [])];
        holidays.push({
            date: holidayDate,
            name: newHoliday.name,
            workdayMultiplier: newHoliday.workdayMultiplier,
            otMultiplier: newHoliday.otMultiplier
        });

        // Sort by date
        holidays.sort((a, b) => a.date.getTime() - b.date.getTime());

        setSettings({ ...settings, customHolidays: holidays });
        setNewHoliday({
            date: new Date().toLocaleDateString('en-CA'),
            name: "",
            workdayMultiplier: 2.0,
            otMultiplier: 3.0
        });
    };

    const handleRemoveHoliday = (index: number) => {
        const holidays = [...(settings.customHolidays || [])];
        holidays.splice(index, 1);
        setSettings({ ...settings, customHolidays: holidays });
    };

    const handleCleanup = async (months: number) => {
        if (!confirm(`คุณต้องการลบรูปภาพที่เก่ากว่า ${months} เดือนใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`)) return;

        setCleanupLoading(true);
        try {
            const result = await deleteOldPhotos(months);
            setAlertState({
                isOpen: true,
                title: "สำเร็จ",
                message: `ลบรูปภาพเรียบร้อยแล้ว ${result.deletedCount} รูป (${(result.freedBytes / (1024 * 1024)).toFixed(2)} MB)`,
                type: "success"
            });

            // Refresh storage usage
            const usage = await getStorageUsage();
            setStorageUsage(usage);
        } catch (error) {
            console.error("Error cleaning up:", error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เกิดข้อผิดพลาดในการลบรูปภาพ",
                type: "error"
            });
        } finally {
            setCleanupLoading(false);
        }
    };

    const handleAddWorkLocation = () => {
        setSettings(prev => ({
            ...prev,
            workLocations: [...(prev.workLocations || []), createWorkLocation((prev.workLocations?.length || 0) + 1)]
        }));
    };

    const handleRemoveWorkLocation = (locationId: string) => {
        setSettings(prev => {
            const nextLocations = (prev.workLocations || []).filter(location => location.id !== locationId);
            return {
                ...prev,
                workLocations: nextLocations.length > 0 ? nextLocations : [createWorkLocation(1)]
            };
        });
    };

    const handleLocationFieldChange = (locationId: string, field: keyof WorkLocation, value: string | number) => {
        setSettings(prev => ({
            ...prev,
            workLocations: (prev.workLocations || []).map(location =>
                location.id === locationId ? { ...location, [field]: value } : location
            )
        }));
    };

    const handleGetCurrentLocation = (locationId: string) => {
        setGettingLocationId(locationId);
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setSettings(prev => ({
                        ...prev,
                        workLocations: (prev.workLocations || []).map(location =>
                            location.id === locationId
                                ? {
                                    ...location,
                                    latitude: position.coords.latitude,
                                    longitude: position.coords.longitude
                                }
                                : location
                        )
                    }));
                    setGettingLocationId(null);
                },
                (error) => {
                    console.error("Error getting location:", error);
                    setAlertState({
                        isOpen: true,
                        title: "ผิดพลาด",
                        message: "ไม่สามารถดึงตำแหน่งปัจจุบันได้ กรุณาตรวจสอบการอนุญาตเข้าถึงตำแหน่ง",
                        type: "error"
                    });
                    setGettingLocationId(null);
                },
                { enableHighAccuracy: true }
            );
        } else {
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง",
                type: "error"
            });
            setGettingLocationId(null);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await systemConfigService.update(settings);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error("Error saving settings:", error);
            setAlertState({
                isOpen: true,
                title: "ผิดพลาด",
                message: "เกิดข้อผิดพลาดในการบันทึกการตั้งค่า",
                type: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setShowResetConfirm(true);
    };

    const confirmReset = () => {
        setSettings({
            checkInHour: 9,
            checkInMinute: 0,
            checkOutHour: 18,
            checkOutMinute: 0,
            lateGracePeriod: 0,
            minOTMinutes: 30,
            otMultiplier: 1.5,
            otMultiplierHoliday: 3.0,
            weeklyHolidays: [0, 6],
            useIndividualHolidays: false,
            lateDeductionType: "pro-rated",
            lateDeductionRate: 0,
            requirePhoto: true,
            adminLineGroupId: "",
            enableDailyReport: false,
            enableLineCheckInNotification: false,
            lineCheckInGroupId: "",
            enableTelegramCheckInNotification: false,
            telegramChatId: "",
            customHolidays: [],
            allowNewRegistration: true,
            workTimeEnabled: true,
            locationEnabled: false,
            workLocations: [createWorkLocation(1)],
            locationConfig: {
                enabled: false,
                latitude: 0,
                longitude: 0,
                radius: 100
            },
            swapAdvanceDays: 3
        });
        setShowResetConfirm(false);
    };

    if (initialLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 font-medium">กำลังโหลดการตั้งค่าระบบ...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-24">
            <PageHeader
                title="ตั้งค่าระบบ"
                subtitle="กำหนดนโยบายการเข้างาน การคำนวณเงินเดือน และการเชื่อมต่อ"
            />

            <div className="relative z-10 space-y-4">

                {/* Success Notification */}
                {saved && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 px-4 flex items-center gap-3 shadow-xs animate-fade-in">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                            <h4 className="text-emerald-900 font-semibold text-xs sm:text-sm">บันทึกเรียบร้อย</h4>
                            <p className="text-emerald-700 text-xs font-normal mt-0.5">การตั้งค่าระบบได้รับการอัปเดตแล้ว</p>
                        </div>
                    </div>
                )}

                {/* 1. General Registration */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-blue-100/80 text-blue-700 flex items-center justify-center shrink-0">
                                <UserPlus className="w-4 h-4" />
                            </div>
                            <div>
                                <h2 className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight">การลงทะเบียนพนักงาน</h2>
                                <p className="text-[11px] text-slate-500 font-normal">จัดการสิทธิ์การเข้าใช้งานระบบสำหรับพนักงานใหม่</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSettings({ ...settings, allowNewRegistration: !settings.allowNewRegistration })}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-hidden ${settings.allowNewRegistration ? 'bg-slate-900' : 'bg-slate-300'}`}
                        >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${settings.allowNewRegistration ? 'translate-x-4.5' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    {settings.allowNewRegistration ? (
                        <div className="px-4 py-2 bg-emerald-50/40 flex items-center gap-2 text-xs text-emerald-800 font-normal">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
                            <span>เปิดรับลงทะเบียน (Public) — พนักงานใหม่สามารถลงทะเบียนผ่านระบบได้</span>
                        </div>
                    ) : (
                        <div className="px-4 py-2 bg-slate-50/60 flex items-center gap-2 text-xs text-slate-700 font-normal">
                            <div className="w-2 h-2 rounded-full bg-slate-400 shrink-0"></div>
                            <span>ปิดรับลงทะเบียน (จำกัดสิทธิ์) — ต้องได้รับอนุมัติจากผู้ดูแลระบบเท่านั้น</span>
                        </div>
                    )}
                </div>

                {/* 2. Photo & Storage Policy */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-purple-100/80 text-purple-700 flex items-center justify-center shrink-0">
                            <ImageIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight">รูปภาพและพื้นที่จัดเก็บ</h2>
                            <p className="text-[11px] text-slate-500 font-normal">จัดการนโยบายการยืนยันตัวตนด้วยรูปถ่าย</p>
                        </div>
                    </div>

                    <div className="p-4 sm:p-5 space-y-4">
                        {/* Require Photo Toggle */}
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                                <Camera className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                                <div>
                                    <label className="text-xs sm:text-sm font-medium text-slate-900 block">บังคับถ่ายรูปเมื่อลงเวลา</label>
                                    <p className="text-[11px] text-slate-500 font-normal">พนักงานต้องถ่ายรูปยืนยันตัวตนทุกครั้งที่ Check-in / Check-out</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSettings({ ...settings, requirePhoto: !settings.requirePhoto })}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-hidden ${settings.requirePhoto ? 'bg-slate-900' : 'bg-slate-300'}`}
                            >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${settings.requirePhoto ? 'translate-x-4.5' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        <hr className="border-slate-100" />

                        {/* Storage Strategy */}
                        <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-2">รูปแบบการจัดเก็บข้อมูล</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div
                                    onClick={() => setSettings({ ...settings, storageType: "base64" })}
                                    className={`relative p-3.5 rounded-lg border cursor-pointer transition-all ${(!settings.storageType || settings.storageType === "base64")
                                        ? 'border-slate-900 bg-slate-50/80 shadow-xs'
                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1.5">
                                        <Database className={`w-4 h-4 ${(!settings.storageType || settings.storageType === "base64") ? 'text-slate-900' : 'text-slate-400'}`} />
                                        {(!settings.storageType || settings.storageType === "base64") && (
                                            <span className="bg-slate-900 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">Active</span>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-slate-900 text-xs sm:text-sm">Base64 Encoding</h3>
                                    <p className="text-xs text-slate-600 font-normal mt-1 leading-relaxed">
                                        เก็บไฟล์ภาพแปลงเป็น text ลงใน Database โดยตรง เหมาะสำหรับองค์กรขนาดเล็ก เน็ตช้า
                                    </p>
                                </div>

                                <div
                                    onClick={() => setSettings({ ...settings, storageType: "storage" })}
                                    className={`relative p-3.5 rounded-lg border cursor-pointer transition-all ${settings.storageType === "storage"
                                        ? 'border-slate-900 bg-slate-50/80 shadow-xs'
                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1.5">
                                        <HardDrive className={`w-4 h-4 ${settings.storageType === "storage" ? 'text-slate-900' : 'text-slate-400'}`} />
                                        {settings.storageType === "storage" && (
                                            <span className="bg-slate-900 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">Active</span>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-slate-900 text-xs sm:text-sm">Firebase Cloud Storage</h3>
                                    <p className="text-xs text-slate-600 font-normal mt-1 leading-relaxed">
                                        เก็บลง Cloud Storage แยกต่างหาก รองรับไฟล์ใหญ่ ประหยัดพื้นที่ Database
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Storage Usage */}
                        <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                                    <HardDrive className="w-3.5 h-3.5 text-slate-600" /> พื้นที่จัดเก็บ Database (Usage)
                                </span>
                                {storageUsage === null ? (
                                    <button
                                        type="button"
                                        onClick={loadStorageUsage}
                                        disabled={loadingStorage}
                                        className="text-xs text-slate-700 hover:text-slate-900 font-medium underline underline-offset-2"
                                    >
                                        {loadingStorage ? "กำลังคำนวณ..." : "ตรวจสอบพื้นที่ (Check Usage)"}
                                    </button>
                                ) : (
                                    <span className="text-xs font-mono text-slate-700 font-medium">
                                        {(storageUsage.totalBytes / (1024 * 1024)).toFixed(2)} MB / {(storageUsage.limitBytes / (1024 * 1024)).toFixed(0)} MB
                                    </span>
                                )}
                            </div>

                            {storageUsage && (
                                <div className="space-y-2 mt-2">
                                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-500 ${storageUsage.usagePercent > 80 ? 'bg-red-500' : 'bg-slate-800'}`}
                                            style={{ width: `${Math.min(storageUsage.usagePercent, 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[11px] text-slate-600 font-normal">
                                        <span>{storageUsage.fileCount.toLocaleString()} รายการ</span>
                                        <span className="font-semibold text-slate-800">{storageUsage.usagePercent.toFixed(1)}% ใช้ไป</span>
                                    </div>

                                    <div className="pt-2.5 border-t border-slate-200 mt-2.5 flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleCleanup(6)}
                                            disabled={cleanupLoading}
                                            className="h-7 text-xs px-2.5 bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-700 font-normal transition-colors"
                                        >
                                            ลบรูป &gt; 6 เดือน
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleCleanup(12)}
                                            disabled={cleanupLoading}
                                            className="h-7 text-xs px-2.5 bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-700 font-normal transition-colors"
                                        >
                                            ลบรูป &gt; 1 ปี
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. Work Time Policy */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0">
                                <Clock className="w-4 h-4" />
                            </div>
                            <div>
                                <h2 className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight">เวลาทำงาน & นโยบาย</h2>
                                <p className="text-[11px] text-slate-500 font-normal">ตั้งค่าเวลาเข้า-ออกงาน และกฎการมาสาย</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSettings({ ...settings, workTimeEnabled: !settings.workTimeEnabled })}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-hidden ${settings.workTimeEnabled ? 'bg-slate-900' : 'bg-slate-300'}`}
                        >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${settings.workTimeEnabled ? 'translate-x-4.5' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    <div className={`p-4 sm:p-5 space-y-4 transition-opacity ${settings.workTimeEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        {/* Time Slots */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                                <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2 block">เวลาเข้างาน (Check In)</label>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={settings.checkInHour}
                                        onChange={(e) => setSettings({ ...settings, checkInHour: parseInt(e.target.value) })}
                                        className="h-9 flex-1 bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-normal rounded-md focus:ring-1 focus:ring-slate-400 focus:border-slate-400 block px-2.5"
                                    >
                                        {Array.from({ length: 24 }, (_, i) => (
                                            <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                                        ))}
                                    </select>
                                    <span className="font-bold text-slate-400">:</span>
                                    <select
                                        value={settings.checkInMinute}
                                        onChange={(e) => setSettings({ ...settings, checkInMinute: parseInt(e.target.value) })}
                                        className="h-9 flex-1 bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-normal rounded-md focus:ring-1 focus:ring-slate-400 focus:border-slate-400 block px-2.5"
                                    >
                                        {[0, 15, 30, 45].map((m) => (
                                            <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                                <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2 block">เวลาออกงาน (Check Out)</label>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={settings.checkOutHour}
                                        onChange={(e) => setSettings({ ...settings, checkOutHour: parseInt(e.target.value) })}
                                        className="h-9 flex-1 bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-normal rounded-md focus:ring-1 focus:ring-slate-400 focus:border-slate-400 block px-2.5"
                                    >
                                        {Array.from({ length: 24 }, (_, i) => (
                                            <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                                        ))}
                                    </select>
                                    <span className="font-bold text-slate-400">:</span>
                                    <select
                                        value={settings.checkOutMinute}
                                        onChange={(e) => setSettings({ ...settings, checkOutMinute: parseInt(e.target.value) })}
                                        className="h-9 flex-1 bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-normal rounded-md focus:ring-1 focus:ring-slate-400 focus:border-slate-400 block px-2.5"
                                    >
                                        {[0, 15, 30, 45].map((m) => (
                                            <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Grace Period & OT */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-800 mb-1.5">อนุโลมสายได้ (Late Grace Period - นาที)</label>
                                <div className="relative">
                                    <Shield className="absolute top-2.5 left-3 w-4 h-4 text-slate-400" />
                                    <input
                                        type="number"
                                        className="pl-9 w-full rounded-md border-slate-300 text-slate-800 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 text-xs sm:text-sm font-normal h-9"
                                        value={settings.lateGracePeriod}
                                        onChange={(e) => setSettings({ ...settings, lateGracePeriod: parseInt(e.target.value) || 0 })}
                                        placeholder="0"
                                    />
                                </div>
                                <p className="text-[11px] text-slate-500 font-normal mt-1">เวลาที่อนุโลมให้สายได้โดยไม่นับว่าสาย</p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-800 mb-1.5">OT ขั้นต่ำ (Minimum OT - นาที)</label>
                                <div className="relative">
                                    <Clock className="absolute top-2.5 left-3 w-4 h-4 text-slate-400" />
                                    <input
                                        type="number"
                                        className="pl-9 w-full rounded-md border-slate-300 text-slate-800 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 text-xs sm:text-sm font-normal h-9"
                                        value={settings.minOTMinutes}
                                        onChange={(e) => setSettings({ ...settings, minOTMinutes: parseInt(e.target.value) || 0 })}
                                        placeholder="30"
                                    />
                                </div>
                                <p className="text-[11px] text-slate-500 font-normal mt-1">เวลาทำงานล่วงเวลาขั้นต่ำที่จะนับเป็น OT</p>
                            </div>
                        </div>

                        {/* Extra Features Toggles */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                            <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50/50 hover:border-slate-300 transition-colors">
                                <div>
                                    <span className="text-xs sm:text-sm font-medium text-slate-900 block">Break Time Tracking</span>
                                    <span className="text-[11px] text-slate-500 font-normal">อนุญาตให้ลงเวลาพักเบรค</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSettings({ ...settings, enableBreak: !settings.enableBreak })}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-hidden ${settings.enableBreak ? 'bg-emerald-600' : 'bg-slate-300'}`}
                                >
                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${settings.enableBreak ? 'translate-x-4.5' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50/50 hover:border-slate-300 transition-colors">
                                <div>
                                    <span className="text-xs sm:text-sm font-medium text-slate-900 block">Offsite Tracking</span>
                                    <span className="text-[11px] text-slate-500 font-normal">อนุญาตให้ลงเวลานอกสถานที่</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSettings({ ...settings, enableOffsite: !settings.enableOffsite })}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-hidden ${settings.enableOffsite ? 'bg-emerald-600' : 'bg-slate-300'}`}
                                >
                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${settings.enableOffsite ? 'translate-x-4.5' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Location Verification */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-rose-100/80 text-rose-700 flex items-center justify-center shrink-0">
                                <MapPin className="w-4 h-4" />
                            </div>
                            <div>
                                <h2 className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight">การยืนยันพิกัด (GPS)</h2>
                                <p className="text-[11px] text-slate-500 font-normal">กำหนดพื้นที่อนุญาตให้ลงเวลา (Geofencing)</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSettings(prev => ({ ...prev, locationEnabled: !prev.locationEnabled }))}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-hidden ${settings.locationEnabled ? 'bg-slate-900' : 'bg-slate-300'}`}
                        >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${settings.locationEnabled ? 'translate-x-4.5' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    <div className={`p-4 sm:p-5 space-y-3.5 transition-opacity ${settings.locationEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs sm:text-sm font-medium text-slate-900">รายการจุดเช็กอิน</p>
                                <p className="text-[11px] text-slate-500 font-normal">เพิ่มได้หลายจุด และนำไปกำหนดให้พนักงานแต่ละคนได้</p>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={handleAddWorkLocation} className="h-8 text-xs font-medium gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-100">
                                <Plus className="w-3.5 h-3.5" />
                                เพิ่มจุดเช็กอิน
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {(settings.workLocations || []).map((location, index) => (
                                <div key={location.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-bold shrink-0">
                                                {index + 1}
                                            </div>
                                            <div>
                                                <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight">{location.name || `จุดเช็กอิน ${index + 1}`}</p>
                                                <p className="text-[10px] font-mono text-slate-500">ID: {location.id}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveWorkLocation(location.id)}
                                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                            disabled={(settings.workLocations || []).length === 1}
                                            title="ลบจุดเช็กอิน"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="sm:col-span-2">
                                            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">ชื่อจุดเช็กอิน</label>
                                            <input
                                                type="text"
                                                className="w-full rounded-md border-slate-300 text-slate-800 text-xs sm:text-sm font-normal focus:border-slate-400 focus:ring-1 focus:ring-slate-400 h-9 px-3 bg-white"
                                                value={location.name}
                                                onChange={(e) => handleLocationFieldChange(location.id, "name", e.target.value)}
                                                placeholder={`จุดเช็กอิน ${index + 1}`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Latitude</label>
                                            <input
                                                type="number"
                                                step="any"
                                                className="w-full rounded-md border-slate-300 text-slate-800 text-xs sm:text-sm font-mono font-normal focus:border-slate-400 focus:ring-1 focus:ring-slate-400 h-9 px-3 bg-white"
                                                value={location.latitude}
                                                onChange={(e) => handleLocationFieldChange(location.id, "latitude", parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Longitude</label>
                                            <input
                                                type="number"
                                                step="any"
                                                className="w-full rounded-md border-slate-300 text-slate-800 text-xs sm:text-sm font-mono font-normal focus:border-slate-400 focus:ring-1 focus:ring-slate-400 h-9 px-3 bg-white"
                                                value={location.longitude}
                                                onChange={(e) => handleLocationFieldChange(location.id, "longitude", parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">รัศมี (เมตร)</label>
                                            <input
                                                type="number"
                                                className="w-full rounded-md border-slate-300 text-slate-800 text-xs sm:text-sm font-normal focus:border-slate-400 focus:ring-1 focus:ring-slate-400 h-9 px-3 bg-white"
                                                value={location.radius}
                                                onChange={(e) => handleLocationFieldChange(location.id, "radius", parseInt(e.target.value) || 100)}
                                            />
                                        </div>
                                        <div className="sm:col-span-2 md:col-span-3 flex items-end">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleGetCurrentLocation(location.id)}
                                                disabled={gettingLocationId === location.id}
                                                className="h-9 px-3 text-xs font-medium gap-1.5 border-slate-300 text-slate-700 hover:bg-white"
                                            >
                                                <Crosshair className={`w-3.5 h-3.5 ${gettingLocationId === location.id ? 'animate-spin' : ''}`} />
                                                {gettingLocationId === location.id ? 'กำลังระบุตำแหน่ง...' : 'ใช้ตำแหน่งปัจจุบันของฉัน'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 5. Notifications */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-amber-100/80 text-amber-700 flex items-center justify-center shrink-0">
                            <Bell className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight">การแจ้งเตือน (Notifications)</h2>
                            <p className="text-[11px] text-slate-500 font-normal">จัดการการแจ้งเตือนผ่าน LINE Notify, LINE OA หรือ Telegram</p>
                        </div>
                    </div>

                    <div className="p-4 sm:p-5 space-y-4">
                        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 flex items-center justify-between">
                            <div>
                                <span className="text-xs sm:text-sm font-medium text-slate-900 block">รายงานสรุปประจำวัน</span>
                                <span className="text-[11px] text-slate-500 font-normal">ส่งรายงานสรุปการเข้างานอัตโนมัติทุกวัน</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSettings({ ...settings, enableDailyReport: !settings.enableDailyReport })}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-hidden ${settings.enableDailyReport ? 'bg-indigo-600' : 'bg-slate-300'}`}
                            >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${settings.enableDailyReport ? 'translate-x-4.5' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Admin Line Group ID</label>
                            <input
                                type="text"
                                className="w-full rounded-md border-slate-300 text-slate-800 text-xs sm:text-sm font-mono font-normal focus:border-slate-400 focus:ring-1 focus:ring-slate-400 h-9 px-3 bg-white"
                                value={settings.adminLineGroupId}
                                onChange={(e) => setSettings({ ...settings, adminLineGroupId: e.target.value })}
                                placeholder="Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            />
                            <p className="text-[11px] text-slate-500 font-normal mt-1">ID ของกลุ่ม LINE ที่ต้องการให้ส่งแจ้งเตือนและรายงาน</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <span className="text-xs sm:text-sm font-medium text-slate-900 block">แจ้งเตือนเช็กอินไปยัง LINE OA</span>
                                        <span className="text-[11px] text-slate-500 font-normal">ส่งชื่อพนักงาน เวลา และที่อยู่ไปยังกลุ่ม LINE OA</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSettings({ ...settings, enableLineCheckInNotification: !settings.enableLineCheckInNotification })}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-hidden ${settings.enableLineCheckInNotification ? 'bg-emerald-600' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${settings.enableLineCheckInNotification ? 'translate-x-4.5' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">LINE OA Group ID</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-md border-slate-300 text-slate-800 text-xs sm:text-sm font-mono font-normal focus:border-slate-400 focus:ring-1 focus:ring-slate-400 h-9 px-3 bg-white"
                                        value={settings.lineCheckInGroupId ?? ""}
                                        onChange={(e) => setSettings({ ...settings, lineCheckInGroupId: e.target.value })}
                                        placeholder="Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                    />
                                    <p className="text-[10px] text-slate-500 font-normal mt-1">ใช้สำหรับแจ้งเตือนเมื่อพนักงานเช็กอินสำเร็จ</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <span className="text-xs sm:text-sm font-medium text-slate-900 block">แจ้งเตือนเช็กอินไปยัง Telegram</span>
                                        <span className="text-[11px] text-slate-500 font-normal">ส่งข้อมูลเช็กอินไปยัง Telegram group หรือ chat ที่กำหนด</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSettings({ ...settings, enableTelegramCheckInNotification: !settings.enableTelegramCheckInNotification })}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-hidden ${settings.enableTelegramCheckInNotification ? 'bg-sky-600' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${settings.enableTelegramCheckInNotification ? 'translate-x-4.5' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Telegram Chat ID</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-md border-slate-300 text-slate-800 text-xs sm:text-sm font-mono font-normal focus:border-slate-400 focus:ring-1 focus:ring-slate-400 h-9 px-3 bg-white"
                                        value={settings.telegramChatId ?? ""}
                                        onChange={(e) => setSettings({ ...settings, telegramChatId: e.target.value })}
                                        placeholder="-1001234567890"
                                    />
                                    <p className="text-[10px] text-slate-500 font-normal mt-1">ใส่ Chat ID หรือ Group ID ของ Telegram ที่ต้องการรับแจ้งเตือน</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 6. Payroll & Holidays */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100/80 text-indigo-700 flex items-center justify-center shrink-0">
                            <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight">วันหยุด & การจ่ายเงิน (Payroll)</h2>
                            <p className="text-[11px] text-slate-500 font-normal">กำหนดวันหยุดประจำสัปดาห์ และอัตราการจ่าย OT</p>
                        </div>
                    </div>

                    <div className="p-4 sm:p-5 space-y-5">
                        {/* Weekly Holidays */}
                        <div>
                            <label className="text-xs sm:text-sm font-medium text-slate-900 block mb-2">วันหยุดประจำสัปดาห์ (Weekly Holidays)</label>
                            <div className="flex flex-wrap gap-1.5">
                                {["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"].map((day, index) => {
                                    const isSelected = settings.weeklyHolidays?.includes(index);
                                    const isDisabled = settings.useIndividualHolidays;
                                    return (
                                        <button
                                            key={index}
                                            type="button"
                                            onClick={() => {
                                                if (isDisabled) return;
                                                const current = settings.weeklyHolidays || [];
                                                if (isSelected) {
                                                    setSettings({ ...settings, weeklyHolidays: current.filter(d => d !== index) });
                                                } else {
                                                    setSettings({ ...settings, weeklyHolidays: [...current, index] });
                                                }
                                            }}
                                            disabled={isDisabled}
                                            className={`h-9 px-3.5 rounded-lg text-xs sm:text-sm font-medium transition-colors border ${isSelected
                                                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                                : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                                                } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-[11px] text-slate-500 font-normal mt-1.5">
                                * เลือกวันที่เป็นวันหยุดประจำสัปดาห์ของบริษัท
                            </p>
                        </div>

                        {/* Holiday Mode Toggle */}
                        <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200">
                            <div className="flex justify-between items-center mb-3">
                                <div>
                                    <h4 className="text-xs sm:text-sm font-semibold text-slate-900">โหมดวันหยุดพนักงาน</h4>
                                    <p className="text-[11px] text-slate-500 font-normal">เลือกวิธีการคำนวณวันหยุดสำหรับพนักงานในองค์กร</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-medium ${!settings.useIndividualHolidays ? 'text-slate-900' : 'text-slate-400'}`}>Global</span>
                                    <button
                                        type="button"
                                        onClick={() => setSettings({ ...settings, useIndividualHolidays: !settings.useIndividualHolidays })}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-hidden ${settings.useIndividualHolidays ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${settings.useIndividualHolidays ? 'translate-x-4.5' : 'translate-x-1'}`} />
                                    </button>
                                    <span className={`text-xs font-medium ${settings.useIndividualHolidays ? 'text-indigo-600' : 'text-slate-400'}`}>Individual</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className={`p-3 rounded-lg border transition-all ${!settings.useIndividualHolidays ? 'bg-white border-slate-300 shadow-xs' : 'bg-transparent border-transparent opacity-50'}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                                        <span className="text-xs font-semibold text-slate-800">ใช้วันหยุดส่วนกลาง (Global)</span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 font-normal pl-4">พนักงานทุกคนใช้วันหยุดชุดเดียวกันตามที่กำหนดข้างต้น</p>
                                </div>
                                <div className={`p-3 rounded-lg border transition-all ${settings.useIndividualHolidays ? 'bg-white border-indigo-300 shadow-xs' : 'bg-transparent border-transparent opacity-50'}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                        <span className="text-xs font-semibold text-indigo-800">ใช้วันหยุดรายบุคคล (Individual)</span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 font-normal pl-4">ระบบจะยึดตามวันหยุดที่ระบุในโปรไฟล์ของพนักงานแต่ละคน</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* Payroll Rates */}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">อัตรา OT (วันปกติ)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute top-2.5 left-3 w-3.5 h-3.5 text-slate-400" />
                                        <input
                                            type="number" step="0.1"
                                            className="pl-8.5 w-full rounded-md border-slate-300 text-slate-800 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 text-xs sm:text-sm font-mono font-normal h-9 bg-white"
                                            value={settings.otMultiplier}
                                            onChange={(e) => setSettings({ ...settings, otMultiplier: parseFloat(e.target.value) || 1.5 })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">อัตรา OT (วันหยุด)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute top-2.5 left-3 w-3.5 h-3.5 text-slate-400" />
                                        <input
                                            type="number" step="0.1"
                                            className="pl-8.5 w-full rounded-md border-slate-300 text-slate-800 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 text-xs sm:text-sm font-mono font-normal h-9 bg-white"
                                            value={settings.otMultiplierHoliday}
                                            onChange={(e) => setSettings({ ...settings, otMultiplierHoliday: parseFloat(e.target.value) || 3.0 })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Swap Policy */}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">ขอสลับวันหยุดล่วงหน้า</label>
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <ArrowLeftRight className="absolute top-2.5 left-3 w-3.5 h-3.5 text-slate-400" />
                                            <input
                                                type="number"
                                                className="pl-8.5 w-full rounded-md border-slate-300 text-slate-800 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 text-xs sm:text-sm font-normal h-9 bg-white"
                                                value={settings.swapAdvanceDays ?? 3}
                                                onChange={(e) => setSettings({ ...settings, swapAdvanceDays: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <span className="text-xs sm:text-sm text-slate-700 font-normal">วัน</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-normal mt-1">ต้องส่งคำขอล่วงหน้าก่อนกี่วัน</p>
                                </div>
                            </div>

                            {/* Late Deduction Policy */}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">นโยบายหักเงินค่ามาสาย</label>
                                    <div>
                                        <select
                                            className="w-full rounded-md border-slate-300 text-slate-800 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 text-xs sm:text-sm font-normal h-9 px-2.5 bg-white"
                                            value={settings.lateDeductionType}
                                            onChange={(e) => setSettings({ ...settings, lateDeductionType: e.target.value as any })}
                                        >
                                            <option value="none">ไม่หักเงิน (แค่บันทึก)</option>
                                            <option value="pro-rated">หักตามจริง (รายชั่วโมง)</option>
                                            <option value="fixed_per_minute">หักคงที่ต่อนาที</option>
                                        </select>
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-normal mt-1">กฎการหักเงินกรณีเข้างานสาย</p>
                                </div>
                                {settings.lateDeductionType === "fixed_per_minute" && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">อัตราหักเงิน (บาท/นาที)</label>
                                        <div className="relative">
                                            <DollarSign className="absolute top-2.5 left-3 w-3.5 h-3.5 text-slate-400" />
                                            <input
                                                type="number" step="1"
                                                className="pl-8.5 w-full rounded-md border-slate-300 text-slate-800 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 text-xs sm:text-sm font-mono font-normal h-9 bg-white"
                                                value={settings.lateDeductionRate}
                                                onChange={(e) => setSettings({ ...settings, lateDeductionRate: parseFloat(e.target.value) || 0 })}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Custom Holidays Manager */}
                        <div className="pt-4 border-t border-slate-200">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="text-xs sm:text-sm font-semibold text-slate-900">วันหยุดนักขัตฤกษ์ / พิเศษ (Custom Holidays)</h3>
                                    <p className="text-[11px] text-slate-500 font-normal">กำหนดวันหยุดเพิ่มเติม พร้อมตัวคูณอัตราค่าจ้างและ OT</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mb-3">
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                                    <div className="sm:col-span-3">
                                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">วันที่ (Date)</label>
                                        <input
                                            type="date"
                                            className="w-full rounded-md border-slate-300 text-slate-800 text-xs sm:text-sm font-normal h-9 px-2 bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                            value={newHoliday.date}
                                            onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                                        />
                                    </div>
                                    <div className="sm:col-span-4">
                                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">ชื่อวันหยุด (Holiday Name)</label>
                                        <input
                                            type="text"
                                            placeholder="เช่น วันขึ้นปีใหม่"
                                            className="w-full rounded-md border-slate-300 text-slate-800 text-xs sm:text-sm font-normal h-9 px-2.5 bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                            value={newHoliday.name}
                                            onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">ค่าแรง x (Work)</label>
                                        <input
                                            type="number" step="0.1"
                                            className="w-full rounded-md border-slate-300 text-slate-800 text-xs sm:text-sm font-normal h-9 px-2 text-center bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                            value={newHoliday.workdayMultiplier}
                                            onChange={(e) => setNewHoliday({ ...newHoliday, workdayMultiplier: parseFloat(e.target.value) || 2.0 })}
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">OT x</label>
                                        <input
                                            type="number" step="0.1"
                                            className="w-full rounded-md border-slate-300 text-slate-800 text-xs sm:text-sm font-normal h-9 px-2 text-center bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                            value={newHoliday.otMultiplier}
                                            onChange={(e) => setNewHoliday({ ...newHoliday, otMultiplier: parseFloat(e.target.value) || 1.5 })}
                                        />
                                    </div>
                                    <div className="sm:col-span-1">
                                        <button
                                            type="button"
                                            onClick={handleAddHoliday}
                                            disabled={!newHoliday.name}
                                            className="w-full h-9 bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-xs"
                                            title="เพิ่มวันหยุด"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                                {settings.customHolidays && settings.customHolidays.length > 0 ? (
                                    settings.customHolidays.map((holiday, index) => (
                                        <div key={index} className="flex items-center justify-between p-2 px-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <div className="text-center min-w-[46px]">
                                                    <div className="text-[10px] text-slate-500 font-semibold uppercase">{format(new Date(holiday.date), "MMM", { locale: th })}</div>
                                                    <div className="text-base font-bold text-slate-900 leading-none">{format(new Date(holiday.date), "d")}</div>
                                                </div>
                                                <div className="w-px h-7 bg-slate-200"></div>
                                                <div>
                                                    <div className="font-medium text-slate-900 text-xs sm:text-sm">{holiday.name}</div>
                                                    <div className="flex gap-1.5 text-[11px] mt-0.5">
                                                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-1.5 py-0.5 rounded font-normal">Work x{holiday.workdayMultiplier}</span>
                                                        <span className="bg-amber-50 text-amber-800 border border-amber-200/80 px-1.5 py-0.5 rounded font-normal">OT x{holiday.otMultiplier}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveHoliday(index)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                                                title="ลบวันหยุด"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-5 text-slate-500 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 text-xs font-normal">
                                        ยังไม่มีวันหยุดพิเศษที่กำหนด
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Save Button (Sticky Bottom) */}
                <div className="sticky bottom-3 z-40 bg-white/95 backdrop-blur-md border border-slate-200 shadow-md rounded-xl p-2.5 px-4 flex justify-between items-center">
                    <Button variant="ghost" size="sm" className="h-9 text-xs sm:text-sm font-normal text-slate-600 hover:text-slate-900 hover:bg-slate-100" onClick={handleReset}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        คืนค่าเริ่มต้น
                    </Button>
                    <div className="flex gap-2">
                        {/* Index Checker Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                                setCheckingIndexes(true);
                                try {
                                    const results = await checkAllIndexes();
                                    setIndexResults(results);
                                    setShowIndexModal(true);
                                } catch (error) {
                                    console.error("Error:", error);
                                } finally {
                                    setCheckingIndexes(false);
                                }
                            }}
                            className="h-9 text-xs sm:text-sm font-normal bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                        >
                            <Database className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                            {checkingIndexes ? "กำลังตรวจ..." : "ตรวจ Firestore Indexes"}
                        </Button>

                        <Button
                            onClick={handleSave}
                            disabled={loading}
                            className="h-9 px-4 text-xs sm:text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white min-w-[130px] shadow-xs"
                        >
                            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                            บันทึกการตั้งค่า
                        </Button>
                    </div>
                </div>

            </div>

            {/* Index Modal */}
            {showIndexModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
                        <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50/70">
                            <h3 className="font-semibold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                                <Database className="w-4 h-4 text-indigo-600" /> Firestore Indexes
                            </h3>
                            <button onClick={() => setShowIndexModal(false)} className="text-slate-400 hover:text-slate-700 text-sm p-1">✕</button>
                        </div>
                        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
                            {indexResults.filter(r => r.status === "missing").length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                                    </div>
                                    <h4 className="text-sm sm:text-base font-semibold text-slate-900">All Indexes Healthy</h4>
                                    <p className="text-slate-600 text-xs font-normal mt-1">ระบบฐานข้อมูลพร้อมใช้งานสมบูรณ์</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
                                        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                                        <div>
                                            <h4 className="text-amber-900 font-semibold text-xs sm:text-sm">Missing Indexes Found</h4>
                                            <p className="text-amber-800 text-xs font-normal mt-0.5">จำเป็นต้องสร้าง Index เพื่อให้การค้นหาข้อมูลทำงานได้ถูกต้อง คลิกที่ปุ่มด้านล่างเพื่อสร้าง</p>
                                        </div>
                                    </div>
                                    {indexResults.filter(r => r.status === "missing").map((result, idx) => (
                                        <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs hover:border-indigo-200 transition-all">
                                            <div className="flex justify-between items-start gap-2">
                                                <div>
                                                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{result.collection}</span>
                                                    <h4 className="font-medium text-slate-900 text-xs sm:text-sm mt-0.5">{result.queryName}</h4>
                                                </div>
                                                {result.indexUrl && (
                                                    <a href={result.indexUrl} target="_blank" rel="noopener noreferrer" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-2.5 py-1.5 rounded-md flex items-center gap-1.5 font-medium transition-colors">
                                                        Create <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Dev Tools */}
                            <div className="pt-4 border-t border-slate-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-slate-600 uppercase">JSON Definition</span>
                                    <button
                                        className="text-xs text-slate-600 hover:text-indigo-600 flex items-center gap-1 font-normal"
                                        onClick={() => {
                                            const json = JSON.stringify({
                                                indexes: indexResults.filter(r => r.fields).map(r => ({
                                                    collectionGroup: r.collection,
                                                    queryScope: "COLLECTION",
                                                    fields: r.fields
                                                })),
                                                fieldOverrides: []
                                            }, null, 2);
                                            navigator.clipboard.writeText(json);
                                        }}
                                    >
                                        <Copy className="w-3 h-3" /> Copy JSON
                                    </button>
                                </div>
                                <div className="bg-slate-900 rounded-lg p-2.5 overflow-hidden">
                                    <pre className="text-[10px] text-slate-300 font-mono overflow-auto max-h-28 custom-scrollbar">
                                        {JSON.stringify({
                                            indexes: indexResults.filter(r => r.fields).map(r => ({
                                                collectionGroup: r.collection,
                                                queryScope: "COLLECTION",
                                                fields: r.fields
                                            })),
                                            fieldOverrides: []
                                        }, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Confirmation Modal */}
            {showResetConfirm && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
                        <div className="p-5 flex flex-col items-center text-center">
                            <div className="mb-3 p-2.5 rounded-full bg-orange-50">
                                <AlertCircle className="w-8 h-8 text-orange-500" />
                            </div>
                            <h3 className="text-base font-semibold text-slate-900 mb-1.5">
                                ยืนยันคืนค่าเริ่มต้น?
                            </h3>
                            <p className="text-xs text-slate-600 mb-5 leading-relaxed font-normal">
                                การตั้งค่าทั้งหมดจะถูกรีเซ็ตกลับไปเป็นค่าเริ่มต้นของระบบ คุณแน่ใจหรือไม่?
                            </p>
                            <div className="flex gap-2.5 w-full">
                                <button
                                    onClick={() => setShowResetConfirm(false)}
                                    className="flex-1 h-9 rounded-lg font-normal text-xs sm:text-sm border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={confirmReset}
                                    className="flex-1 h-9 rounded-lg text-white font-medium text-xs sm:text-sm bg-orange-500 hover:bg-orange-600 transition-colors shadow-xs"
                                >
                                    ยืนยัน
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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

// Additional camera icon needed for import
function Camera({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
        </svg>
    )
}
