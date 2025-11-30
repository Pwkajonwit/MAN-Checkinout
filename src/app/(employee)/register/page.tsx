"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { employeeService, systemConfigService } from "@/lib/firestore";
import { useEmployee } from "@/contexts/EmployeeContext";
import { CheckCircle, UserPlus, CreditCard, User, Briefcase, Mail, Phone, Link as LinkIcon } from "lucide-react";
import { Employee } from "@/lib/firestore";

export default function RegisterPage() {
    const router = useRouter();
    const { lineUserId, lineProfile, refreshEmployee } = useEmployee();
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [checking, setChecking] = useState(true);
    const [mode, setMode] = useState<"register" | "connect">("register");
    const [connectPhone, setConnectPhone] = useState("");

    const [formData, setFormData] = useState({
        employeeId: "",
        name: "",
        email: "",
        phone: "",
        position: "",
    });

    const [allowNewRegister, setAllowNewRegister] = useState(true);

    useEffect(() => {
        setMounted(true);
        const loadConfig = async () => {
            const config = await systemConfigService.get();
            if (config) {
                setAllowNewRegister(config.allowNewRegistration ?? true);
                if (config.allowNewRegistration === false) {
                    setMode("connect");
                }
            }
        };
        loadConfig();
    }, []);

    // Auto-fill name when lineProfile is available
    useEffect(() => {
        if (lineProfile && !formData.name) {
            setFormData(prev => ({
                ...prev,
                name: lineProfile.displayName || ""
            }));
        }
    }, [lineProfile]);

    // Check if employee already registered
    useEffect(() => {
        const checkEmployee = async () => {
            if (lineProfile?.userId) {
                try {
                    const existingEmployee = await employeeService.getByLineUserId(lineProfile.userId);
                    if (existingEmployee) {
                        router.push("/check-in");
                    } else {
                        setChecking(false);
                    }
                } catch (error) {
                    console.error("Error checking employee:", error);
                    setChecking(false);
                }
            } else {
                if (mounted && !lineUserId) {
                    setChecking(false);
                }
            }
        };

        if (mounted) {
            checkEmployee();
        }
    }, [lineProfile, lineUserId, mounted, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!lineUserId) {
                alert("ไม่พบข้อมูล LINE User ID กรุณาลองใหม่อีกครั้ง");
                setLoading(false);
                return;
            }

            // Double check if already registered
            const existingEmployee = await employeeService.getByLineUserId(lineUserId);
            if (existingEmployee) {
                alert("คุณได้ลงทะเบียนไปแล้ว");
                router.push("/check-in");
                return;
            }

            // Create new employee
            const employeeData: Omit<Employee, "id"> = {
                name: formData.name,
                lineUserId: lineUserId,
                employeeId: formData.employeeId,
                email: formData.email,
                phone: formData.phone,
                position: formData.position,
                role: "employee",
                type: "รายเดือน", // Default type
                status: "ทำงาน", // Default status: working
                registeredDate: new Date(),
                leaveQuota: {
                    sick: 30,
                    personal: 3,
                    vacation: 5
                }
            };

            await employeeService.create(employeeData);
            await refreshEmployee(); // Refresh context

            setShowSuccess(true);

            // Redirect after success
            setTimeout(() => {
                router.push("/check-in");
            }, 2000);

        } catch (error) {
            console.error("Registration error:", error);
            alert("เกิดข้อผิดพลาดในการลงทะเบียน");
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!lineUserId) {
                alert("ไม่พบข้อมูล LINE User ID กรุณาลองใหม่อีกครั้ง");
                setLoading(false);
                return;
            }

            // Find employee by phone
            const employee = await employeeService.getByPhone(connectPhone);

            if (!employee) {
                alert("ไม่พบเบอร์โทรศัพท์นี้ในระบบ");
                setLoading(false);
                return;
            }

            if (employee.lineUserId) {
                alert("เบอร์โทรศัพท์นี้ได้เชื่อมต่อกับ LINE อื่นไปแล้ว");
                setLoading(false);
                return;
            }

            if (employee.id) {
                await employeeService.update(employee.id, { lineUserId });
                await refreshEmployee(); // Refresh context
                setShowSuccess(true);
                setTimeout(() => {
                    router.push("/check-in");
                }, 2000);
            }

        } catch (error) {
            console.error("Connection error:", error);
            alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
        } finally {
            setLoading(false);
        }
    };

    if (!mounted || checking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
            {/* Success Notification */}
            {showSuccess && (
                <div className="fixed top-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-top-10 fade-in duration-300">
                    <div className="bg-[#1DB446] text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 mx-auto max-w-sm">
                        <div className="p-2 bg-white/20 rounded-full">
                            <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">ลงทะเบียนสำเร็จ!</h3>
                            <p className="text-white/90 text-sm">ยินดีต้อนรับเข้าสู่ระบบ</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">
                <div className="bg-[#0047BA] p-8 text-center text-white">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                        {mode === "register" ? (
                            <UserPlus className="w-10 h-10 text-white" />
                        ) : (
                            <LinkIcon className="w-10 h-10 text-white" />
                        )}
                    </div>
                    <h1 className="text-2xl font-bold">
                        {mode === "register" ? "ลงทะเบียนพนักงาน" : "เชื่อมต่อบัญชี"}
                    </h1>
                    <p className="text-blue-100 mt-1">
                        {mode === "register" ? "กรอกข้อมูลเพื่อเริ่มต้นใช้งาน" : "เชื่อมต่อข้อมูลด้วยเบอร์โทรศัพท์"}
                    </p>
                </div>

                {/* Mode Switcher */}
                <div className="flex border-b border-gray-100">
                    {allowNewRegister && (
                        <button
                            onClick={() => setMode("register")}
                            className={`flex-1 py-4 text-sm font-medium transition-colors ${mode === "register"
                                ? "text-[#0047BA] border-b-2 border-[#0047BA]"
                                : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            ลงทะเบียนใหม่
                        </button>
                    )}
                    <button
                        onClick={() => setMode("connect")}
                        className={`flex-1 py-4 text-sm font-medium transition-colors ${mode === "connect"
                            ? "text-[#0047BA] border-b-2 border-[#0047BA]"
                            : "text-gray-500 hover:text-gray-700"
                            }`}
                    >
                        มีบัญชีอยู่แล้ว
                    </button>
                </div>

                <div className="p-8">
                    {mode === "register" ? (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Form Fields */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">รหัสพนักงาน</label>
                                <div className="relative">
                                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        required
                                        placeholder="เช่น EMP001"
                                        value={formData.employeeId}
                                        onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                                        className="pl-10 h-12 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        required
                                        placeholder="กรอกชื่อ-นามสกุล"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="pl-10 h-12 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">อีเมล</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        type="email"
                                        placeholder="example@email.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="pl-10 h-12 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        type="tel"
                                        required
                                        placeholder="0xx-xxx-xxxx"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="pl-10 h-12 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">ตำแหน่ง <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        required
                                        placeholder="ระบุตำแหน่ง"
                                        value={formData.position}
                                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                        className="pl-10 h-12 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white transition-all"
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-14 text-lg rounded-2xl bg-[#0047BA] hover:bg-[#00338D] shadow-lg shadow-blue-900/20 mt-4"
                            >
                                {loading ? "กำลังลงทะเบียน..." : "ลงทะเบียน"}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleConnect} className="space-y-5">
                            <div className="text-center mb-6">
                                <p className="text-gray-500 text-sm">
                                    หากคุณมีรายชื่อในระบบแล้ว กรอกเบอร์โทรศัพท์เพื่อเชื่อมต่อบัญชี LINE
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        type="tel"
                                        required
                                        placeholder="0xx-xxx-xxxx"
                                        value={connectPhone}
                                        onChange={(e) => setConnectPhone(e.target.value)}
                                        className="pl-10 h-12 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white transition-all"
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-14 text-lg rounded-2xl bg-[#0047BA] hover:bg-[#00338D] shadow-lg shadow-blue-900/20 mt-4"
                            >
                                {loading ? "กำลังเชื่อมต่อ..." : "เชื่อมต่อบัญชี"}
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
