import React from "react";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    searchPlaceholder?: string;
    action?: React.ReactNode;
}

export function PageHeader({
    title,
    subtitle,
    searchPlaceholder = "Search...",
    action
}: PageHeaderProps) {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
                {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
            </div>

            <div className="flex items-center gap-4">
                {action}
            </div>
        </div>
    );
}
