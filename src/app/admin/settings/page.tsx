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
import { systemConfigService, type SystemConfig, employeeService } from "@/lib/firestore";
import { getStorageUsage, deleteOldPhotos, type StorageStats, PHOTO_STORAGE_LIMIT } from "@/lib/storage";
import { checkAllIndexes, type IndexCheckResult } from "@/lib/indexChecker";
import { CustomAlert } from "@/components/ui/custom-alert";

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
        date: format(new Date(), "yyyy-MM-dd"),
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
    const [gettingLocation, setGettingLocation] = useState(false);
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

        const holidayDate = new Date(newHoliday.date);
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
            date: format(new Date(), "yyyy-MM-dd"),
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

    const handleGetCurrentLocation = () => {
        setGettingLocation(true);
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setSettings(prev => ({
                        ...prev,
                        locationConfig: {
                            ...prev.locationConfig!,
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude
                        }
                    }));
                    setGettingLocation(false);
                },
                (error) => {
                    console.error("Error getting location:", error);
                    setAlertState({
                        isOpen: true,
                        title: "ผิดพลาด",
                        message: "ไม่สามารถดึงตำแหน่งปัจจุบันได้ กรุณาตรวจสอบการอนุญาตเข้าถึงตำแหน่ง",
                        type: "error"
                    });
                    setGettingLocation(false);
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
            setGettingLocation(false);
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
            locationConfig: {
                enabled: false,
                latitude: 0,
                longitude: 0,
                radius: 100
            },
            swapAdvanceDays: 3
        });
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
        <div className="bg-slate-50 min-h-screen pb-20">
            <PageHeader
                title="ตั้งค่าระบบ"
                subtitle="กำหนดนโยบายการเข้างาน การคำนวณเงินเดือน และการเชื่อมต่อ"
            />

            <div className="max-w-5xl mx-auto px-6 -mt-6 relative z-10 space-y-6">

                {/* Success Notification */}
                {saved && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3 shadow-sm animate-fade-in">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <div>
                            <h4 className="text-emerald-800 font-semibold text-sm">บันทึกเรียบร้อย</h4>
                            <p className="text-emerald-600 text-xs mt-0.5">การตั้งค่าระบบได้รับการอัปเดตแล้ว</p>
                        </div>
                    </div>
                )}

                {/* 1. General Registration */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-blue-100 bg-blue-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-md">
                                <UserPlus className="w-5 h-5 text-blue-700" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-slate-900">การลงทะเบียนพนักงาน</h2>
                                <p className="text-xs text-slate-500">จัดการสิทธิ์การเข้าใช้งานระบบสำหรับพนักงานใหม่</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSettings({ ...settings, allowNewRegistration: !settings.allowNewRegistration })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${settings.allowNewRegistration ? 'bg-slate-900' : 'bg-slate-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.allowNewRegistration ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    {settings.allowNewRegistration ? (
                        <div className="px-6 py-3 bg-emerald-50/50 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <span className="text-sm font-medium text-emerald-700">เปิดรับลงทะเบียน (Public)</span>
                        </div>
                    ) : (
                        <div className="px-6 py-3 bg-slate-50 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                            <span className="text-sm font-medium text-slate-600">ปิดรับลงทะเบียน (จำกัดสิทธิ์)</span>
                        </div>
                    )}
                </div>

                {/* 2. Photo & Storage Policy */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-purple-100 bg-purple-50/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-md">
                                <ImageIcon className="w-5 h-5 text-purple-700" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-slate-900">รูปภาพและพื้นที่จัดเก็บ</h2>
                                <p className="text-xs text-slate-500">จัดการนโยบายการยืนยันตัวตนด้วยรูปถ่าย</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Require Photo Toggle */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3">
                                <Camera className="w-5 h-5 text-slate-400 mt-0.5" />
                                <div>
                                    <label className="text-sm font-medium text-slate-900 block">บังคับถ่ายรูปเมื่อลงเวลา</label>
                                    <p className="text-xs text-slate-500 mt-1">พนักงานต้องถ่ายรูปยืนยันตัวตนทุกครั้งที่ Check-in / Check-out</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSettings({ ...settings, requirePhoto: !settings.requirePhoto })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${settings.requirePhoto ? 'bg-slate-900' : 'bg-slate-200'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.requirePhoto ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        <hr className="border-slate-100" />

                        {/* Storage Strategy */}
                        <div>
                            <label className="text-sm font-medium text-slate-900 block mb-3">รูปแบบการจัดเก็บข้อมูล</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div
                                    onClick={() => setSettings({ ...settings, storageType: "base64" })}
                                    className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${(!settings.storageType || settings.storageType === "base64")
                                        ? 'border-slate-900 bg-slate-50'
                                        : 'border-slate-100 hover:border-slate-300'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <Database className={`w-5 h-5 ${(!settings.storageType || settings.storageType === "base64") ? 'text-slate-900' : 'text-slate-400'}`} />
                                        {(!settings.storageType || settings.storageType === "base64") && (
                                            <span className="bg-slate-900 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">Active</span>
                                        )}
                                    </div>
                                    <h3 className="font-bold text-slate-900 text-sm">Base64 Encoding</h3>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                        เก็บไฟล์ภาพแปลงเป็น text ลงใน Database โดยตรง เหมาะสำหรับองค์กรขนาดเล็ก เน็ตช้า
                                    </p>
                                </div>

                                <div
                                    onClick={() => setSettings({ ...settings, storageType: "storage" })}
                                    className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${settings.storageType === "storage"
                                        ? 'border-slate-900 bg-slate-50'
                                        : 'border-slate-100 hover:border-slate-300'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <HardDrive className={`w-5 h-5 ${settings.storageType === "storage" ? 'text-slate-900' : 'text-slate-400'}`} />
                                        {settings.storageType === "storage" && (
                                            <span className="bg-slate-900 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">Active</span>
                                        )}
                                    </div>
                                    <h3 className="font-bold text-slate-900 text-sm">Firebase Cloud Storage</h3>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                        เก็บลง Cloud Storage แยกต่างหาก รองรับไฟล์ใหญ่ ประหยัดพื้นที่ Database
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Storage Usage (Clean) */}
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                    <HardDrive className="w-3 h-3" /> Database Usage
                                </span>
                                {storageUsage === null ? (
                                    <button
                                        onClick={loadStorageUsage}
                                        disabled={loadingStorage}
                                        className="text-xs text-slate-600 hover:text-slate-900 font-medium underline decoration-slate-300 hover:decoration-slate-900 decoration-2 underline-offset-2"
                                    >
                                        {loadingStorage ? "Calculating..." : "Check Usage"}
                                    </button>
                                ) : (
                                    <span className="text-xs font-mono text-slate-600">
                                        {(storageUsage.totalBytes / (1024 * 1024)).toFixed(2)} MB / {(storageUsage.limitBytes / (1024 * 1024)).toFixed(0)} MB
                                    </span>
                                )}
                            </div>

                            {storageUsage && (
                                <div className="space-y-2">
                                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-500 ${storageUsage.usagePercent > 80 ? 'bg-red-500' : 'bg-slate-800'}`}
                                            style={{ width: `${Math.min(storageUsage.usagePercent, 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[10px] text-slate-500">
                                        <span>{storageUsage.fileCount.toLocaleString()} items</span>
                                        <span>{storageUsage.usagePercent.toFixed(1)}% Used</span>
                                    </div>

                                    <div className="pt-3 border-t border-slate-200 mt-3 flex gap-2">
                                        <button onClick={() => handleCleanup(6)} className="text-[10px] px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 text-slate-700 transition-colors">
                                            Clean &gt; 6 Months
                                        </button>
                                        <button onClick={() => handleCleanup(12)} className="text-[10px] px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 text-slate-700 transition-colors">
                                            Clean &gt; 1 Year
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. Work Time Policy */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-emerald-100 bg-emerald-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-md">
                                <Clock className="w-5 h-5 text-emerald-700" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-slate-900">เวลาทำงาน & นโยบาย</h2>
                                <p className="text-xs text-slate-500">ตั้งค่าเวลาเข้า-ออกงาน และกฎการมาสาย</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSettings({ ...settings, workTimeEnabled: !settings.workTimeEnabled })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${settings.workTimeEnabled ? 'bg-slate-900' : 'bg-slate-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.workTimeEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    <div className={`p-6 transition-opacity ${settings.workTimeEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        {/* Time Slots */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">เวลาเข้างาน (Check In)</label>
                                <div className="flex gap-2">
                                    <select
                                        value={settings.checkInHour}
                                        onChange={(e) => setSettings({ ...settings, checkInHour: parseInt(e.target.value) })}
                                        className="flex-1 bg-white border border-slate-300 text-slate-900 text-sm rounded-md focus:ring-slate-500 focus:border-slate-500 block p-2.5"
                                    >
                                        {Array.from({ length: 24 }, (_, i) => (
                                            <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                                        ))}
                                    </select>
                                    <span className="flex items-center font-bold text-slate-400">:</span>
                                    <select
                                        value={settings.checkInMinute}
                                        onChange={(e) => setSettings({ ...settings, checkInMinute: parseInt(e.target.value) })}
                                        className="flex-1 bg-white border border-slate-300 text-slate-900 text-sm rounded-md focus:ring-slate-500 focus:border-slate-500 block p-2.5"
                                    >
                                        {[0, 15, 30, 45].map((m) => (
                                            <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">เวลาออกงาน (Check Out)</label>
                                <div className="flex gap-2">
                                    <select
                                        value={settings.checkOutHour}
                                        onChange={(e) => setSettings({ ...settings, checkOutHour: parseInt(e.target.value) })}
                                        className="flex-1 bg-white border border-slate-300 text-slate-900 text-sm rounded-md focus:ring-slate-500 focus:border-slate-500 block p-2.5"
                                    >
                                        {Array.from({ length: 24 }, (_, i) => (
                                            <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                                        ))}
                                    </select>
                                    <span className="flex items-center font-bold text-slate-400">:</span>
                                    <select
                                        value={settings.checkOutMinute}
                                        onChange={(e) => setSettings({ ...settings, checkOutMinute: parseInt(e.target.value) })}
                                        className="flex-1 bg-white border border-slate-300 text-slate-900 text-sm rounded-md focus:ring-slate-500 focus:border-slate-500 block p-2.5"
                                    >
                                        {[0, 15, 30, 45].map((m) => (
                                            <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Grace Period & OT */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Late Grace Period (นาที)</label>
                                <div className="relative">
                                    <Shield className="absolute top-2.5 left-3 w-4 h-4 text-slate-400" />
                                    <input
                                        type="number"
                                        className="pl-9 w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm h-10"
                                        value={settings.lateGracePeriod}
                                        onChange={(e) => setSettings({ ...settings, lateGracePeriod: parseInt(e.target.value) || 0 })}
                                        placeholder="0"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">เวลาที่อนุโลมให้สายได้โดยไม่นับว่าสาย</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Minimum OT (นาที)</label>
                                <div className="relative">
                                    <Clock className="absolute top-2.5 left-3 w-4 h-4 text-slate-400" />
                                    <input
                                        type="number"
                                        className="pl-9 w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm h-10"
                                        value={settings.minOTMinutes}
                                        onChange={(e) => setSettings({ ...settings, minOTMinutes: parseInt(e.target.value) || 0 })}
                                        placeholder="30"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">เวลาทำงานล่วงเวลาขั้นต่ำที่จะนับเป็น OT</p>
                            </div>
                        </div>

                        {/* Extra Features Toggles */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-6">
                            <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                                <div>
                                    <span className="text-sm font-medium text-slate-900 block">Break Time Tracking</span>
                                    <span className="text-xs text-slate-500">อนุญาตให้ลงเวลาพักเบรค</span>
                                </div>
                                <button
                                    onClick={() => setSettings({ ...settings, enableBreak: !settings.enableBreak })}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${settings.enableBreak ? 'bg-emerald-600' : 'bg-slate-300'}`}
                                >
                                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${settings.enableBreak ? 'translate-x-5' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                                <div>
                                    <span className="text-sm font-medium text-slate-900 block">Offsite Tracking</span>
                                    <span className="text-xs text-slate-500">อนุญาตให้ลงเวลานอกสถานที่</span>
                                </div>
                                <button
                                    onClick={() => setSettings({ ...settings, enableOffsite: !settings.enableOffsite })}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${settings.enableOffsite ? 'bg-emerald-600' : 'bg-slate-300'}`}
                                >
                                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${settings.enableOffsite ? 'translate-x-5' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Location Verification */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-rose-100 bg-rose-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-rose-100 rounded-md">
                                <MapPin className="w-5 h-5 text-rose-700" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-slate-900">การยืนยันพิกัด (GPS)</h2>
                                <p className="text-xs text-slate-500">กำหนดพื้นที่อนุญาตให้ลงเวลา (Geofencing)</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSettings(prev => ({
                                ...prev,
                                locationConfig: {
                                    ...prev.locationConfig!,
                                    enabled: !prev.locationConfig?.enabled
                                }
                            }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${settings.locationConfig?.enabled ? 'bg-slate-900' : 'bg-slate-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.locationConfig?.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    <div className={`p-6 transition-opacity ${settings.locationConfig?.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Latitude</label>
                                    <input
                                        type="number" step="any"
                                        className="w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm h-10 font-mono"
                                        value={settings.locationConfig?.latitude ?? 0}
                                        onChange={(e) => setSettings(prev => ({ ...prev, locationConfig: { ...prev.locationConfig!, latitude: parseFloat(e.target.value) || 0 } }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Longitude</label>
                                    <input
                                        type="number" step="any"
                                        className="w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm h-10 font-mono"
                                        value={settings.locationConfig?.longitude ?? 0}
                                        onChange={(e) => setSettings(prev => ({ ...prev, locationConfig: { ...prev.locationConfig!, longitude: parseFloat(e.target.value) || 0 } }))}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col justify-end">
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Radius (Meters)</label>
                                <input
                                    type="number"
                                    className="w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm h-10"
                                    value={settings.locationConfig?.radius ?? 100}
                                    onChange={(e) => setSettings(prev => ({ ...prev, locationConfig: { ...prev.locationConfig!, radius: parseInt(e.target.value) || 100 } }))}
                                />
                            </div>
                        </div>
                        <div className="mt-4">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleGetCurrentLocation}
                                disabled={gettingLocation || !settings.locationConfig?.enabled}
                                className="gap-2"
                            >
                                <Crosshair className={`w-3.5 h-3.5 ${gettingLocation ? 'animate-spin' : ''}`} />
                                {gettingLocation ? 'Locating...' : 'Use Current Location'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* 5. Notifications */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-amber-100 bg-amber-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 rounded-md">
                                <Bell className="w-5 h-5 text-amber-700" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-slate-900">การแจ้งเตือน (Notifications)</h2>
                                <p className="text-xs text-slate-500">จัดการการแจ้งเตือนผ่าน LINK Notify หรือ Flex Message</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center justify-between mb-4">
                            <div>
                                <span className="text-sm font-medium text-slate-900 block">รายงานสรุปประจำวัน</span>
                                <span className="text-xs text-slate-500">ส่งรายงานสรุปการเข้างานอัตโนมัติทุกวัน</span>
                            </div>
                            <button
                                onClick={() => setSettings({ ...settings, enableDailyReport: !settings.enableDailyReport })}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${settings.enableDailyReport ? 'bg-indigo-600' : 'bg-slate-300'}`}
                            >
                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${settings.enableDailyReport ? 'translate-x-5' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Admin Line Group ID</label>
                            <input
                                type="text"
                                className="w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm h-10 font-mono"
                                value={settings.adminLineGroupId}
                                onChange={(e) => setSettings({ ...settings, adminLineGroupId: e.target.value })}
                                placeholder="Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">ID ของกลุ่ม LINE ที่ต้องการให้ส่งแจ้งเตือนและรายงาน</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <span className="text-sm font-medium text-slate-900 block">แจ้งเตือนเช็กอินไปยัง LINE OA</span>
                                        <span className="text-xs text-slate-500">ส่งชื่อพนักงาน เวลา และที่อยู่ไปยังกลุ่ม LINE OA</span>
                                    </div>
                                    <button
                                        onClick={() => setSettings({ ...settings, enableLineCheckInNotification: !settings.enableLineCheckInNotification })}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${settings.enableLineCheckInNotification ? 'bg-emerald-600' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${settings.enableLineCheckInNotification ? 'translate-x-5' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">LINE OA Group ID</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm h-10 font-mono"
                                        value={settings.lineCheckInGroupId ?? ""}
                                        onChange={(e) => setSettings({ ...settings, lineCheckInGroupId: e.target.value })}
                                        placeholder="Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">ใช้สำหรับแจ้งเตือนเมื่อพนักงานเช็กอินสำเร็จ</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <span className="text-sm font-medium text-slate-900 block">แจ้งเตือนเช็กอินไปยัง Telegram</span>
                                        <span className="text-xs text-slate-500">ส่งข้อมูลเช็กอินไปยัง Telegram group หรือ chat ที่กำหนด</span>
                                    </div>
                                    <button
                                        onClick={() => setSettings({ ...settings, enableTelegramCheckInNotification: !settings.enableTelegramCheckInNotification })}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${settings.enableTelegramCheckInNotification ? 'bg-sky-600' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${settings.enableTelegramCheckInNotification ? 'translate-x-5' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Telegram Chat ID</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm h-10 font-mono"
                                        value={settings.telegramChatId ?? ""}
                                        onChange={(e) => setSettings({ ...settings, telegramChatId: e.target.value })}
                                        placeholder="-1001234567890"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">ใส่ Chat ID หรือ Group ID ของ Telegram ที่ต้องการรับแจ้งเตือน</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 6. Payroll & Holidays */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-indigo-100 bg-indigo-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 rounded-md">
                                <Calendar className="w-5 h-5 text-indigo-700" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-slate-900">วันหยุด & การจ่ายเงิน (Payroll)</h2>
                                <p className="text-xs text-slate-500">กำหนดวันหยุดประจำสัปดาห์ และอัตราการจ่าย OT</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-8">
                        {/* Weekly Holidays */}
                        <div>
                            <label className="text-sm font-medium text-slate-900 block mb-3">วันหยุดประจำสัปดาห์ (Weekly Holidays)</label>
                            <div className="flex flex-wrap gap-2">
                                {["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"].map((day, index) => {
                                    const isSelected = settings.weeklyHolidays?.includes(index);
                                    const isDisabled = settings.useIndividualHolidays;
                                    return (
                                        <button
                                            key={index}
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
                                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 border ${isSelected
                                                ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2">
                                * เลือกวันที่เป็นวันหยุดประจำสัปดาห์ของบริษัท
                            </p>
                        </div>

                        {/* Holiday Mode Toggle */}
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800">โหมดวันหยุดพนักงาน</h4>
                                    <p className="text-xs text-slate-500">เลือกวิธีการคำนวณวันหยุดสำหรับพนักงานในองค์กร</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-medium ${!settings.useIndividualHolidays ? 'text-slate-900' : 'text-slate-400'}`}>Global</span>
                                    <button
                                        onClick={() => setSettings({ ...settings, useIndividualHolidays: !settings.useIndividualHolidays })}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${settings.useIndividualHolidays ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${settings.useIndividualHolidays ? 'translate-x-5' : 'translate-x-1'}`} />
                                    </button>
                                    <span className={`text-xs font-medium ${settings.useIndividualHolidays ? 'text-indigo-600' : 'text-slate-400'}`}>Individual</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className={`p-3 rounded border transition-all ${!settings.useIndividualHolidays ? 'bg-white border-slate-300 shadow-sm' : 'bg-transparent border-transparent opacity-50'}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                        <span className="text-xs font-bold text-slate-700">ใช้วันหยุดส่วนกลาง (Global)</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 pl-4">พนักงานทุกคนใช้วันหยุดชุดเดียวกันตามที่กำหนดข้างต้น</p>
                                </div>
                                <div className={`p-3 rounded border transition-all ${settings.useIndividualHolidays ? 'bg-white border-indigo-300 shadow-sm' : 'bg-transparent border-transparent opacity-50'}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                        <span className="text-xs font-bold text-indigo-700">ใช้วันหยุดรายบุคคล (Individual)</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 pl-4">ระบบจะยึดตามวันหยุดที่ระบุในโปรไฟล์ของพนักงานแต่ละคน</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Payroll Rates */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">OT Rate (Normal)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute top-2.5 left-3 w-3.5 h-3.5 text-slate-400" />
                                        <input
                                            type="number" step="0.1"
                                            className="pl-9 w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm h-9 font-mono"
                                            value={settings.otMultiplier}
                                            onChange={(e) => setSettings({ ...settings, otMultiplier: parseFloat(e.target.value) || 1.5 })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">OT Rate (Holiday)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute top-2.5 left-3 w-3.5 h-3.5 text-slate-400" />
                                        <input
                                            type="number" step="0.1"
                                            className="pl-9 w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm h-9 font-mono"
                                            value={settings.otMultiplierHoliday}
                                            onChange={(e) => setSettings({ ...settings, otMultiplierHoliday: parseFloat(e.target.value) || 3.0 })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Swap Policy */}
                            <div className="md:col-span-2 space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Swap Request Advance Days</label>
                                    <div className="flex items-center gap-3">
                                        <div className="relative flex-1">
                                            <ArrowLeftRight className="absolute top-2.5 left-3 w-3.5 h-3.5 text-slate-400" />
                                            <input
                                                type="number"
                                                className="pl-9 w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm h-9"
                                                value={settings.swapAdvanceDays ?? 3}
                                                onChange={(e) => setSettings({ ...settings, swapAdvanceDays: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <span className="text-sm text-slate-600">Days</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">จำนวนวันที่ต้องทำเรื่องขอสลับวันหยุดล่วงหน้า</p>
                                </div>
                            </div>
                        </div>

                        {/* Custom Holidays Manager */}
                        <div className="pt-6 border-t border-slate-100">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-slate-900">วันหยุดนักขัตฤกษ์ / พิเศษ (Custom Holidays)</h3>
                            </div>

                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 mb-4">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                    <div className="md:col-span-3">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Date</label>
                                        <input
                                            type="date"
                                            className="w-full rounded border-slate-300 text-sm h-9 px-2"
                                            value={newHoliday.date}
                                            onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                                        />
                                    </div>
                                    <div className="md:col-span-4">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Holiday Name</label>
                                        <input
                                            type="text"
                                            placeholder="Ex. วันปีใหม่"
                                            className="w-full rounded border-slate-300 text-sm h-9 px-2"
                                            value={newHoliday.name}
                                            onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Work x</label>
                                        <input
                                            type="number" step="0.1"
                                            className="w-full rounded border-slate-300 text-sm h-9 px-2 text-center"
                                            value={newHoliday.workdayMultiplier}
                                            onChange={(e) => setNewHoliday({ ...newHoliday, workdayMultiplier: parseFloat(e.target.value) || 2.0 })}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">OT x</label>
                                        <input
                                            type="number" step="0.1"
                                            className="w-full rounded border-slate-300 text-sm h-9 px-2 text-center"
                                            value={newHoliday.otMultiplier}
                                            onChange={(e) => setNewHoliday({ ...newHoliday, otMultiplier: parseFloat(e.target.value) || 1.5 })}
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <button
                                            onClick={handleAddHoliday}
                                            disabled={!newHoliday.name}
                                            className="w-full h-9 bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                {settings.customHolidays && settings.customHolidays.length > 0 ? (
                                    settings.customHolidays.map((holiday, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded hover:border-indigo-300 transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <div className="text-center min-w-[50px]">
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase">{format(new Date(holiday.date), "MMM", { locale: th })}</div>
                                                    <div className="text-lg font-bold text-slate-800 leading-none">{format(new Date(holiday.date), "d")}</div>
                                                </div>
                                                <div className="w-px h-8 bg-slate-100"></div>
                                                <div>
                                                    <div className="font-medium text-slate-900 text-sm">{holiday.name}</div>
                                                    <div className="flex gap-2 text-[10px] mt-0.5">
                                                        <span className="bg-emerald-50 text-emerald-700 px-1.5 rounded">Work x{holiday.workdayMultiplier}</span>
                                                        <span className="bg-amber-50 text-amber-700 px-1.5 rounded">OT x{holiday.otMultiplier}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveHoliday(index)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-6 text-slate-400 bg-slate-50/50 rounded border border-dashed border-slate-200 text-sm">
                                        No custom holidays defined.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Save Button (Sticky Bottom) */}
                <div className="sticky bottom-4 z-40 bg-white/90 backdrop-blur-md border border-slate-200 shadow-xl rounded-xl p-4 flex justify-between items-center max-w-5xl mx-auto">
                    <Button variant="ghost" className="text-slate-500 hover:text-slate-900" onClick={handleReset}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        คืนค่าเริ่มต้น
                    </Button>
                    <div className="flex gap-3">
                        {/* Index Checker Button (Compact) */}
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
                            className="bg-white"
                        >
                            <Database className="w-4 h-4 mr-2 text-indigo-600" />
                            {checkingIndexes ? "Checking..." : "Check Firestore Indexes"}
                        </Button>

                        <Button
                            onClick={handleSave}
                            disabled={loading}
                            className="bg-slate-900 hover:bg-slate-800 text-white min-w-[140px]"
                        >
                            {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            บันทึกการตั้งค่า
                        </Button>
                    </div>
                </div>

            </div>

            {/* Index Modal */}
            {showIndexModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                <Database className="w-5 h-5 text-indigo-600" /> Firestore Indexes
                            </h3>
                            <button onClick={() => setShowIndexModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            {indexResults.filter(r => r.status === "missing").length === 0 ? (
                                <div className="text-center py-10">
                                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                                    </div>
                                    <h4 className="text-lg font-bold text-slate-800">All Indexes Healthy</h4>
                                    <p className="text-slate-500 text-sm mt-1">ระบบฐานข้อมูลพร้อมใช้งานสมบูรณ์</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                                        <div>
                                            <h4 className="text-amber-800 font-bold text-sm">Missing Indexes Found</h4>
                                            <p className="text-amber-700 text-xs mt-0.5">จำเป็นต้องสร้าง Index เพื่อให้การค้นหาข้อมูลทำงานได้ถูกต้อง คลิกที่ปุ่มด้านล่างเพื่อสร้าง</p>
                                        </div>
                                    </div>
                                    {indexResults.filter(r => r.status === "missing").map((result, idx) => (
                                        <div key={idx} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:border-indigo-200 transition-all">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{result.collection}</span>
                                                    <h4 className="font-medium text-slate-800 mt-1">{result.queryName}</h4>
                                                </div>
                                                {result.indexUrl && (
                                                    <a href={result.indexUrl} target="_blank" rel="noopener noreferrer" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 font-medium transition-colors">
                                                        Create <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Dev Tools */}
                            <div className="mt-8 pt-6 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-slate-400 uppercase">JSON Definition</span>
                                    <button
                                        className="text-[10px] text-slate-500 hover:text-indigo-600 flex items-center gap-1"
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
                                <div className="bg-slate-900 rounded-lg p-3 overflow-hidden">
                                    <pre className="text-[10px] text-slate-300 font-mono overflow-auto max-h-32 custom-scrollbar">
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
