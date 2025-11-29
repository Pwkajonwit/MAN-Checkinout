"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MapPin, Camera, RotateCcw, CheckCircle, Clock } from "lucide-react";
import { attendanceService, systemConfigService } from "@/lib/firestore";
import { isLate, getLateMinutes, isEligibleForOT, getOTMinutes, formatMinutesToHours } from "@/lib/workTime";
import { useEmployee } from "@/contexts/EmployeeContext";
import { EmployeeHeader } from "@/components/mobile/EmployeeHeader";
import { uploadAttendancePhoto } from "@/lib/storage";

export default function CheckInPage() {
    const router = useRouter();
    const { employee } = useEmployee();
    const [step, setStep] = useState(1);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Step 1 Data
    const [checkInType, setCheckInType] = useState<"เข้างาน" | "ออกงาน" | "ระหว่างวัน">("เข้างาน");
    const [canCheckIn, setCanCheckIn] = useState(true);
    const [canCheckOut, setCanCheckOut] = useState(false);
    const [canCheckMidDay, setCanCheckMidDay] = useState(false);

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

    // Settings
    const [requirePhoto, setRequirePhoto] = useState(true);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Check status on load
    useEffect(() => {
        if (employee?.id) {
            checkTodayStatus();
        }
    }, [employee]);

    // Cleanup camera on unmount
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    // Load settings
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const config = await systemConfigService.get();
                if (config) {
                    setRequirePhoto(config.requirePhoto ?? true);
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
                .filter(h => h.status === "เข้างาน" || h.status === "ออกงาน")
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            if (mainActions.length > 0) {
                const lastAction = mainActions[0];
                if (lastAction.status === "เข้างาน") {
                    setCanCheckIn(false);
                    setCanCheckOut(true);
                    setCanCheckMidDay(true);
                    setCheckInType("ออกงาน");
                } else {
                    setCanCheckIn(true);
                    setCanCheckOut(false);
                    setCanCheckMidDay(false);
                    setCheckInType("เข้างาน");
                }
            } else {
                setCanCheckIn(true);
                setCanCheckOut(false);
                setCanCheckMidDay(false);
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
            alert("ไม่สามารถเข้าถึงกล้องได้");
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
                    alert("ไม่สามารถระบุตำแหน่งได้");
                    setLocationLoading(false);
                }
            );
        } else {
            alert("Browser ไม่รองรับ Geolocation");
            setLocationLoading(false);
        }
    };

    const sendFlexMessage = async (type: string, time: Date, location: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const liff = (window as any).liff;
        if (liff && liff.isInClient()) {
            try {
                // Calculate Late or OT status
                let statusText = "";
                let statusColor = "#666666";

                if (type === "เข้างาน" && isLate(time)) {
                    const lateMinutes = getLateMinutes(time);
                    statusText = `สาย ${formatMinutesToHours(lateMinutes)}`;
                    statusColor = "#ef4444"; // Red
                } else if (type === "ออกงาน" && isEligibleForOT(time)) {
                    const otMinutes = getOTMinutes(time);
                    statusText = `ล่วงเวลา ${formatMinutesToHours(otMinutes)}`;
                    statusColor = "#a855f7"; // Purple
                } else if (type === "เข้างาน") {
                    statusText = "ปกติ";
                    statusColor = "#22c55e"; // Green
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
                                flex: 1
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
                                flex: 1
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
                            flex: 1
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
            alert("ไม่พบข้อมูลพนักงาน");
            return;
        }
        if (!location) {
            alert("กรุณาระบุตำแหน่ง");
            return;
        }

        setLoading(true);
        try {
            const now = new Date();

            // Upload photo to Firebase Storage logic
            let photoURL: string | null = null;

            if (requirePhoto) {
                if (photo && employee?.id) {
                    try {
                        photoURL = await uploadAttendancePhoto(employee.id, photo);
                    } catch (uploadError) {
                        console.error("Error uploading photo:", uploadError);
                        alert("เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ กรุณาลองใหม่อีกครั้ง");
                        setLoading(false);
                        return; // Stop if photo is required but failed
                    }
                } else {
                    // requirePhoto is true but no photo data
                    alert("กรุณาถ่ายรูปก่อนบันทึกเวลา");
                    setLoading(false);
                    return;
                }
            } else {
                // requirePhoto is false
                console.log("Photo upload skipped (requirePhoto is false)");
                // photoURL remains null
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
                    longitude: location.lng
                };

                // Conditionally add optional fields
                if (checkInType === "เข้างาน" || checkInType === "ระหว่างวัน") {
                    attendanceData.checkIn = now;
                }

                if (checkInType === "ออกงาน") {
                    attendanceData.checkOut = now;
                }

                if (photoURL) {
                    attendanceData.photo = photoURL;
                }

                await attendanceService.create(attendanceData);
            } catch (dbError) {
                console.error("Error saving to database:", dbError);
                alert("เกิดข้อผิดพลาดในการบันทึกข้อมูลลงฐานข้อมูล: " + (dbError instanceof Error ? dbError.message : "Unknown error"));
                setLoading(false);
                return;
            }

            // Send Flex Message (Non-blocking)
            try {
                await sendFlexMessage(checkInType, now, location.address);
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
            }, 2000);

        } catch (error) {
            console.error("Unexpected error submitting:", error);
            alert("เกิดข้อผิดพลาดที่ไม่คาดคิด: " + (error instanceof Error ? error.message : "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

    // --- Render Steps ---

    const renderStep1 = () => (
        <div className="space-y-6">
            {/* Clock Card */}
            <div className="bg-white rounded-3xl p-6 shadow-lg border border-blue-50 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-[#00338D] mb-3">
                    <Clock className="w-6 h-6" />
                </div>
                <h2 className="text-4xl font-bold text-gray-800 tracking-tight">
                    {currentTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </h2>
                <p className="text-gray-500 mt-1">
                    {currentTime.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
            </div>

            {/* Type Selection */}
            <div className="grid grid-cols-1 gap-4">
                <button
                    onClick={() => canCheckIn && setCheckInType("เข้างาน")}
                    disabled={!canCheckIn}
                    className={`w-full p-5 rounded-2xl border transition-all font-bold text-lg flex items-center justify-between group ${checkInType === "เข้างาน"
                        ? "border-green-500 bg-green-50 text-green-700 shadow-md ring-1 ring-green-500"
                        : canCheckIn
                            ? "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                            : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60"
                        }`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full ${checkInType === "เข้างาน" ? "bg-green-500" : "bg-gray-300"}`} />
                        <span>เข้างาน</span>
                    </div>
                    {checkInType === "เข้างาน" && <CheckCircle className="w-5 h-5 text-green-600" />}
                </button>

                <button
                    onClick={() => canCheckOut && setCheckInType("ออกงาน")}
                    disabled={!canCheckOut}
                    className={`w-full p-5 rounded-2xl border transition-all font-bold text-lg flex items-center justify-between group ${checkInType === "ออกงาน"
                        ? "border-red-500 bg-red-50 text-red-700 shadow-md ring-1 ring-red-500"
                        : canCheckOut
                            ? "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                            : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60"
                        }`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full ${checkInType === "ออกงาน" ? "bg-red-500" : "bg-gray-300"}`} />
                        <span>ออกงาน</span>
                    </div>
                    {checkInType === "ออกงาน" && <CheckCircle className="w-5 h-5 text-red-600" />}
                </button>

                <button
                    onClick={() => canCheckMidDay && setCheckInType("ระหว่างวัน")}
                    disabled={!canCheckMidDay}
                    className={`w-full p-5 rounded-2xl border transition-all font-bold text-lg flex items-center justify-between group ${checkInType === "ระหว่างวัน"
                        ? "border-orange-500 bg-orange-50 text-orange-700 shadow-md ring-1 ring-orange-500"
                        : canCheckMidDay
                            ? "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                            : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60"
                        }`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full ${checkInType === "ระหว่างวัน" ? "bg-orange-500" : "bg-gray-300"}`} />
                        <span>ระหว่างวัน</span>
                    </div>
                    {checkInType === "ระหว่างวัน" && <CheckCircle className="w-5 h-5 text-orange-600" />}
                </button>
            </div>

            <Button
                onClick={() => setStep(2)}
                className="w-full h-14 text-lg rounded-2xl bg-[#0047BA] hover:bg-[#00338D] shadow-lg shadow-blue-900/20 mt-4"
            >
                ถัดไป
            </Button>
        </div>
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
                        className="h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl"
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
                    className="flex-1 h-14 text-lg rounded-2xl bg-[#0047BA] hover:bg-[#00338D] shadow-lg shadow-blue-900/20"
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
                    disabled={loading || !location || showSuccess}
                    className="w-2/3 h-14 text-lg rounded-2xl bg-[#0047BA] hover:bg-[#00338D] shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? "กำลังบันทึก..." : showSuccess ? "สำเร็จ!" : "ยืนยัน"}
                </Button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 pb-10">
            <EmployeeHeader />

            {/* Success Notification */}
            {showSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-[#1DB446] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 max-w-xs animate-in zoom-in-95 duration-300">
                        <div className="p-2 bg-white/20 rounded-full">
                            <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base">บันทึกสำเร็จ!</h3>
                            <p className="text-white/90 text-xs">บันทึกเวลาเรียบร้อย</p>
                        </div>
                    </div>
                </div>
            )}

            <main className="px-6 -mt-6 relative z-10">
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
            </main>
        </div>
    );
}
