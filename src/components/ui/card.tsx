import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
}

export function Card({ children, className, ...props }: CardProps) {
    return (
        <div
            className={cn(
                "glass-card p-6 border border-white/20 shadow-sm rounded-2xl",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}
