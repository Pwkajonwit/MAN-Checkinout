// Work time configuration
export const WORK_TIME_CONFIG = {
    // เวลาเข้างานมาตรฐาน (09:00)
    standardCheckIn: {
        hour: 9,
        minute: 0,
    },

    // เวลาออกงานมาตรฐาน (18:00)
    standardCheckOut: {
        hour: 18,
        minute: 0,
    },

    // ระยะเวลาที่ยอมให้สาย (นาที)
    lateGracePeriod: 0, // 0 นาที = ถ้าเกิน 09:00 ถือว่าสาย

    // ระยะเวลาขั้นต่ำสำหรับโอที (นาที)
    minOTMinutes: 30, // ต้องทำงานเกิน 18:00 อย่างน้อย 30 นาที
};

/**
 * ตรวจสอบว่าเข้างานสายหรือไม่
 * @param checkInTime เวลาที่เข้างานจริง
 * @returns true ถ้าสาย
 */
export function isLate(checkInTime: Date): boolean {
    const standardTime = new Date(checkInTime);
    standardTime.setHours(
        WORK_TIME_CONFIG.standardCheckIn.hour,
        WORK_TIME_CONFIG.standardCheckIn.minute,
        0,
        0
    );

    // เพิ่ม grace period
    standardTime.setMinutes(
        standardTime.getMinutes() + WORK_TIME_CONFIG.lateGracePeriod
    );

    return checkInTime > standardTime;
}

/**
 * คำนวณจำนวนนาทีที่สาย
 * @param checkInTime เวลาที่เข้างานจริง
 * @returns จำนวนนาทีที่สาย (0 ถ้าไม่สาย)
 */
export function getLateMinutes(checkInTime: Date): number {
    if (!isLate(checkInTime)) return 0;

    const standardTime = new Date(checkInTime);
    standardTime.setHours(
        WORK_TIME_CONFIG.standardCheckIn.hour,
        WORK_TIME_CONFIG.standardCheckIn.minute,
        0,
        0
    );

    const diffMs = checkInTime.getTime() - standardTime.getTime();
    return Math.floor(diffMs / (1000 * 60));
}

/**
 * ตรวจสอบว่ามีสิทธิ์ขอโอทีหรือไม่
 * @param checkOutTime เวลาที่ออกงานจริง
 * @returns true ถ้าทำงานเกินเวลาและมีสิทธิ์ขอโอที
 */
export function isEligibleForOT(checkOutTime: Date): boolean {
    const standardTime = new Date(checkOutTime);
    standardTime.setHours(
        WORK_TIME_CONFIG.standardCheckOut.hour,
        WORK_TIME_CONFIG.standardCheckOut.minute,
        0,
        0
    );

    if (checkOutTime <= standardTime) return false;

    const otMinutes = getOTMinutes(checkOutTime);
    return otMinutes >= WORK_TIME_CONFIG.minOTMinutes;
}

/**
 * คำนวณจำนวนนาทีโอที
 * @param checkOutTime เวลาที่ออกงานจริง
 * @returns จำนวนนาทีโอที (0 ถ้าไม่มี)
 */
export function getOTMinutes(checkOutTime: Date): number {
    const standardTime = new Date(checkOutTime);
    standardTime.setHours(
        WORK_TIME_CONFIG.standardCheckOut.hour,
        WORK_TIME_CONFIG.standardCheckOut.minute,
        0,
        0
    );

    if (checkOutTime <= standardTime) return 0;

    const diffMs = checkOutTime.getTime() - standardTime.getTime();
    return Math.floor(diffMs / (1000 * 60));
}

/**
 * แปลงนาทีเป็นรูปแบบ "X ชม. Y นาที"
 * @param minutes จำนวนนาที
 * @returns string เช่น "1 ชม. 30 นาที"
 */
export function formatMinutesToHours(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) {
        return `${mins} นาที`;
    } else if (mins === 0) {
        return `${hours} ชม.`;
    } else {
        return `${hours} ชม. ${mins} นาที`;
    }
}

/**
 * ดึงเวลามาตรฐานเข้างานในรูปแบบ string
 * @returns "09:00"
 */
export function getStandardCheckInTime(): string {
    const { hour, minute } = WORK_TIME_CONFIG.standardCheckIn;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

/**
 * ดึงเวลามาตรฐานออกงานในรูปแบบ string
 * @returns "18:00"
 */
export function getStandardCheckOutTime(): string {
    const { hour, minute } = WORK_TIME_CONFIG.standardCheckOut;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}
