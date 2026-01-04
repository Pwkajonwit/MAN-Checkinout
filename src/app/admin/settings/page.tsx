"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Save, Clock, AlertCircle, CheckCircle2, DollarSign, HardDrive, Calendar, Plus, Trash2, MapPin, Crosshair, Database, ExternalLink, RefreshCw, Copy, FileJson, Briefcase, ArrowLeftRight, Users } from "lucide-react";
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
        lateDeductionType: "pro-rated",
        lateDeductionRate: 0,
        requirePhoto: true,
        adminLineGroupId: "",
        enableDailyReport: false,
        customHolidays: [],
        allowNewRegistration: true,
        workTimeEnabled: true, // Enable work time tracking by default
        locationConfig: {
            enabled: false,
            latitude: 0,
            longitude: 0,
            radius: 100
        },
        swapAdvanceDays: 3
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
    const [storageUsage, setStorageUsage] = useState<StorageStats>({
        totalBytes: 0,
        fileCount: 0,
        limitBytes: PHOTO_STORAGE_LIMIT,
        usagePercent: 0,
        isNearLimit: false,
        canUpload: true
    });
    const [loadingStorage, setLoadingStorage] = useState(true);
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
                        lateDeductionType: config.lateDeductionType ?? "pro-rated",
                        lateDeductionRate: config.lateDeductionRate ?? 0,
                        requirePhoto: config.requirePhoto ?? true,
                        adminLineGroupId: config.adminLineGroupId ?? "",
                        enableDailyReport: config.enableDailyReport ?? false,
                        customHolidays: config.customHolidays ?? [],
                        allowNewRegistration: config.allowNewRegistration ?? true,
                        workTimeEnabled: config.workTimeEnabled ?? true,
                        locationConfig: config.locationConfig ?? {
                            enabled: false,
                            latitude: 0,
                            longitude: 0,
                            radius: 100
                        },
                        swapAdvanceDays: config.swapAdvanceDays ?? 3
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

    useEffect(() => {
        const loadStorage = async () => {
            try {
                const usage = await getStorageUsage();
                setStorageUsage(usage);
            } catch (error) {
                console.error("Error loading storage:", error);
            } finally {
                setLoadingStorage(false);
            }
        };
        loadStorage();
    }, []);

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

            // Hide success message after 3 seconds
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
            lateDeductionType: "pro-rated",
            lateDeductionRate: 0,
            requirePhoto: true,
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
            <div>
                <PageHeader
                    title="ตั้งค่าระบบ"
                    subtitle="จัดการการตั้งค่าเวลาทำงานและนโยบายต่างๆ"
                />
                <div className="flex justify-center items-center h-64">
                    <div className="w-12 h-12 border-4 border-gray-100 border-t-primary rounded-full animate-spin mx-auto"></div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <PageHeader
                title="ตั้งค่าระบบ"
                subtitle="จัดการการตั้งค่าเวลาทำงานและนโยบายต่างๆ"
            />

            <div className="max-w-4xl">
                {/* Success Message */}
                {saved && (
                    <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <span className="text-green-800 font-medium">บันทึกการตั้งค่าเรียบร้อยแล้ว</span>
                    </div>
                )}

                {/* Employee Registration Setting */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                                    📝
                                </span>
                                การลงทะเบียนพนักงานใหม่
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
                                เปิด/ปิด การลงทะเบียนสำหรับพนักงานใหม่ (หากปิด จะลงได้เฉพาะผู้ที่มีข้อมูลในระบบแล้ว)
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSettings({ ...settings, allowNewRegistration: !settings.allowNewRegistration })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.allowNewRegistration ? 'bg-blue-600' : 'bg-gray-200'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.allowNewRegistration ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    <div className="text-sm text-gray-600">
                        {settings.allowNewRegistration ? (
                            <p className="text-green-600 font-medium">✓ เปิดรับลงทะเบียนพนักงานใหม่</p>
                        ) : (
                            <p className="text-red-500">✕ ปิดรับลงทะเบียน (เฉพาะพนักงานที่มีข้อมูลแล้วเท่านั้น)</p>
                        )}
                    </div>
                </div>

                {/* Photo Requirement Setting */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                                    📸
                                </span>
                                การถ่ายรูปเมื่อลงเวลา
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
                                กำหนดว่าจะบันทึกรูปภาพหรือไม่เมื่อพนักงานลงเวลา
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSettings({ ...settings, requirePhoto: !settings.requirePhoto })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.requirePhoto ? 'bg-blue-600' : 'bg-gray-200'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.requirePhoto ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div className="text-sm text-gray-600">
                            {settings.requirePhoto ? (
                                <p className="text-green-600 font-medium">✓ บันทึกรูปภาพเมื่อลงเวลา</p>
                            ) : (
                                <p className="text-gray-500">ไม่บันทึกรูปภาพ (ยังคงต้องถ่ายรูป)</p>
                            )}
                        </div>

                        {/* Storage Usage */}
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <HardDrive className="w-4 h-4" />
                                    <span>พื้นที่จัดเก็บรูปภาพ (Firestore)</span>
                                </div>
                                {loadingStorage ? (
                                    <span className="text-xs text-gray-400">กำลังโหลด...</span>
                                ) : (
                                    <span className="text-sm font-medium text-gray-700">
                                        {(storageUsage.totalBytes / (1024 * 1024)).toFixed(2)} / {(storageUsage.limitBytes / (1024 * 1024)).toFixed(0)} MB
                                    </span>
                                )}
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-500 ${storageUsage.usagePercent > 90
                                        ? 'bg-red-500'
                                        : storageUsage.usagePercent > 70
                                            ? 'bg-yellow-500'
                                            : 'bg-blue-500'
                                        }`}
                                    style={{
                                        width: `${Math.min(storageUsage.usagePercent, 100)}%`
                                    }}
                                />
                            </div>

                            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                                <span>{storageUsage.fileCount.toLocaleString()} รูป</span>
                                <span>{storageUsage.usagePercent.toFixed(1)}% ที่ใช้</span>
                            </div>

                            {/* Info about Firestore storage */}
                            <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded-lg">
                                <p className="text-xs text-blue-700">
                                    💡 รูปถ่ายถูกเก็บใน Firestore เป็น Base64 (ลิมิต 800MB เพื่อไม่ให้เกิน Free tier 1GB)
                                </p>
                            </div>

                            {/* Warning if near limit */}
                            {storageUsage.isNearLimit && (
                                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                    <div className="text-xs text-red-700">
                                        <p className="font-medium">พื้นที่ใกล้เต็ม!</p>
                                        <p className="mt-1">กรุณาลบรูปภาพเก่าที่ไม่จำเป็น มิฉะนั้นจะไม่สามารถบันทึกรูปใหม่ได้</p>
                                    </div>
                                </div>
                            )}

                            {/* Cannot upload warning */}
                            {!storageUsage.canUpload && (
                                <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded-lg flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-700 mt-0.5 flex-shrink-0" />
                                    <div className="text-xs text-red-800">
                                        <p className="font-bold">⚠️ พื้นที่เต็ม!</p>
                                        <p className="mt-1">ไม่สามารถบันทึกรูปภาพใหม่ได้ กรุณาลบรูปเก่าก่อน</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Cleanup Actions */}
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                ล้างข้อมูลเก่า (Cleanup)
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleCleanup(3)}
                                    disabled={cleanupLoading}
                                    className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg border border-red-100 hover:bg-red-100 transition-colors flex items-center gap-1"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    เก่ากว่า 3 เดือน
                                </button>
                                <button
                                    onClick={() => handleCleanup(6)}
                                    disabled={cleanupLoading}
                                    className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg border border-red-100 hover:bg-red-100 transition-colors flex items-center gap-1"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    เก่ากว่า 6 เดือน
                                </button>
                                <button
                                    onClick={() => handleCleanup(12)}
                                    disabled={cleanupLoading}
                                    className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg border border-red-100 hover:bg-red-100 transition-colors flex items-center gap-1"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    เก่ากว่า 1 ปี
                                </button>
                            </div>
                            <p className="text-xs text-gray-400 mt-2">
                                * การลบรูปภาพจะไม่สามารถกู้คืนได้
                            </p>
                        </div>
                    </div>
                </div>

                {/* Location Settings */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                                <MapPin className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-800">พิกัดที่ทำงาน</h2>
                                <p className="text-sm text-gray-500">กำหนดพื้นที่สำหรับการลงเวลา (Geofencing)</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSettings(prev => ({
                                ...prev,
                                locationConfig: {
                                    ...prev.locationConfig!,
                                    enabled: !prev.locationConfig?.enabled
                                }
                            }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.locationConfig?.enabled ? 'bg-blue-600' : 'bg-gray-200'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.locationConfig?.enabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    <div className={`space-y-6 transition-opacity ${settings.locationConfig?.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    ละติจูด (Latitude)
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    value={settings.locationConfig?.latitude ?? 0}
                                    onChange={(e) => setSettings(prev => ({
                                        ...prev,
                                        locationConfig: {
                                            ...prev.locationConfig!,
                                            latitude: parseFloat(e.target.value) || 0
                                        }
                                    }))}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    ลองจิจูด (Longitude)
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    value={settings.locationConfig?.longitude ?? 0}
                                    onChange={(e) => setSettings(prev => ({
                                        ...prev,
                                        locationConfig: {
                                            ...prev.locationConfig!,
                                            longitude: parseFloat(e.target.value) || 0
                                        }
                                    }))}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-end gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    รัศมี (เมตร)
                                </label>
                                <input
                                    type="number"
                                    min="10"
                                    value={settings.locationConfig?.radius ?? 100}
                                    onChange={(e) => setSettings(prev => ({
                                        ...prev,
                                        locationConfig: {
                                            ...prev.locationConfig!,
                                            radius: parseInt(e.target.value) || 100
                                        }
                                    }))}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    ระยะห่างที่ยอมรับได้จากจุดพิกัดที่กำหนด
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleGetCurrentLocation}
                                disabled={gettingLocation || !settings.locationConfig?.enabled}
                                className="mb-[2px] h-[46px] gap-2"
                            >
                                <Crosshair className={`w-4 h-4 ${gettingLocation ? 'animate-spin' : ''}`} />
                                {gettingLocation ? 'กำลังค้นหา...' : 'ใช้ตำแหน่งปัจจุบัน'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Work Time Settings */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-800">เวลาทำงาน</h2>
                                <p className="text-sm text-gray-500">กำหนดเวลาเข้า-ออกงานมาตรฐาน (คำนวณสาย/โอที)</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSettings({ ...settings, workTimeEnabled: !settings.workTimeEnabled })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.workTimeEnabled ? 'bg-blue-600' : 'bg-gray-200'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.workTimeEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {!settings.workTimeEnabled && (
                        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                            <p className="text-sm text-yellow-800">
                                ⚠️ <strong>ปิดการใช้งาน:</strong> ระบบจะไม่คำนวณ/แจ้งเตือนการมาสายและโอที
                            </p>
                        </div>
                    )}

                    <div className={`transition-opacity ${settings.workTimeEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Check In Time */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    เวลาเข้างานมาตรฐาน
                                </label>
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <select
                                            value={settings.checkInHour}
                                            onChange={(e) => setSettings({ ...settings, checkInHour: parseInt(e.target.value) })}
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {Array.from({ length: 24 }, (_, i) => (
                                                <option key={i} value={i}>
                                                    {i.toString().padStart(2, '0')} ชั่วโมง
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <select
                                            value={settings.checkInMinute}
                                            onChange={(e) => setSettings({ ...settings, checkInMinute: parseInt(e.target.value) })}
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {[0, 15, 30, 45].map((minute) => (
                                                <option key={minute} value={minute}>
                                                    {minute.toString().padStart(2, '0')} นาที
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    ปัจจุบัน: {settings.checkInHour.toString().padStart(2, '0')}:{settings.checkInMinute.toString().padStart(2, '0')}
                                </p>
                            </div>

                            {/* Check Out Time */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    เวลาออกงานมาตรฐาน
                                </label>
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <select
                                            value={settings.checkOutHour}
                                            onChange={(e) => setSettings({ ...settings, checkOutHour: parseInt(e.target.value) })}
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {Array.from({ length: 24 }, (_, i) => (
                                                <option key={i} value={i}>
                                                    {i.toString().padStart(2, '0')} ชั่วโมง
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <select
                                            value={settings.checkOutMinute}
                                            onChange={(e) => setSettings({ ...settings, checkOutMinute: parseInt(e.target.value) })}
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {[0, 15, 30, 45].map((minute) => (
                                                <option key={minute} value={minute}>
                                                    {minute.toString().padStart(2, '0')} นาที
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    ปัจจุบัน: {settings.checkOutHour.toString().padStart(2, '0')}:{settings.checkOutMinute.toString().padStart(2, '0')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>


                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">นโยบายสาย & โอที</h2>
                            <p className="text-sm text-gray-500">กำหนดเงื่อนไขการมาสายและโอเวอร์ไทม์</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Late Grace Period */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                ระยะเวลาที่ยอมให้สาย (นาที)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="60"
                                value={settings.lateGracePeriod}
                                onChange={(e) => setSettings({ ...settings, lateGracePeriod: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="0"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                {settings.lateGracePeriod === 0
                                    ? "ไม่มีระยะเวลาผ่อนผัน (เกินเวลา = สาย)"
                                    : `ยอมให้สายได้ ${settings.lateGracePeriod} นาที`}
                            </p>
                        </div>

                        {/* Minimum OT Minutes */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                ระยะเวลาขั้นต่ำสำหรับโอที (นาที)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="240"
                                step="15"
                                value={settings.minOTMinutes}
                                onChange={(e) => setSettings({ ...settings, minOTMinutes: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="30"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                ต้องทำงานเกินเวลาอย่างน้อย {settings.minOTMinutes} นาที จึงจะนับเป็นโอที
                            </p>
                        </div>
                    </div>
                </div>

                {/* Swap Holiday Policy */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                            <ArrowLeftRight className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">นโยบายสลับวันหยุด</h2>
                            <p className="text-sm text-gray-500">กำหนดเงื่อนไขการขอสลับวันหยุด</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                ต้องขอสลับล่วงหน้าอย่างน้อย (วัน)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="30"
                                value={settings.swapAdvanceDays ?? 3}
                                onChange={(e) => setSettings({ ...settings, swapAdvanceDays: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="3"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                หากตั้งเป็น 0 คือสามารถขอสลับวันไหนก็ได้ (ไม่แนะนำ)
                            </p>
                        </div>
                    </div>
                </div>

                {/* Payroll Configuration */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">การคำนวณเงินเดือน</h2>
                            <p className="text-sm text-gray-500">กำหนดอัตราการจ่ายและหักเงิน</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* OT Multiplier Normal */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                อัตราจ่าย OT ปกติ (เท่า)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="3"
                                step="0.1"
                                value={settings.otMultiplier}
                                onChange={(e) => setSettings({ ...settings, otMultiplier: parseFloat(e.target.value) || 1.5 })}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="1.5"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                สำหรับวันทำงานปกติ (จันทร์-ศุกร์)
                            </p>
                        </div>

                        {/* OT Multiplier Holiday */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                อัตราจ่าย OT วันหยุด (เท่า)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="5"
                                step="0.1"
                                value={settings.otMultiplierHoliday}
                                onChange={(e) => setSettings({ ...settings, otMultiplierHoliday: parseFloat(e.target.value) || 3.0 })}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="3.0"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                สำหรับวันหยุดประจำสัปดาห์
                            </p>
                        </div>

                        {/* Weekly Holidays */}
                        <div className="md:col-span-2">
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    วันหยุดประจำสัปดาห์
                                </label>

                            </div>
                            <div className="flex flex-wrap gap-3">
                                {["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"].map((day, index) => (
                                    <label key={index} className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100">
                                        <input
                                            type="checkbox"
                                            checked={settings.weeklyHolidays?.includes(index) ?? false}
                                            onChange={(e) => {
                                                const current = settings.weeklyHolidays || [];
                                                if (e.target.checked) {
                                                    setSettings({ ...settings, weeklyHolidays: [...current, index] });
                                                } else {
                                                    setSettings({ ...settings, weeklyHolidays: current.filter(d => d !== index) });
                                                }
                                            }}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">{day}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Custom Holidays */}
                        <div className="md:col-span-2 border-t border-gray-100 pt-6 mt-2">
                            <label className="block text-sm font-medium text-gray-700 mb-4">
                                วันหยุดพิเศษ (กำหนดเอง)
                            </label>

                            {/* Add New Holiday */}
                            <div className="flex flex-wrap gap-3 mb-4 items-end bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">วันที่</label>
                                    <input
                                        type="date"
                                        value={newHoliday.date}
                                        onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="flex-1 min-w-[200px]">
                                    <label className="block text-xs text-gray-500 mb-1">ชื่อวันหยุด</label>
                                    <input
                                        type="text"
                                        value={newHoliday.name}
                                        onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                                        placeholder="เช่น วันปีใหม่"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="w-28">
                                    <label className="block text-xs text-gray-500 mb-1">ค่าแรง (เท่า)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="5"
                                        step="0.1"
                                        value={newHoliday.workdayMultiplier}
                                        onChange={(e) => setNewHoliday({ ...newHoliday, workdayMultiplier: parseFloat(e.target.value) || 2.0 })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="w-24">
                                    <label className="block text-xs text-gray-500 mb-1">OT (เท่า)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="5"
                                        step="0.1"
                                        value={newHoliday.otMultiplier}
                                        onChange={(e) => setNewHoliday({ ...newHoliday, otMultiplier: parseFloat(e.target.value) || 1.5 })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <button
                                    onClick={handleAddHoliday}
                                    disabled={!newHoliday.name}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 h-[38px]"
                                >
                                    <Plus className="w-4 h-4" />
                                    เพิ่ม
                                </button>
                            </div>

                            {/* Holiday List */}
                            <div className="space-y-2">
                                {settings.customHolidays && settings.customHolidays.length > 0 ? (
                                    settings.customHolidays.map((holiday, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2 text-gray-600">
                                                    <Calendar className="w-4 h-4 text-blue-500" />
                                                    <span className="font-mono text-sm">
                                                        {format(new Date(holiday.date), "d MMM yyyy", { locale: th })}
                                                    </span>
                                                </div>
                                                <span className="font-medium text-gray-800">{holiday.name}</span>
                                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-md font-medium">
                                                    ค่าแรง x{holiday.workdayMultiplier}
                                                </span>
                                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-md font-medium">
                                                    OT x{holiday.otMultiplier}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveHoliday(index)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                        ยังไม่มีวันหยุดพิเศษที่กำหนด
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Late Deduction */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                การหักเงินเมื่อมาสาย
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <label className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${settings.lateDeductionType === "none"
                                    ? "border-blue-600 bg-blue-50"
                                    : "border-gray-200 hover:border-blue-200"
                                    }`}>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name="lateDeduction"
                                            checked={settings.lateDeductionType === "none"}
                                            onChange={() => setSettings({ ...settings, lateDeductionType: "none" })}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="font-medium text-gray-900">ไม่หักเงิน</span>
                                    </div>
                                </label>

                                <label className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${settings.lateDeductionType === "pro-rated"
                                    ? "border-blue-600 bg-blue-50"
                                    : "border-gray-200 hover:border-blue-200"
                                    }`}>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name="lateDeduction"
                                            checked={settings.lateDeductionType === "pro-rated"}
                                            onChange={() => setSettings({ ...settings, lateDeductionType: "pro-rated" })}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="font-medium text-gray-900">หักตามจริง</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 ml-7">
                                        คำนวณจากฐานเงินเดือนและเวลาที่สาย
                                    </p>
                                </label>

                                <label className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${settings.lateDeductionType === "fixed_per_minute"
                                    ? "border-blue-600 bg-blue-50"
                                    : "border-gray-200 hover:border-blue-200"
                                    }`}>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name="lateDeduction"
                                            checked={settings.lateDeductionType === "fixed_per_minute"}
                                            onChange={() => setSettings({ ...settings, lateDeductionType: "fixed_per_minute" })}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="font-medium text-gray-900">หักต่อนาที</span>
                                    </div>
                                    {settings.lateDeductionType === "fixed_per_minute" && (
                                        <div className="mt-3 ml-7">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={settings.lateDeductionRate}
                                                    onChange={(e) => setSettings({ ...settings, lateDeductionRate: parseFloat(e.target.value) || 0 })}
                                                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                                />
                                                <span className="text-sm text-gray-500">บาท/นาที</span>
                                            </div>
                                        </div>
                                    )}
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notifications Settings */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-purple-50 rounded-xl">
                            <AlertCircle className="w-6 h-6 text-purple-600" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-800">การแจ้งเตือนผู้ดูแลระบบ</h2>
                    </div>

                    <div className="space-y-6">
                        {/* Daily Report Toggle */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                            <div>
                                <p className="font-medium text-gray-900">รายงานสรุปประจำวัน</p>
                                <p className="text-sm text-gray-500">ส่งรายงานสรุปการเข้างาน (มา, สาย, ลา) ให้แอดมินทุกวัน</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.enableDailyReport}
                                    onChange={(e) => setSettings({ ...settings, enableDailyReport: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>
                        </div>

                        {/* Admin Line Group ID */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Line Group ID (สำหรับแจ้งเตือน)
                            </label>
                            <input
                                type="text"
                                value={settings.adminLineGroupId}
                                onChange={(e) => setSettings({ ...settings, adminLineGroupId: e.target.value })}
                                placeholder="Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-mono text-sm"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                * ใส่ Line Group ID ที่ต้องการให้บอทส่งรายงาน (ต้องเชิญบอทเข้ากลุ่มก่อน)
                            </p>
                        </div>
                    </div>
                </div>

                {/* Firestore Index Checker */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-indigo-50 rounded-xl">
                            <Database className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">Firestore Indexes</h2>
                            <p className="text-sm text-gray-500">ตรวจสอบและสร้าง Composite Indexes ที่จำเป็น</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                            <p className="text-sm text-indigo-700">
                                💡 เมื่อย้ายไปใช้ Firebase Project ใหม่ ต้องสร้าง Composite Indexes ใหม่ทุกครั้ง
                                กดปุ่มด้านล่างเพื่อตรวจสอบว่ามี Index ใดที่ยังไม่ได้สร้าง
                            </p>
                        </div>

                        <Button
                            onClick={async () => {
                                setCheckingIndexes(true);
                                try {
                                    const results = await checkAllIndexes();
                                    setIndexResults(results);
                                    setShowIndexModal(true);
                                } catch (error) {
                                    console.error("Error checking indexes:", error);
                                    setAlertState({
                                        isOpen: true,
                                        title: "ผิดพลาด",
                                        message: "เกิดข้อผิดพลาดในการตรวจสอบ Indexes",
                                        type: "error"
                                    });
                                } finally {
                                    setCheckingIndexes(false);
                                }
                            }}
                            disabled={checkingIndexes}
                            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                        >
                            {checkingIndexes ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Database className="w-4 h-4" />
                            )}
                            {checkingIndexes ? "กำลังตรวจสอบ..." : "ตรวจสอบ Firestore Indexes"}
                        </Button>
                    </div>
                </div>

                {/* Index Check Results Modal */}
                {showIndexModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                            <div className="p-6 border-b border-gray-100">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-gray-800">ผลการตรวจสอบ Firestore Indexes</h3>
                                    <button
                                        onClick={() => setShowIndexModal(false)}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 overflow-y-auto max-h-[60vh]">
                                {indexResults.filter(r => r.status === "missing").length === 0 ? (
                                    <div className="text-center py-8">
                                        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                                        <h4 className="text-lg font-bold text-gray-800">Indexes พร้อมใช้งานแล้ว!</h4>
                                        <p className="text-gray-500 mt-2">ไม่พบ Index ที่ต้องสร้างเพิ่ม</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                                            <p className="text-sm text-yellow-800 font-medium">
                                                ⚠️ พบ {indexResults.filter(r => r.status === "missing").length} Indexes ที่ต้องสร้าง
                                            </p>
                                            <p className="text-xs text-yellow-700 mt-1">
                                                กดลิงก์แต่ละรายการเพื่อเปิด Firebase Console และสร้าง Index
                                            </p>
                                        </div>

                                        {indexResults.filter(r => r.status === "missing").map((result, index) => (
                                            <div key={index} className="p-4 bg-red-50 border border-red-200 rounded-xl">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <p className="font-medium text-gray-800">{result.queryName}</p>
                                                        <p className="text-sm text-gray-500">Collection: {result.collection}</p>
                                                    </div>
                                                    {result.indexUrl ? (
                                                        <a
                                                            href={result.indexUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm whitespace-nowrap"
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                            สร้าง Index
                                                        </a>
                                                    ) : (
                                                        <span className="px-3 py-1 bg-gray-200 text-gray-600 rounded-lg text-sm">
                                                            ไม่พบ URL
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                                            <p className="text-sm text-gray-700 font-medium">📋 วิธีใช้งาน:</p>
                                            <ol className="text-sm text-gray-600 mt-2 space-y-1 list-decimal list-inside">
                                                <li>กดปุ่ม "สร้าง Index" ของแต่ละรายการ</li>
                                                <li>จะเปิดหน้า Firebase Console</li>
                                                <li>กดปุ่ม "Create Index" ใน Firebase Console</li>
                                                <li>รอ 1-2 นาทีจนสร้างเสร็จ</li>
                                                <li>ทำซ้ำจนครบทุกรายการ</li>
                                            </ol>
                                        </div>

                                        <div className="mt-6 p-4 bg-gray-900 rounded-xl text-gray-200">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-sm font-bold flex items-center gap-2">
                                                    <FileJson className="w-4 h-4" />
                                                    firestore.indexes.json
                                                </h4>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        const json = JSON.stringify({
                                                            indexes: indexResults
                                                                .filter(r => r.fields)
                                                                .map(r => ({
                                                                    collectionGroup: r.collection,
                                                                    queryScope: "COLLECTION",
                                                                    fields: r.fields
                                                                })),
                                                            fieldOverrides: []
                                                        }, null, 2);
                                                        navigator.clipboard.writeText(json);
                                                        setAlertState({
                                                            isOpen: true,
                                                            title: "สำเร็จ",
                                                            message: "คัดลอก JSON แล้ว!",
                                                            type: "success"
                                                        });
                                                    }}
                                                    className="text-xs hover:bg-gray-800 text-gray-300 h-8 gap-1"
                                                >
                                                    <Copy className="w-3 h-3" />
                                                    คัดลอก
                                                </Button>
                                            </div>
                                            <p className="text-xs text-gray-400 mb-3">
                                                สำหรับนักพัฒนา: คัดลอก Config เพื่อนำไปใช้กับ Firebase CLI หรือตรวจสอบโครงสร้าง
                                            </p>
                                            <pre className="text-[10px] font-mono bg-black/50 p-2 rounded-lg overflow-x-auto max-h-32">
                                                {JSON.stringify({
                                                    indexes: indexResults
                                                        .filter(r => r.fields)
                                                        .map(r => ({
                                                            collectionGroup: r.collection,
                                                            queryScope: "COLLECTION",
                                                            fields: r.fields
                                                        })),
                                                    fieldOverrides: []
                                                }, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                )}

                                {/* Show all results */}
                                <div className="mt-6">
                                    <h4 className="font-medium text-gray-700 mb-3">รายการทั้งหมด:</h4>
                                    <div className="space-y-2">
                                        {indexResults.map((result, index) => (
                                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                <span className="text-sm text-gray-700">{result.queryName}</span>
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${result.status === "ok"
                                                    ? "bg-green-100 text-green-700"
                                                    : result.status === "missing"
                                                        ? "bg-red-100 text-red-700"
                                                        : "bg-gray-100 text-gray-700"
                                                    }`}>
                                                    {result.status === "ok" ? "✓ พร้อม" : result.status === "missing" ? "✕ ต้องสร้าง" : "? ไม่ทราบ"}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 bg-gray-50">
                                <Button
                                    onClick={() => setShowIndexModal(false)}
                                    className="w-full"
                                    variant="outline"
                                >
                                    ปิด
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-4">
                    <Button
                        variant="outline"
                        onClick={handleReset}
                        disabled={loading}
                        className="px-6"
                    >
                        คืนค่าเริ่มต้น
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 gap-2"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        บันทึกการตั้งค่า
                    </Button>
                </div>
            </div>

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
