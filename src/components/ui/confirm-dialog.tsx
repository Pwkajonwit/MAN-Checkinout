"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, HelpCircle } from "lucide-react";

interface ConfirmDialogProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: "danger" | "warning" | "info";
}

export function ConfirmDialog({
    isOpen,
    onConfirm,
    onCancel,
    title,
    message,
    confirmText = "ยืนยัน",
    cancelText = "ยกเลิก",
    type = "info"
}: ConfirmDialogProps) {
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
            case "danger":
                return <AlertTriangle className="w-10 h-10 text-red-500" />;
            case "warning":
                return <AlertTriangle className="w-10 h-10 text-orange-500" />;
            default:
                return <HelpCircle className="w-10 h-10 text-blue-500" />;
        }
    };

    const getConfirmButtonColor = () => {
        switch (type) {
            case "danger":
                return "bg-red-500 hover:bg-red-600";
            case "warning":
                return "bg-orange-500 hover:bg-orange-600";
            default:
                return "bg-blue-600 hover:bg-blue-700";
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 flex flex-col items-center text-center">
                    <div className="mb-4 p-3 rounded-full bg-gray-50">
                        {getIcon()}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                        {title}
                    </h3>
                    <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                        {message}
                    </p>
                    <div className="flex gap-3 w-full">
                        <button
                            onClick={onCancel}
                            className="flex-1 py-3 rounded-xl text-gray-700 font-semibold bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`flex-1 py-3 rounded-xl text-white font-semibold shadow-lg transition-transform active:scale-95 ${getConfirmButtonColor()}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
