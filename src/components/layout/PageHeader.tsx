import React from "react";
import { Search } from "lucide-react";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    searchPlaceholder?: string;
    onSearch?: (query: string) => void;
    action?: React.ReactNode;
}

export function PageHeader({
    title,
    subtitle,
    searchPlaceholder = "Search...",
    onSearch,
    action
}: PageHeaderProps) {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
                {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full md:w-auto">
                {onSearch && (
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder={searchPlaceholder}
                            onChange={(e) => onSearch(e.target.value)}
                            className="w-full md:w-64 pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EBDACA] focus:border-transparent text-sm"
                        />
                    </div>
                )}
                {action}
            </div>
        </div>
    );
}
