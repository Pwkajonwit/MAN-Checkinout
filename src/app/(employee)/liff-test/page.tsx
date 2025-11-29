"use client";

import { useState, useEffect } from "react";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface LogEntry {
    type: "success" | "error" | "info";
    message: string;
    timestamp: Date;
}

export default function LiffTestPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [liffStatus, setLiffStatus] = useState<"loading" | "success" | "error">("loading");
    const [userProfile, setUserProfile] = useState<any>(null);
    const [liffInfo, setLiffInfo] = useState<any>(null);

    const addLog = (type: "success" | "error" | "info", message: string) => {
        setLogs(prev => [...prev, { type, message, timestamp: new Date() }]);
        console.log(`[${type.toUpperCase()}]`, message);
    };

    const initLiff = async () => {
        try {
            addLog("info", "🚀 Starting LIFF initialization...");

            // Check if LIFF SDK is loaded
            if (!window.liff) {
                addLog("error", "❌ LIFF SDK not loaded");
                setLiffStatus("error");
                return;
            }
            addLog("success", "✅ LIFF SDK loaded successfully");

            const liff = window.liff;

            // Check LIFF ID
            const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
            if (!liffId) {
                addLog("error", "❌ LIFF ID not found in environment variables");
                setLiffStatus("error");
                return;
            }
            addLog("success", `✅ LIFF ID found: ${liffId}`);

            // Initialize LIFF
            addLog("info", "🔄 Initializing LIFF...");
            await liff.init({ liffId });
            addLog("success", "✅ LIFF initialized successfully");

            // Get LIFF info
            const info = {
                isInClient: liff.isInClient(),
                isLoggedIn: liff.isLoggedIn(),
                os: liff.getOS(),
                language: liff.getLanguage(),
                version: liff.getVersion(),
                lineVersion: liff.getLineVersion(),
                isApiAvailable: {
                    shareTargetPicker: liff.isApiAvailable('shareTargetPicker'),
                    getProfile: liff.isApiAvailable('getProfile'),
                }
            };
            setLiffInfo(info);
            addLog("info", `📱 Is in LINE app: ${info.isInClient}`);
            addLog("info", `🔐 Is logged in: ${info.isLoggedIn}`);
            addLog("info", `💻 OS: ${info.os}`);
            addLog("info", `🌐 Language: ${info.language}`);
            addLog("info", `📦 LIFF Version: ${info.version}`);

            // Check login status
            if (liff.isLoggedIn()) {
                addLog("success", "✅ User is logged in");

                // Get user profile
                addLog("info", "🔄 Getting user profile...");
                const profile = await liff.getProfile();
                setUserProfile(profile);
                addLog("success", `✅ User profile retrieved: ${profile.displayName}`);
                addLog("info", `👤 User ID: ${profile.userId}`);
                addLog("info", `📧 Status Message: ${profile.statusMessage || 'N/A'}`);
            } else {
                addLog("info", "ℹ️ User is not logged in");

                if (!liff.isInClient()) {
                    addLog("info", "ℹ️ Not in LINE app - Login required");
                    addLog("info", "💡 Click 'Login with LINE' button to proceed");
                }
            }

            setLiffStatus("success");
        } catch (error: any) {
            addLog("error", `❌ LIFF Initialization failed: ${error.message || error}`);
            console.error("LIFF Error:", error);
            setLiffStatus("error");
        }
    };

    const handleLogin = () => {
        if (window.liff && !window.liff.isLoggedIn()) {
            addLog("info", "🔄 Redirecting to LINE login...");
            window.liff.login();
        }
    };

    const handleLogout = () => {
        if (window.liff && window.liff.isLoggedIn()) {
            addLog("info", "🔄 Logging out...");
            window.liff.logout();
            window.location.reload();
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-6">
            <Script
                src="https://static.line-scdn.net/liff/edge/2/sdk.js"
                onLoad={initLiff}
            />

            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Link href="/">
                    <Button variant="ghost" size="icon" className="p-0 hover:bg-transparent">
                        <ArrowLeft className="w-6 h-6 text-gray-400" />
                    </Button>
                </Link>
                <h1 className="text-2xl font-bold text-[#0047BA]">LIFF Test Page</h1>
            </div>

            {/* Status Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">LIFF Status</h2>
                <div className="flex items-center gap-3">
                    {liffStatus === "loading" && (
                        <>
                            <div className="w-8 h-8 border-4 border-[#0047BA] border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-gray-600">Initializing LIFF...</span>
                        </>
                    )}
                    {liffStatus === "success" && (
                        <>
                            <CheckCircle className="w-8 h-8 text-green-500" />
                            <span className="text-green-600 font-medium">LIFF Initialized Successfully</span>
                        </>
                    )}
                    {liffStatus === "error" && (
                        <>
                            <XCircle className="w-8 h-8 text-red-500" />
                            <span className="text-red-600 font-medium">LIFF Initialization Failed</span>
                        </>
                    )}
                </div>
            </div>

            {/* LIFF Info Card */}
            {liffInfo && (
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">LIFF Information</h2>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">In LINE App:</span>
                            <span className={liffInfo.isInClient ? "text-green-600 font-medium" : "text-orange-600 font-medium"}>
                                {liffInfo.isInClient ? "Yes" : "No"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Logged In:</span>
                            <span className={liffInfo.isLoggedIn ? "text-green-600 font-medium" : "text-orange-600 font-medium"}>
                                {liffInfo.isLoggedIn ? "Yes" : "No"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">OS:</span>
                            <span className="text-gray-800 font-medium">{liffInfo.os}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Language:</span>
                            <span className="text-gray-800 font-medium">{liffInfo.language}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">LIFF Version:</span>
                            <span className="text-gray-800 font-medium">{liffInfo.version}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* User Profile Card */}
            {userProfile && (
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">User Profile</h2>
                    <div className="flex items-center gap-4 mb-4">
                        {userProfile.pictureUrl && (
                            <img
                                src={userProfile.pictureUrl}
                                alt="Profile"
                                className="w-16 h-16 rounded-full object-cover"
                            />
                        )}
                        <div>
                            <div className="font-semibold text-gray-800">{userProfile.displayName}</div>
                            <div className="text-sm text-gray-600">{userProfile.statusMessage || "No status"}</div>
                        </div>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">User ID:</span>
                            <span className="text-gray-800 font-mono text-xs">{userProfile.userId}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            {liffStatus === "success" && (
                <div className="space-y-3 mb-6">
                    {!liffInfo?.isLoggedIn && (
                        <Button
                            onClick={handleLogin}
                            className="w-full h-12 text-lg font-medium rounded-xl bg-[#06C755] hover:bg-[#05b34b] text-white"
                        >
                            Login with LINE
                        </Button>
                    )}
                    {liffInfo?.isLoggedIn && (
                        <Button
                            onClick={handleLogout}
                            variant="outline"
                            className="w-full h-12 text-lg font-medium rounded-xl border-2 border-gray-300"
                        >
                            Logout
                        </Button>
                    )}
                </div>
            )}

            {/* Logs Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Console Logs</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {logs.length === 0 ? (
                        <div className="text-center text-gray-400 py-8">
                            <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No logs yet...</p>
                        </div>
                    ) : (
                        logs.map((log, index) => (
                            <div
                                key={index}
                                className={`p-3 rounded-lg text-sm font-mono ${log.type === "success"
                                        ? "bg-green-50 text-green-800"
                                        : log.type === "error"
                                            ? "bg-red-50 text-red-800"
                                            : "bg-blue-50 text-blue-800"
                                    }`}
                            >
                                <div className="flex justify-between items-start gap-2">
                                    <span className="flex-1 break-all">{log.message}</span>
                                    <span className="text-xs opacity-60 whitespace-nowrap">
                                        {formatTime(log.timestamp)}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Environment Info */}
            <div className="mt-6 p-4 bg-gray-100 rounded-xl text-xs text-gray-600 font-mono">
                <div>LIFF ID: {process.env.NEXT_PUBLIC_LIFF_ID || "Not set"}</div>
                <div>Environment: {process.env.NODE_ENV}</div>
            </div>
        </div>
    );
}
