"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MapPin, Camera, RotateCcw, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { attendanceService, systemConfigService } from "@/lib/firestore";
import { isLate, getLateMinutes, isEligibleForOT, getOTMinutes, formatMinutesToHours } from "@/lib/workTime";
import { useEmployee } from "@/contexts/EmployeeContext";
import { EmployeeHeader } from "@/components/mobile/EmployeeHeader";
import { compressBase64Image, canUploadPhoto } from "@/lib/storage";
import { calculateDistance } from "@/lib/location";

import { CustomAlert } from "@/components/ui/custom-alert";

export default function CheckInPage() {
    const router = useRouter();
    const { employee, refreshEmployee } = useEmployee();
    const [step, setStep] = useState(1);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);


    // Alert State
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

    const showAlert = (title: string, message: string, type: "success" | "error" | "warning" | "info" = "info") => {
        setAlertState({
            isOpen: true,
            title,
            message,
            type
        });
    };

    const closeAlert = () => {
        setAlertState(prev => ({ ...prev, isOpen: false }));
    };

    // Step 1 Data
    const [checkInType, setCheckInType] = useState<"เข้างาน" | "ออกงาน" | "ออกนอกพื้นที่">("เข้างาน");
    const [canCheckIn, setCanCheckIn] = useState(true);
    const [canCheckOut, setCanCheckOut] = useState(false);
    const [canCheckOffsite, setCanCheckOffsite] = useState(false);


    // Step 2 Data (Camera)
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [photo, setPhoto] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
    const [cameraActive, setCameraActive] = useState(false);

    // Step 3 Data (Location)
    const [location, setLocation] = useState<{ lat: number, lng: number, address: string } | null>(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [distance, setDistance] = useState<number | null>(null);
    const [isLocationValid, setIsLocationValid] = useState(true);
    const [locationNote, setLocationNote] = useState("");

    // Settings
    const [requirePhoto, setRequirePhoto] = useState(true);
    const [workTimeEnabled, setWorkTimeEnabled] = useState(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [systemConfig, setSystemConfig] = useState<any>(null);
    const [locationConfig, setLocationConfig] = useState<{
        enabled: boolean;
        latitude: number;
        longitude: number;
        radius: number;
    } | null>(null);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Force Refresh Employee Data on Load (to get latest shift)
    useEffect(() => {
        refreshEmployee();
    }, []);

    // Load Shift and Status when Employee is ready
    useEffect(() => {
        if (employee?.id) {
            console.log("=== Employee Changed ===", employee.name);
            checkTodayStatus();
        }
    }, [employee]);

    // Check status on load
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const config = await systemConfigService.get();
                if (config) {
                    setSystemConfig(config);
                    setRequirePhoto(config.requirePhoto ?? true);
                    setWorkTimeEnabled(config.workTimeEnabled ?? true);
                    if (config.locationConfig) {
                        setLocationConfig(config.locationConfig);
                    }
                }
            } catch (error) {
                console.error("Error loading settings:", error);
            }
        };
        loadSettings();
    }, []);



    const checkTodayStatus = async () => {
        if (!employee?.id) return;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        try {
            const history = await attendanceService.getHistory(employee.id, todayStart, todayEnd);

            const mainActions = history
                .filter(h => h.status === "เข้างาน" || h.status === "ออกงาน" || h.status === "สาย")
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            if (mainActions.length > 0) {
                const lastAction = mainActions[0];
                if (lastAction.status === "เข้างาน" || lastAction.status === "สาย") {
                    setCanCheckIn(false);
                    setCanCheckOut(true);
                    setCanCheckOffsite(true);
                    setCheckInType("ออกงาน");
                } else {
                    setCanCheckIn(true);
                    setCanCheckOut(false);
                    setCanCheckOffsite(false);
                    setCheckInType("เข้างาน");
                }
            } else {
                setCanCheckIn(true);
                setCanCheckOut(false);
                setCanCheckOffsite(false);
                setCheckInType("เข้างาน");
            }
        } catch (error) {
            console.error("Error checking status:", error);
        }
    };

    // --- Step 2: Camera Functions ---
    const startCamera = async () => {
        try {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: facingMode }
            });
            setStream(newStream);
            if (videoRef.current) {
                videoRef.current.srcObject = newStream;
            }
            setCameraActive(true);
            setPhoto(null);
        } catch (error) {
            console.error("Error accessing camera:", error);
            showAlert("ไม่สามารถเข้าถึงกล้องได้", "กรุณาอนุญาตให้เข้าถึงกล้องเพื่อถ่ายรูป", "error");
        }
    };

    const switchCamera = () => {
        setFacingMode(prev => prev === "user" ? "environment" : "user");
        // Need to restart camera with new mode if active
        if (cameraActive) {
            // Small delay to allow state update
            setTimeout(() => {
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
                navigator.mediaDevices.getUserMedia({
                    video: { facingMode: facingMode === "user" ? "environment" : "user" }
                }).then(newStream => {
                    setStream(newStream);
                    if (videoRef.current) {
                        videoRef.current.srcObject = newStream;
                    }
                }).catch(err => console.error("Error switching camera:", err));
            }, 100);
        }
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                // Use JPEG with 0.8 quality to reduce file size and upload time
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setPhoto(dataUrl);
                setCameraActive(false);
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                    setStream(null);
                }
            }
        }
    };

    // --- Step 3: Location Functions ---
    const getLocation = () => {
        setLocationLoading(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;

                    // Calculate distance only if location check is enabled
                    if (locationConfig && locationConfig.enabled) {
                        const dist = calculateDistance(
                            lat,
                            lng,
                            locationConfig.latitude,
                            locationConfig.longitude
                        );
                        setDistance(dist);
                        setIsLocationValid(dist <= locationConfig.radius);
                    } else {
                        // Location check disabled - no distance calculation
                        setDistance(null);
                        setIsLocationValid(true);
                    }

                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                        const data = await res.json();
                        setLocation({
                            lat,
                            lng,
                            address: data.display_name || "ไม่สามารถระบุที่อยู่ได้"
                        });
                    } catch (error) {
                        console.error("Geocoding error:", error);
                        setLocation({ lat, lng, address: "ไม่สามารถดึงชื่อที่อยู่ได้" });
                    } finally {
                        setLocationLoading(false);
                    }
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    showAlert("ไม่สามารถระบุตำแหน่งได้", "กรุณาเปิดใช้งาน GPS หรืออนุญาตให้เข้าถึงตำแหน่ง", "error");
                    setLocationLoading(false);
                },
                { enableHighAccuracy: true }
            );
        } else {
            showAlert("Browser ไม่รองรับ", "Browser ของคุณไม่รองรับการระบุตำแหน่ง", "error");
            setLocationLoading(false);
        }
    };

    const getEffectiveWorkTimeConfig = () => {
        if (systemConfig) {
            return {
                checkInHour: systemConfig.checkInHour ?? 9,
                checkInMinute: systemConfig.checkInMinute ?? 0,
                checkOutHour: systemConfig.checkOutHour ?? 18,
                checkOutMinute: systemConfig.checkOutMinute ?? 0,
                lateGracePeriod: systemConfig.lateGracePeriod ?? 0
            };
        }

        // 3. Fallback: Hardcoded Default
        return {
            checkInHour: 9,
            checkInMinute: 0,
            checkOutHour: 18,
            checkOutMinute: 0,
            lateGracePeriod: 0
        };
    };

    const sendFlexMessage = async (type: string, time: Date, location: string, dist: number | null) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const liff = (window as any).liff;
        if (liff && liff.isInClient()) {
            try {
                // Calculate Late or OT status (only if workTimeEnabled)
                let statusText = "";
                let statusColor = "#666666";

                if (workTimeEnabled) {
                    const config = getEffectiveWorkTimeConfig();

                    if (type === "เข้างาน") {
                        // Custom isLate logic for SECONDS precision (Requested: > 09:00:59 is Late)
                        const standardTime = new Date(time);
                        standardTime.setHours(config.checkInHour, config.checkInMinute, 0, 0);

                        // Add grace period (minutes)
                        standardTime.setMinutes(standardTime.getMinutes() + config.lateGracePeriod);
                        // Ensure we cover up to 59 seconds of the grace minute
                        standardTime.setSeconds(59);
                        standardTime.setMilliseconds(999);

                        if (time > standardTime) {
                            // Calculate late minutes
                            const baseTime = new Date(time);
                            baseTime.setHours(config.checkInHour, config.checkInMinute, 0, 0);

                            const diffMs = time.getTime() - baseTime.getTime();
                            const lateMinutes = Math.floor(diffMs / (1000 * 60));

                            statusText = `สาย ${formatMinutesToHours(lateMinutes)}`;
                            statusColor = "#ef4444"; // Red
                        } else {
                            statusText = "ปกติ";
                            statusColor = "#22c55e"; // Green
                        }
                    }
                    // หมายเหตุ: ไม่แสดง OT อัตโนมัติแล้ว จะแสดงเฉพาะเมื่อมี OT Request ที่อนุมัติ
                }

                const contents: any[] = [
                    {
                        type: "box",
                        layout: "baseline",
                        spacing: "sm",
                        contents: [
                            {
                                type: "text",
                                text: "เวลา",
                                color: "#aaaaaa",
                                size: "sm",
                                flex: 2
                            },
                            {
                                type: "text",
                                text: time.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                                wrap: true,
                                color: "#666666",
                                size: "sm",
                                flex: 5
                            }
                        ]
                    }
                ];

                // Add status row if applicable
                if (statusText) {
                    contents.push({
                        type: "box",
                        layout: "baseline",
                        spacing: "sm",
                        contents: [
                            {
                                type: "text",
                                text: "สถานะ",
                                color: "#aaaaaa",
                                size: "sm",
                                flex: 2
                            },
                            {
                                type: "text",
                                text: statusText,
                                wrap: true,
                                color: statusColor,
                                size: "sm",
                                weight: "bold",
                                flex: 5
                            }
                        ]
                    });
                }

                // Add location row
                contents.push({
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                        {
                            type: "text",
                            text: "สถานที่",
                            color: "#aaaaaa",
                            size: "sm",
                            flex: 2
                        },
                        {
                            type: "text",
                            text: location,
                            wrap: true,
                            color: "#666666",
                            size: "sm",
                            flex: 5
                        }
                    ]
                });

                // Add distance row
                if (dist !== null) {
                    contents.push({
                        type: "box",
                        layout: "baseline",
                        spacing: "sm",
                        contents: [
                            {
                                type: "text",
                                text: "ระยะห่าง",
                                color: "#aaaaaa",
                                size: "sm",
                                flex: 2
                            },
                            {
                                type: "text",
                                text: dist < 1000 ? `${Math.round(dist)} เมตร` : `${(dist / 1000).toFixed(2)} กม.`,
                                wrap: true,
                                color: "#666666",
                                size: "sm",
                                flex: 5
                            }
                        ]
                    });
                }

                // Add note row if exists
                if (locationNote) {
                    contents.push({
                        type: "box",
                        layout: "baseline",
                        spacing: "sm",
                        contents: [
                            {
                                type: "text",
                                text: "หมายเหตุ",
                                color: "#aaaaaa",
                                size: "sm",
                                flex: 2
                            },
                            {
                                type: "text",
                                text: locationNote,
                                wrap: true,
                                color: "#ef4444", // Red to highlight exception
                                size: "sm",
                                flex: 5
                            }
                        ]
                    });
                }

                await liff.sendMessages([
                    {
                        type: "flex",
                        altText: `บันทึกเวลา ${type} สำเร็จ`,
                        contents: {
                            type: "bubble",
                            header: {
                                type: "box",
                                layout: "vertical",
                                contents: [
                                    {
                                        type: "text",
                                        text: "บันทึกเวลาสำเร็จ",
                                        weight: "bold",
                                        color: "#1DB446",
                                        size: "sm"
                                    },
                                    {
                                        type: "text",
                                        text: type,
                                        weight: "bold",
                                        size: "xxl",
                                        margin: "md"
                                    },
                                    {
                                        type: "text",
                                        text: time.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }),
                                        size: "xs",
                                        color: "#aaaaaa",
                                        wrap: true
                                    }
                                ]
                            },
                            body: {
                                type: "box",
                                layout: "vertical",
                                contents: [
                                    {
                                        type: "box",
                                        layout: "vertical",
                                        margin: "lg",
                                        spacing: "sm",
                                        contents: contents
                                    }
                                ]
                            }
                        }
                    }
                ]);
            } catch (error) {
                console.error("Error sending flex message:", error);
            }
        }
    };

    const handleSubmit = async () => {
        if (!employee) {
            showAlert("ไม่พบข้อมูลพนักงาน", "กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ", "error");
            return;
        }
        if (!location) {
            showAlert("กรุณาระบุตำแหน่ง", "กดปุ่ม 'แสดงที่อยู่ของคุณ' เพื่อระบุตำแหน่ง", "warning");
            return;
        }
        // Validate location note if outside area
        if (!isLocationValid && !locationNote.trim()) {
            showAlert("กรุณาระบุเหตุผล", "คุณอยู่นอกพื้นที่ทำงาน กรุณาระบุเหตุผลก่อนบันทึก", "warning");
            return;
        }

        setLoading(true);
        try {
            const now = new Date();

            // ตรวจสอบซ้ำก่อนบันทึก (ป้องกัน double submit หรือ race condition)
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            const history = await attendanceService.getHistory(employee.id || "", todayStart, todayEnd);
            const mainActions = history.filter(h => h.status === "เข้างาน" || h.status === "ออกงาน");

            // ป้องกันเข้างานซ้ำ
            if (checkInType === "เข้างาน") {
                const hasCheckedIn = mainActions.some(a => a.status === "เข้างาน");
                if (hasCheckedIn) {
                    showAlert("ลงเวลาซ้ำไม่ได้", "คุณได้ลงเวลาเข้างานวันนี้แล้ว", "warning");
                    setLoading(false);
                    await checkTodayStatus(); // รีเฟรชสถานะ
                    return;
                }
            }

            // ป้องกันออกงานซ้ำ
            if (checkInType === "ออกงาน") {
                const checkInRecord = mainActions.find(a => a.status === "เข้างาน" || a.status === "สาย");
                const hasCheckedOut = mainActions.some(a => a.status === "ออกงาน");
                if (!checkInRecord) {
                    showAlert("ยังไม่ได้เข้างาน", "กรุณาลงเวลาเข้างานก่อน", "warning");
                    setLoading(false);
                    await checkTodayStatus();
                    return;
                }
                if (hasCheckedOut) {
                    showAlert("ลงเวลาซ้ำไม่ได้", "คุณได้ลงเวลาออกงานวันนี้แล้ว", "warning");
                    setLoading(false);
                    await checkTodayStatus();
                    return;
                }
            }

            // Process photo as Base64 (stored directly in Firestore)
            let photoBase64: string | null = null;

            // บังคับรูปสำหรับออกนอกพื้นที่ หรือตาม requirePhoto setting
            const isOffsiteType = checkInType === "ออกนอกพื้นที่";
            const needsPhoto = requirePhoto || isOffsiteType;

            if (needsPhoto) {
                if (photo && employee?.id) {
                    try {
                        // Check storage limit before saving
                        const uploadCheck = await canUploadPhoto(photo);
                        if (!uploadCheck.canUpload) {
                            showAlert("พื้นที่เก็บข้อมูลเต็ม", uploadCheck.message, "error");
                            setLoading(false);
                            return;
                        }

                        // Show warning if near limit
                        if (uploadCheck.message) {
                            console.warn(uploadCheck.message);
                        }

                        // Compress the photo before saving
                        photoBase64 = await compressBase64Image(photo, 640, 480, 0.6);
                    } catch (compressError) {
                        console.error("Error compressing photo:", compressError);
                        // Use original photo if compression fails
                        photoBase64 = photo;
                    }
                } else {
                    // needsPhoto is true but no photo data
                    const message = isOffsiteType
                        ? "การออกนอกพื้นที่ต้องมีรูปถ่ายประกอบ"
                        : "ระบบต้องการรูปถ่ายเพื่อยืนยันตัวตน";
                    showAlert("กรุณาถ่ายรูป", message, "warning");
                    setLoading(false);
                    return;
                }
            } else {
                // requirePhoto is false and not offsite type
                console.log("Photo saving skipped (requirePhoto is false)");
                // photoBase64 remains null
            }

            try {
                // Prepare data object - only include defined fields
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const attendanceData: any = {
                    employeeId: employee.id || "unknown",
                    employeeName: employee.name,
                    date: now,
                    status: checkInType,
                    location: location.address,
                    latitude: location.lat,
                    longitude: location.lng,
                    distance: distance || 0
                };

                // Calculate Late Logic for Database
                if (checkInType === "เข้างาน" && workTimeEnabled) {
                    // ถ้าไม่ได้ shift ให้ใช้ค่าจาก state หรือ system config
                    const config = getEffectiveWorkTimeConfig();

                    // Custom isLate logic for SECONDS precision
                    const standardTime = new Date(now);
                    standardTime.setHours(config.checkInHour, config.checkInMinute, 0, 0);
                    standardTime.setMinutes(standardTime.getMinutes() + config.lateGracePeriod);
                    standardTime.setSeconds(59);
                    standardTime.setMilliseconds(999);

                    if (now > standardTime) {
                        // status remains "เข้างาน" even if late, as per requirement
                        // attendanceData.status = "สาย"; 

                        // Calculate late minutes
                        const baseTime = new Date(now);
                        baseTime.setHours(config.checkInHour, config.checkInMinute, 0, 0);
                        const diffMs = now.getTime() - baseTime.getTime();
                        attendanceData.lateMinutes = Math.floor(diffMs / (1000 * 60));
                        console.log("handleSubmit: Calculated lateMinutes:", attendanceData.lateMinutes);
                    }
                }

                // Conditionally add optional fields
                if (checkInType === "เข้างาน" || checkInType === "ออกนอกพื้นที่") {
                    attendanceData.checkIn = now;
                }

                if (checkInType === "ออกงาน") {
                    attendanceData.checkOut = now;

                    // Calculate OT if enabled
                    if (workTimeEnabled) {
                        const config = getEffectiveWorkTimeConfig();
                        const checkOutConfig = {
                            hour: config.checkOutHour,
                            minute: config.checkOutMinute,
                            minOTMinutes: 0 // Calculate all OT minutes, let Admin/Approval decide policy
                        };
                        const otMins = getOTMinutes(now, checkOutConfig);
                        if (otMins > 0) {
                            attendanceData.otMinutes = otMins;
                        }
                    }
                }

                if (photoBase64) {
                    attendanceData.photo = photoBase64;
                }

                if (locationNote.trim()) {
                    attendanceData.locationNote = locationNote.trim();
                }

                await attendanceService.create(attendanceData);
            } catch (dbError) {
                console.error("Error saving to database:", dbError);
                showAlert("บันทึกข้อมูลไม่สำเร็จ", "เกิดข้อผิดพลาดในการบันทึกข้อมูลลงฐานข้อมูล", "error");
                setLoading(false);
                return;
            }

            // Send Flex Message (Non-blocking)
            try {
                await sendFlexMessage(checkInType, now, location.address, locationConfig?.enabled ? distance : null);
            } catch (flexError) {
                console.error("Error sending Flex Message:", flexError);
                // Don't block success if Flex Message fails
            }

            setShowSuccess(true);

            await checkTodayStatus();

            // Delay reset to show success message
            setTimeout(() => {
                setShowSuccess(false);
                setStep(1);
                setLocation(null);
                setPhoto(null);
                setDistance(null);
                setIsLocationValid(true);
                setLocationNote("");
            }, 2000);

        } catch (error) {
            console.error("Unexpected error submitting:", error);
            showAlert("เกิดข้อผิดพลาด", "เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง", "error");
        } finally {
            setLoading(false);
        }
    };

    // --- Render Steps ---

    const renderStep1 = () => (
        <div className="space-y-6">
            {/* Clock Card - Green/White Theme */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                            <Clock className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-gray-800 tracking-tight">
                                {currentTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </div>
                            <div className="text-gray-500 text-sm">
                                {currentTime.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-green-600 font-medium text-sm">{currentTime.toLocaleDateString('th-TH', { weekday: 'long' })}</div>
                    </div>
                </div>
            </div>

            {/* Work Time Info */}
            <div className="bg-blue-50/50 rounded-xl px-4 py-2 border border-blue-100 text-xs text-center">
                <span className="text-gray-500 mr-2">เวลาทำงาน:</span>
                <span className="font-mono font-medium text-blue-800">
                    {(() => {
                        const conf = getEffectiveWorkTimeConfig();
                        return `${conf.checkInHour.toString().padStart(2, '0')}:${conf.checkInMinute.toString().padStart(2, '0')} - ${conf.checkOutHour.toString().padStart(2, '0')}:${conf.checkOutMinute.toString().padStart(2, '0')}`;
                    })()}
                </span>
            </div>

            {/* Type Selection - 2 Columns */}
            <div className="space-y-3">
                {/* เข้างาน / ออกงาน */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => canCheckIn && setCheckInType("เข้างาน")}
                        disabled={!canCheckIn}
                        className={`p-4 rounded-2xl border transition-all font-bold text-base flex flex-col items-center gap-2 ${checkInType === "เข้างาน"
                            ? "border-green-500 bg-green-50 text-green-700 shadow-md ring-1 ring-green-500"
                            : canCheckIn
                                ? "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                                : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60"
                            }`}
                    >
                        <div className={`w-4 h-4 rounded-full ${checkInType === "เข้างาน" ? "bg-green-600" : "bg-gray-300"}`} />
                        <span>เข้างาน</span>
                    </button>

                    <button
                        onClick={() => canCheckOut && setCheckInType("ออกงาน")}
                        disabled={!canCheckOut}
                        className={`p-4 rounded-2xl border transition-all font-bold text-base flex flex-col items-center gap-2 ${checkInType === "ออกงาน"
                            ? "border-red-500 bg-red-50 text-red-700 shadow-md ring-1 ring-red-500"
                            : canCheckOut
                                ? "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                                : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60"
                            }`}
                    >
                        <div className={`w-4 h-4 rounded-full ${checkInType === "ออกงาน" ? "bg-red-500" : "bg-gray-300"}`} />
                        <span>ออกงาน</span>
                    </button>
                </div>


                {/* ออกนอกพื้นที่ */}
                <div className="mt-3">
                    <button
                        onClick={() => canCheckOffsite && setCheckInType("ออกนอกพื้นที่")}
                        disabled={!canCheckOffsite}
                        className={`w-full p-4 rounded-2xl border transition-all font-bold text-base flex items-center justify-center gap-2 ${checkInType === "ออกนอกพื้นที่"
                            ? "border-purple-500 bg-purple-50 text-purple-700 shadow-md ring-1 ring-purple-500"
                            : canCheckOffsite
                                ? "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                                : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60"
                            }`}
                    >
                        <div className={`w-4 h-4 rounded-full ${checkInType === "ออกนอกพื้นที่" ? "bg-purple-500" : "bg-gray-300"}`} />
                        <span>บันทึกนอกสถานที่</span>
                    </button>
                </div>
            </div>

            <Button
                onClick={() => setStep(2)}
                className="w-full h-14 text-lg rounded-2xl bg-primary hover:bg-primary/80 shadow-lg shadow-blue-900/20 mt-4"
            >
                ถัดไป
            </Button>
        </div >
    );

    const renderStep2 = () => (
        <div className="space-y-6">
            <div className="bg-white rounded-3xl p-4 shadow-lg border border-gray-100">
                <div className="w-full aspect-[3/4] bg-gray-100 rounded-2xl overflow-hidden mb-4 relative shadow-inner">
                    {!photo ? (
                        <>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                            />
                            {!cameraActive && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                    <Camera className="w-16 h-16 mb-2 opacity-50" />
                                    <p>กด "เปิดกล้อง" เพื่อถ่ายรูป</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <img src={photo} alt="Captured" className="w-full h-full object-cover" />
                    )}
                    <canvas ref={canvasRef} className="hidden" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <Button
                        variant="outline"
                        onClick={startCamera}
                        className="h-12 rounded-xl border-gray-200"
                    >
                        {cameraActive ? "เริ่มใหม่" : "เปิดกล้อง"}
                    </Button>
                    <Button
                        onClick={capturePhoto}
                        disabled={!cameraActive}
                        className="h-12 bg-primary hover:bg-primary/80 text-white rounded-xl"
                    >
                        ถ่าย
                    </Button>
                    <Button
                        variant="outline"
                        onClick={switchCamera}
                        className="h-12 text-xs text-gray-600 border-gray-200 hover:bg-gray-50 rounded-xl"
                    >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        สลับกล้อง
                    </Button>
                </div>
            </div>

            <div className="flex gap-4">
                <Button
                    variant="secondary"
                    onClick={() => setStep(1)}
                    className="flex-1 h-14 text-lg rounded-2xl bg-gray-200 hover:bg-gray-300 text-gray-700"
                >
                    กลับ
                </Button>
                <Button
                    onClick={() => setStep(3)}
                    disabled={!photo}
                    className="flex-1 h-14 text-lg rounded-2xl bg-primary hover:bg-primary/80 shadow-lg shadow-blue-900/20"
                >
                    ถัดไป
                </Button>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100 text-center">
                <h2 className="text-xl font-bold text-gray-800 mb-1">ยืนยันการลงเวลา</h2>
                <p className="text-gray-500 text-sm mb-6">ตรวจสอบตำแหน่งของคุณ</p>

                <Button
                    onClick={getLocation}
                    disabled={locationLoading}
                    className="w-full h-14 text-lg rounded-2xl bg-blue-50 text-[#0047BA] hover:bg-blue-100 mb-6 border border-blue-100"
                >
                    {locationLoading ? "กำลังระบุตำแหน่ง..." : "แสดงที่อยู่ของคุณ"}
                </Button>

                {location ? (
                    <div className="bg-gray-50 rounded-2xl p-4 text-left">
                        <div className="w-full h-32 bg-gray-200 rounded-xl mb-3 overflow-hidden relative">
                            <iframe
                                width="100%"
                                height="100%"
                                frameBorder="0"
                                style={{ border: 0 }}
                                src={`https://www.google.com/maps?q=${location.lat},${location.lng}&output=embed`}
                                allowFullScreen
                            ></iframe>
                        </div>
                        <div className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-gray-800 text-sm">พิกัดปัจจุบัน</p>
                                <p className="text-gray-600 text-xs mt-0.5">{location.address}</p>
                            </div>
                        </div>

                        {/* Distance Warning */}
                        {distance !== null && locationConfig?.enabled && (
                            <div className={`mt-3 p-3 rounded-xl flex items-start gap-2 ${isLocationValid ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                                {isLocationValid ? (
                                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                                ) : (
                                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                                )}
                                <div className="text-xs w-full">
                                    <p className={`font-bold ${isLocationValid ? "text-green-700" : "text-red-700"}`}>
                                        {isLocationValid ? "อยู่ในพื้นที่ทำงาน" : "อยู่นอกพื้นที่ทำงาน"}
                                    </p>
                                    <p className="text-gray-600 mt-0.5">
                                        ห่างจากจุดเช็คอิน {distance < 1000 ? `${Math.round(distance)} เมตร` : `${(distance / 1000).toFixed(2)} กม.`}
                                    </p>

                                    {!isLocationValid && (
                                        <div className="mt-3">
                                            <label className="block text-gray-700 font-medium mb-1">ระบุเหตุผล:</label>
                                            <textarea
                                                value={locationNote}
                                                onChange={(e) => setLocationNote(e.target.value)}
                                                placeholder="เช่น ไปพบลูกค้า, ทำงานนอกสถานที่"
                                                className="w-full p-2 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                                                rows={2}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-32 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <MapPin className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-sm">ยังไม่มีข้อมูลตำแหน่ง</p>
                    </div>
                )}
            </div>

            <div className="flex gap-4">
                <Button
                    variant="secondary"
                    onClick={() => setStep(2)}
                    className="w-1/3 h-14 text-lg rounded-2xl bg-gray-200 hover:bg-gray-300 text-gray-700"
                >
                    กลับ
                </Button>
                <Button
                    onClick={handleSubmit}
                    disabled={loading || !location || showSuccess || (!isLocationValid && !locationNote.trim())}
                    className="w-2/3 h-14 text-lg rounded-2xl bg-primary hover:bg-primary/80 shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? "กำลังบันทึก..." : showSuccess ? "สำเร็จ!" : "ยืนยัน"}
                </Button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 pb-10">
            <EmployeeHeader />
            <div className="container mx-auto px-4 pt-6 max-w-md">
                {/* Success Notification */}
                {showSuccess && (
                    <div className="fixed top-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-top-10 fade-in duration-300">
                        <div className="bg-primary text-white border border-primary px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 mx-auto max-w-sm">
                            <div className="p-2 bg-white/20 rounded-full">
                                <CheckCircle className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">บันทึกสำเร็จ!</h3>
                                <p className="text-white/90 text-sm">ระบบได้บันทึกเวลาของคุณแล้ว</p>
                            </div>
                        </div>
                    </div>
                )}

                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
            </div>

            <CustomAlert
                isOpen={alertState.isOpen}
                onClose={closeAlert}
                title={alertState.title}
                message={alertState.message}
                type={alertState.type}
            />
        </div>
    );
}
