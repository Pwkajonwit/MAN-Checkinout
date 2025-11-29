"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

// Context for Select
const SelectContext = React.createContext<{
    value: string
    onValueChange: (value: string) => void
    open: boolean
    setOpen: (open: boolean) => void
} | null>(null)

const Select = ({ children, value, onValueChange }: { children: React.ReactNode, value?: string, onValueChange?: (val: string) => void }) => {
    const [open, setOpen] = React.useState(false)
    const [internalValue, setInternalValue] = React.useState(value || "")

    React.useEffect(() => {
        if (value !== undefined) setInternalValue(value)
    }, [value])

    const handleValueChange = (val: string) => {
        setInternalValue(val)
        if (onValueChange) onValueChange(val)
        setOpen(false)
    }

    return (
        <SelectContext.Provider value={{ value: internalValue, onValueChange: handleValueChange, open, setOpen }}>
            <div className="relative">{children}</div>
        </SelectContext.Provider>
    )
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ className, children, ...props }, ref) => {
        const context = React.useContext(SelectContext)
        if (!context) throw new Error("SelectTrigger must be used within Select")

        return (
            <button
                ref={ref}
                type="button"
                onClick={() => context.setOpen(!context.open)}
                className={cn(
                    "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                {...props}
            >
                {children}
                <ChevronDown className="h-4 w-4 opacity-50" />
            </button>
        )
    }
)
SelectTrigger.displayName = "SelectTrigger"

interface SelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {
    placeholder?: string;
}
const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>(
    ({ className, placeholder, ...props }, ref) => {
        const context = React.useContext(SelectContext)
        if (!context) throw new Error("SelectValue must be used within Select")

        return (
            <span ref={ref} className={cn("block truncate", className)} {...props}>
                {context.value || placeholder}
            </span>
        )
    }
)
SelectValue.displayName = "SelectValue"

interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
    position?: string;
}
const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
    ({ className, children, position = "popper", ...props }, ref) => {
        const context = React.useContext(SelectContext)
        if (!context) throw new Error("SelectContent must be used within Select")

        if (!context.open) return null

        return (
            <div
                ref={ref}
                className={cn(
                    "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-80 w-full mt-1 bg-white",
                    className
                )}
                {...props}
            >
                <div className="p-1">{children}</div>
            </div>
        )
    }
)
SelectContent.displayName = "SelectContent"

const SelectItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value: string }>(
    ({ className, children, value, ...props }, ref) => {
        const context = React.useContext(SelectContext)
        if (!context) throw new Error("SelectItem must be used within Select")

        const isSelected = context.value === value

        return (
            <div
                ref={ref}
                className={cn(
                    "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-gray-100 cursor-pointer",
                    className
                )}
                onClick={() => context.onValueChange(value)}
                {...props}
            >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    {isSelected && <Check className="h-4 w-4" />}
                </span>
                <span className="truncate">{children}</span>
            </div>
        )
    }
)
SelectItem.displayName = "SelectItem"

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
