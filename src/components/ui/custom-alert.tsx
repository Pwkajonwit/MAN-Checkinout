"use client";

import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface CustomAlertProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: "success" | "error" | "warning" | "info";
}

export function CustomAlert({ isOpen, onClose, title, message, type = "info" }: CustomAlertProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    if (!mounted || !isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case "success":
                return <CheckCircle className="w-12 h-12 text-green-500" />;
            case "error":
                return <AlertCircle className="w-12 h-12 text-red-500" />;
            case "warning":
                return <AlertTriangle className="w-12 h-12 text-orange-500" />;
            default:
                return <Info className="w-12 h-12 text-blue-500" />;
        }
    };

    const getButtonColor = () => {
        switch (type) {
            case "success":
                return "bg-green-500 hover:bg-green-600";
            case "error":
                return "bg-red-500 hover:bg-red-600";
            case "warning":
                return "bg-orange-500 hover:bg-orange-600";
            default:
                return "bg-blue-500 hover:bg-blue-600";
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 flex flex-col items-center text-center">
                    <div className="mb-4 p-3 rounded-full bg-gray-50">
                        {getIcon()}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {title}
                    </h3>
                    <p className="text-gray-500 mb-6 leading-relaxed">
                        {message}
                    </p>
                    <button
                        onClick={onClose}
                        className={`w-full py-3.5 rounded-xl text-white font-semibold shadow-lg transition-transform active:scale-95 ${getButtonColor()}`}
                    >
                        ตกลง
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
