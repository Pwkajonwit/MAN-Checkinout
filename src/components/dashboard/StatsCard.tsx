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
                "bg-white p-6 rounded-2xl shadow-sm border transition-all",
                onClick ? "cursor-pointer hover:shadow-md hover:border-blue-300" : "",
                isActive ? "border-blue-500 ring-2 ring-blue-200 bg-blue-50" : "border-gray-100",
                className
            )}
        >
            <div className="flex items-center justify-between mb-2">
                <h3 className={cn("text-sm font-medium", isActive ? "text-blue-600" : "text-gray-500")}>{title}</h3>
                {icon && <div className={isActive ? "text-blue-500" : "text-gray-400"}>{icon}</div>}
            </div>
            <div className="flex items-end gap-2">
                <span className={cn("text-3xl font-bold", isActive ? "text-blue-700" : "text-gray-800")}>{value}</span>
                {trend && (
                    <span className={cn(
                        "mb-1 text-xs font-medium",
                        trend === "down" ? "text-red-500" : "text-green-500"
                    )}>
                        {trend === "down" ? "▼" : "▲"}
                    </span>
                )}
            </div>
        </div>
    );
}
