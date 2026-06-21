import { cn } from "@/lib/utils";

interface StatsCardProps {
    title: string;
    value: string | number;
    icon?: React.ReactNode;
    trend?: "up" | "down" | "neutral";
    className?: string;
    onClick?: () => void;
    isActive?: boolean;
}

export function StatsCard({ title, value, icon, trend, className, onClick, isActive }: StatsCardProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "bg-white p-3 px-4 rounded-xl shadow-sm border transition-all",
                onClick ? "cursor-pointer hover:shadow-md hover:border-blue-400" : "",
                isActive ? "border-blue-600 ring-1 ring-blue-600 bg-blue-50/50" : "border-gray-300",
                className
            )}
        >
            <div className="flex items-center justify-between mb-1">
                <h3 className={cn("text-sm font-semibold", isActive ? "text-blue-700" : "text-gray-700")}>{title}</h3>
                {icon && <div className={cn("w-4 h-4", isActive ? "text-blue-600" : "text-gray-500")}>{icon}</div>}
            </div>
            <div className="flex items-end gap-2">
                <span className={cn("text-base font-bold", isActive ? "text-blue-800" : "text-gray-900")}>{value}</span>
                {trend && (
                    <span className={cn(
                        "mb-0.5 text-[10px] font-bold",
                        trend === "down" ? "text-red-600" : "text-green-600"
                    )}>
                        {trend === "down" ? "▼" : "▲"}
                    </span>
                )}
            </div>
        </div>
    );
}
