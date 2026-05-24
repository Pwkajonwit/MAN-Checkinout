import { format } from "date-fns";
import { th } from "date-fns/locale";
import { type LeaveRequest } from "@/lib/firestore";

export const HOURS_PER_LEAVE_DAY = 8;

type DateLike = Date | string | number | { toDate: () => Date };

function toDateValue(value: DateLike) {
    if (value instanceof Date) return value;
    if (typeof value === "object" && value && "toDate" in value) return value.toDate();
    return new Date(value);
}

export function isHourlyLeave(leave: Pick<LeaveRequest, "durationUnit">) {
    return leave.durationUnit === "hour";
}

export function getLeaveDayUnits(leave: Pick<LeaveRequest, "durationUnit" | "startDate" | "endDate" | "totalHours">) {
    if (isHourlyLeave(leave)) {
        return Math.max(0, (Number(leave.totalHours) || 0) / HOURS_PER_LEAVE_DAY);
    }

    const start = toDateValue(leave.startDate);
    const end = toDateValue(leave.endDate);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

export function formatLeaveDuration(leave: Pick<LeaveRequest, "durationUnit" | "startDate" | "endDate" | "totalHours">) {
    if (isHourlyLeave(leave)) {
        return formatLeaveDayHourUnits(getLeaveDayUnits(leave));
    }

    return `${getLeaveDayUnits(leave)} วัน`;
}

export function formatLeaveUnitValue(value: number) {
    return Number(value || 0).toFixed(2).replace(/\.?0+$/, "");
}

export function formatLeaveDayHourUnits(dayUnits: number) {
    const totalHours = Math.max(0, Number(dayUnits) || 0) * HOURS_PER_LEAVE_DAY;
    const wholeDays = Math.floor(totalHours / HOURS_PER_LEAVE_DAY);
    const remainingHours = totalHours - (wholeDays * HOURS_PER_LEAVE_DAY);

    return `${wholeDays} วัน ${formatLeaveUnitValue(remainingHours)} ชั่วโมง`;
}

export function formatLeaveDateRange(leave: Pick<LeaveRequest, "durationUnit" | "startDate" | "endDate" | "startTime" | "endTime">) {
    const start = toDateValue(leave.startDate);
    const end = toDateValue(leave.endDate);

    if (isHourlyLeave(leave)) {
        return `${format(start, "d MMM yyyy", { locale: th })} ${leave.startTime || "--:--"}-${leave.endTime || "--:--"}`;
    }

    return `${format(start, "d MMM yyyy", { locale: th })} - ${format(end, "d MMM yyyy", { locale: th })}`;
}
