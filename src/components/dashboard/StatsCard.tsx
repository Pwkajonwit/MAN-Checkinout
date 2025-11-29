import { cn } from "@/lib/utils";

interface StatsCardProps {
    title: string;
    value: string | number;
    icon?: React.ReactNode;
    trend?: "up" | "down" | "neutral";
    className?: string;
}

export function StatsCard({ title, value, icon, trend, className }: StatsCardProps) {
    return (
        <div className={cn("bg-white p-6 rounded-2xl shadow-sm border border-gray-100", className)}>
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
                {icon && <div className="text-gray-400">{icon}</div>}
            </div>
            <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-gray-800">{value}</span>
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
