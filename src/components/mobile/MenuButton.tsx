import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface MenuButtonProps {
    label: string;
    href: string;
    className?: string;
    icon?: React.ReactNode;
}

export function MenuButton({ label, href, className, icon }: MenuButtonProps) {
    return (
        <Link href={href} className="w-full">
            <Button
                className={cn(
                    "w-full aspect-square flex flex-col items-center justify-center text-xl font-semibold rounded-2xl shadow-lg transition-all duration-200 active:scale-95 hover:shadow-xl",
                    "bg-primary text-white",
                    className
                )}
            >
                {icon && <div className="mb-2">{icon}</div>}
                <span className="text-white drop-shadow-sm">{label}</span>
            </Button>
        </Link>
    );
}
