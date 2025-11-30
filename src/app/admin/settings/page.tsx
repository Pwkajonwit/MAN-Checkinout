"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Save, Clock, AlertCircle, CheckCircle2, DollarSign, HardDrive, Calendar, Plus, Trash2, MapPin, Crosshair } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { WORK_TIME_CONFIG } from "@/lib/workTime";
import { systemConfigService, type SystemConfig } from "@/lib/firestore";
import { getStorageUsage, deleteOldPhotos } from "@/lib/storage";

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
        locationConfig: {
            enabled: false,
            latitude: 0,
            longitude: 0,
            radius: 100
        }
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
    const [storageUsage, setStorageUsage] = useState({ totalBytes: 0, fileCount: 0 });
    const [loadingStorage, setLoadingStorage] = useState(true);
    const [cleanupLoading, setCleanupLoading] = useState(false);
    const [gettingLocation, setGettingLocation] = useState(false);

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
                        locationConfig: config.locationConfig ?? {
                            enabled: false,
                            latitude: 0,
                            longitude: 0,
                            radius: 100
                        }
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
            alert(`ลบรูปภาพเรียบร้อยแล้ว ${result.deletedCount} รูป (${(result.freedBytes / (1024 * 1024)).toFixed(2)} MB)`);

            // Refresh storage usage
            const usage = await getStorageUsage();
            setStorageUsage(usage);
        } catch (error) {
            console.error("Error cleaning up:", error);
            alert("เกิดข้อผิดพลาดในการลบรูปภาพ");
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
                    alert("ไม่สามารถดึงตำแหน่งปัจจุบันได้ กรุณาตรวจสอบการอนุญาตเข้าถึงตำแหน่ง");
                    setGettingLocation(false);
                },
                { enableHighAccuracy: true }
            );
        } else {
            alert("เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง");
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
            alert("เกิดข้อผิดพลาดในการบันทึกการตั้งค่า");
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
            locationConfig: {
                enabled: false,
                latitude: 0,
                longitude: 0,
                radius: 100
            }
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
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
                                    <span>พื้นที่จัดเก็บรูปภาพ</span>
                                </div>
                                {loadingStorage ? (
                                    <span className="text-xs text-gray-400">กำลังโหลด...</span>
                                ) : (
                                    <span className="text-sm font-medium text-gray-700">
                                        {(storageUsage.totalBytes / (1024 * 1024 * 1024)).toFixed(2)} / 5.00 GB
                                    </span>
                                )}
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-500 ${(storageUsage.totalBytes / (5 * 1024 * 1024 * 1024)) > 0.9
                                        ? 'bg-red-500'
                                        : (storageUsage.totalBytes / (5 * 1024 * 1024 * 1024)) > 0.7
                                            ? 'bg-yellow-500'
                                            : 'bg-blue-500'
                                        }`}
                                    style={{
                                        width: `${Math.min((storageUsage.totalBytes / (5 * 1024 * 1024 * 1024)) * 100, 100)}%`
                                    }}
                                />
                            </div>

                            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                                <span>{storageUsage.fileCount.toLocaleString()} ไฟล์</span>
                                <span>{((storageUsage.totalBytes / (5 * 1024 * 1024 * 1024)) * 100).toFixed(1)}% ที่ใช้</span>
                            </div>

                            {/* Warning if near limit */}
                            {(storageUsage.totalBytes / (5 * 1024 * 1024 * 1024)) > 0.9 && (
                                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                    <div className="text-xs text-red-700">
                                        <p className="font-medium">พื้นที่ใกล้เต็ม!</p>
                                        <p className="mt-1">กรุณาลบรูปภาพเก่าที่ไม่จำเป็นหรือติดต่อผู้ดูแลระบบ</p>
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
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">เวลาทำงาน</h2>
                            <p className="text-sm text-gray-500">กำหนดเวลาเข้า-ออกงานมาตรฐาน</p>
                        </div>
                    </div>

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

                {/* Late & OT Settings */}
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
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                วันหยุดประจำสัปดาห์
                            </label>
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
        </div>
    );
}
