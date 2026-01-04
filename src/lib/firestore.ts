import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp
} from "firebase/firestore";
import { db } from "./firebase";

// Employee types
export interface Employee {
    id?: string;
    employeeId?: string;
    name: string;
    email?: string;
    phone: string;
    type: "รายเดือน" | "รายวัน" | "ชั่วคราว"; // Payment type
    employmentType?: "ประจำ" | "ชั่วคราว"; // Employment status
    position: string;
    registeredDate: Date;
    status: "ทำงาน" | "ลาออก" | "พ้นสภาพ";
    endDate?: Date;
    leaveQuota: {
        personal: number;
        sick: number;
        vacation: number;
    };
    department?: string;
    role?: string;
    createdAt?: Date;
    avatar?: string | null;
    lineUserId?: string;
    baseSalary?: number;
    weeklyHolidays?: number[]; // วันหยุดประจำสัปดาห์ (0=อาทิตย์, 1=จันทร์, ..., 6=เสาร์)
    shiftId?: string;           // ID ของกะเวลาทำงาน
}

// Attendance types
export interface Attendance {
    id?: string;
    employeeId: string;
    employeeName: string;
    date: Date;
    checkIn?: Date | null;
    checkOut?: Date | null;
    status: "เข้างาน" | "ออกงาน" | "ลางาน" | "สาย" | "ก่อนพัก" | "หลังพัก" | "ออกนอกพื้นที่ขาไป" | "ออกนอกพื้นที่ขากลับ";
    location?: string;
    photo?: string;
    latitude?: number;
    longitude?: number;
    locationNote?: string;
    distance?: number; // Distance from workplace in meters
    lateMinutes?: number; // จำนวนนาทีที่สาย
}

// Leave Request types
export interface LeaveRequest {
    id?: string;
    employeeId: string;
    employeeName: string;
    leaveType: "ลาพักร้อน" | "ลาป่วย" | "ลากิจ";
    startDate: Date;
    endDate: Date;
    reason: string;
    status: "รออนุมัติ" | "อนุมัติ" | "ไม่อนุมัติ";
    createdAt: Date;
    attachment?: string; // รูปภาพหลักฐาน (Base64)
}

// OT Request types
export interface OTRequest {
    id?: string;
    employeeId: string;
    employeeName: string;
    date: Date;
    startTime: Date;
    endTime: Date;
    reason: string;
    status: "รออนุมัติ" | "อนุมัติ" | "ไม่อนุมัติ";
    createdAt: Date;
}

// Swap Holiday Request types (ขอสลับวันหยุด)
export interface SwapRequest {
    id?: string;
    employeeId: string;
    employeeName: string;
    workDate: Date;      // วันหยุดปกติที่ขอมาทำงาน
    holidayDate: Date;   // วันทำงานปกติที่ขอหยุดแทน
    reason: string;
    status: "รออนุมัติ" | "อนุมัติ" | "ไม่อนุมัติ";
    createdAt: Date;
}

// Work Shift types (กะเวลาทำงาน)
export interface Shift {
    id?: string;
    name: string;                  // ชื่อกะ เช่น "กะเช้า", "กะบ่าย", "กะดึก"
    checkInHour: number;           // ชั่วโมงเข้างาน (0-23)
    checkInMinute: number;         // นาทีเข้างาน (0-59)
    checkOutHour: number;          // ชั่วโมงออกงาน (0-23)
    checkOutMinute: number;        // นาทีออกงาน (0-59)
    lateGracePeriod?: number;      // นาทีผ่อนผันสาย (default: 0)
    isDefault?: boolean;           // กะหลัก (default shift)
    createdAt: Date;
}

// Employee CRUD operations
export const employeeService = {
    async create(employee: Omit<Employee, "id">) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {
            ...employee,
            registeredDate: Timestamp.fromDate(employee.registeredDate),
        };
        if (employee.endDate) {
            data.endDate = Timestamp.fromDate(employee.endDate);
        }

        // Remove undefined fields
        Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);

        const docRef = await addDoc(collection(db, "employees"), data);
        return docRef.id;
    },

    async getAll() {
        const querySnapshot = await getDocs(collection(db, "employees"));
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                registeredDate: data.registeredDate?.toDate(),
                endDate: data.endDate?.toDate(),
            };
        }) as Employee[];
    },

    async getById(id: string) {
        const docRef = doc(db, "employees", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                registeredDate: data.registeredDate?.toDate(),
                endDate: data.endDate?.toDate(),
            } as Employee;
        }
        return null;
    },

    async update(id: string, employee: Partial<Employee>) {
        const docRef = doc(db, "employees", id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = { ...employee };

        if (employee.registeredDate) {
            data.registeredDate = Timestamp.fromDate(employee.registeredDate);
        }

        if (employee.endDate) {
            data.endDate = Timestamp.fromDate(employee.endDate);
        } else if ('endDate' in employee) {
            // If endDate is present but falsy (null/undefined), set to null to clear it in DB
            data.endDate = null;
        }

        // Handle shiftId - if undefined, set to null to clear it in DB
        if ('shiftId' in employee && (employee.shiftId === undefined || employee.shiftId === null)) {
            data.shiftId = null;
        }

        // Remove undefined fields (except those we explicitly set to null above)
        Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);

        await updateDoc(docRef, data);
    },

    async delete(id: string) {
        await deleteDoc(doc(db, "employees", id));
    },

    async getByLineUserId(lineUserId: string) {
        const q = query(collection(db, "employees"), where("lineUserId", "==", lineUserId));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            return {
                id: docSnap.id,
                ...docSnap.data(),
                registeredDate: docSnap.data().registeredDate?.toDate(),
                endDate: docSnap.data().endDate?.toDate(),
            } as Employee;
        }
        return null;
    },

    async getByPhone(phone: string) {
        const q = query(collection(db, "employees"), where("phone", "==", phone));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            return {
                id: docSnap.id,
                ...docSnap.data(),
                registeredDate: docSnap.data().registeredDate?.toDate(),
                endDate: docSnap.data().endDate?.toDate(),
            } as Employee;
        }
        return null;
    },

    async updateWeeklyHolidaysForAll(holidays: number[]) {
        const { writeBatch } = await import("firebase/firestore");
        const querySnapshot = await getDocs(collection(db, "employees"));
        const employees = querySnapshot.docs;

        // Firestore batch limit is 500
        const batchSize = 500;
        const batches = [];
        let currentBatch = writeBatch(db);
        let operationCount = 0;

        for (const docSnapshot of employees) {
            const employeeData = docSnapshot.data();

            // Check if update is needed (compare arrays)
            const currentHolidays = employeeData.weeklyHolidays || [];
            const isSame = currentHolidays.length === holidays.length &&
                currentHolidays.every((val: number, index: number) => val === holidays[index]);

            if (!isSame) {
                const docRef = doc(db, "employees", docSnapshot.id);
                currentBatch.update(docRef, { weeklyHolidays: holidays });
                operationCount++;

                if (operationCount === batchSize) {
                    batches.push(currentBatch.commit());
                    currentBatch = writeBatch(db);
                    operationCount = 0;
                }
            }
        }

        if (operationCount > 0) {
            batches.push(currentBatch.commit());
        }

        await Promise.all(batches);
        return operationCount; // Return number of updated employees
    },
};

// Attendance CRUD operations
export const attendanceService = {
    async create(attendance: Omit<Attendance, "id">) {
        const docRef = await addDoc(collection(db, "attendance"), {
            ...attendance,
            date: Timestamp.fromDate(attendance.date),
            checkIn: attendance.checkIn ? Timestamp.fromDate(attendance.checkIn) : null,
            checkOut: attendance.checkOut ? Timestamp.fromDate(attendance.checkOut) : null,
        });
        return docRef.id;
    },

    async getHistory(employeeId: string, startDate?: Date, endDate?: Date) {
        let q = query(
            collection(db, "attendance"),
            where("employeeId", "==", employeeId),
            orderBy("date", "desc")
        );

        if (startDate && endDate) {
            q = query(
                collection(db, "attendance"),
                where("employeeId", "==", employeeId),
                where("date", ">=", Timestamp.fromDate(startDate)),
                where("date", "<=", Timestamp.fromDate(endDate)),
                orderBy("date", "desc")
            );
        }

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date?.toDate(),
            checkIn: doc.data().checkIn?.toDate(),
            checkOut: doc.data().checkOut?.toDate(),
        })) as Attendance[];
    },

    async getByDate(date: Date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const q = query(
            collection(db, "attendance"),
            where("date", ">=", Timestamp.fromDate(startOfDay)),
            where("date", "<=", Timestamp.fromDate(endOfDay)),
            orderBy("date", "desc")
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date?.toDate(),
            checkIn: doc.data().checkIn?.toDate(),
            checkOut: doc.data().checkOut?.toDate(),
        })) as Attendance[];
    },

    async getByDateRange(startDate: Date, endDate: Date) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const q = query(
            collection(db, "attendance"),
            where("date", ">=", Timestamp.fromDate(start)),
            where("date", "<=", Timestamp.fromDate(end)),
            orderBy("date", "desc")
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date?.toDate(),
            checkIn: doc.data().checkIn?.toDate(),
            checkOut: doc.data().checkOut?.toDate(),
        })) as Attendance[];
    },

    async update(id: string, data: Partial<Attendance>) {
        const docRef = doc(db, "attendance", id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = { ...data };
        if (data.checkIn) updateData.checkIn = Timestamp.fromDate(data.checkIn);
        if (data.checkOut) updateData.checkOut = Timestamp.fromDate(data.checkOut);
        await updateDoc(docRef, updateData);
    },

    async delete(id: string) {
        await deleteDoc(doc(db, "attendance", id));
    },
};

// Leave Request CRUD operations
export const leaveService = {
    async create(leave: Omit<LeaveRequest, "id">) {
        const docRef = await addDoc(collection(db, "leaveRequests"), {
            ...leave,
            startDate: Timestamp.fromDate(leave.startDate),
            endDate: Timestamp.fromDate(leave.endDate),
            createdAt: Timestamp.fromDate(leave.createdAt),
        });
        return docRef.id;
    },

    async getAll() {
        const q = query(collection(db, "leaveRequests"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            startDate: doc.data().startDate?.toDate(),
            endDate: doc.data().endDate?.toDate(),
            createdAt: doc.data().createdAt?.toDate(),
        })) as LeaveRequest[];
    },

    async getByDateRange(startDate: Date, endDate: Date) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Note: This query checks if the leave *starts* within the range. 
        // For more complex overlap (starts before, ends after), we'd need client-side filtering or multiple queries.
        // For analytics, checking start date is usually sufficient for "New leaves in period".
        // However, for "People on leave", we might want overlap. 
        // Let's stick to a simple query for now and filter more if needed.
        const q = query(
            collection(db, "leaveRequests"),
            where("startDate", ">=", Timestamp.fromDate(start)),
            where("startDate", "<=", Timestamp.fromDate(end)),
            orderBy("startDate", "desc")
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            startDate: doc.data().startDate?.toDate(),
            endDate: doc.data().endDate?.toDate(),
            createdAt: doc.data().createdAt?.toDate(),
        })) as LeaveRequest[];
    },

    async updateStatus(id: string, status: LeaveRequest["status"]) {
        const docRef = doc(db, "leaveRequests", id);
        await updateDoc(docRef, { status });
    },

    async update(id: string, leave: Partial<Omit<LeaveRequest, "id">>) {
        const docRef = doc(db, "leaveRequests", id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = { ...leave };

        if (leave.startDate) {
            data.startDate = Timestamp.fromDate(leave.startDate);
        }
        if (leave.endDate) {
            data.endDate = Timestamp.fromDate(leave.endDate);
        }
        if (leave.createdAt) {
            data.createdAt = Timestamp.fromDate(leave.createdAt);
        }

        // Remove undefined fields
        Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);

        await updateDoc(docRef, data);
    },

    async delete(id: string) {
        await deleteDoc(doc(db, "leaveRequests", id));
    },

    async getByEmployeeId(employeeId: string) {
        const q = query(
            collection(db, "leaveRequests"),
            where("employeeId", "==", employeeId),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            startDate: doc.data().startDate?.toDate(),
            endDate: doc.data().endDate?.toDate(),
            createdAt: doc.data().createdAt?.toDate(),
        })) as LeaveRequest[];
    },
};

// OT Request CRUD operations
export const otService = {
    async create(ot: Omit<OTRequest, "id">) {
        const docRef = await addDoc(collection(db, "otRequests"), {
            ...ot,
            date: Timestamp.fromDate(ot.date),
            startTime: Timestamp.fromDate(ot.startTime),
            endTime: Timestamp.fromDate(ot.endTime),
            createdAt: Timestamp.fromDate(ot.createdAt),
        });
        return docRef.id;
    },

    async getAll() {
        const q = query(collection(db, "otRequests"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date?.toDate(),
            startTime: doc.data().startTime?.toDate(),
            endTime: doc.data().endTime?.toDate(),
            createdAt: doc.data().createdAt?.toDate(),
        })) as OTRequest[];
    },

    async getByDateRange(startDate: Date, endDate: Date) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const q = query(
            collection(db, "otRequests"),
            where("date", ">=", Timestamp.fromDate(start)),
            where("date", "<=", Timestamp.fromDate(end)),
            orderBy("date", "desc")
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date?.toDate(),
            startTime: doc.data().startTime?.toDate(),
            endTime: doc.data().endTime?.toDate(),
            createdAt: doc.data().createdAt?.toDate(),
        })) as OTRequest[];
    },

    async updateStatus(id: string, status: OTRequest["status"]) {
        const docRef = doc(db, "otRequests", id);
        await updateDoc(docRef, { status });
    },

    async update(id: string, ot: Partial<Omit<OTRequest, "id">>) {
        const docRef = doc(db, "otRequests", id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = { ...ot };

        if (ot.date) {
            data.date = Timestamp.fromDate(ot.date);
        }
        if (ot.startTime) {
            data.startTime = Timestamp.fromDate(ot.startTime);
        }
        if (ot.endTime) {
            data.endTime = Timestamp.fromDate(ot.endTime);
        }
        if (ot.createdAt) {
            data.createdAt = Timestamp.fromDate(ot.createdAt);
        }

        // Remove undefined fields
        Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);

        await updateDoc(docRef, data);
    },

    async delete(id: string) {
        await deleteDoc(doc(db, "otRequests", id));
    },

    async getByEmployeeId(employeeId: string) {
        const q = query(
            collection(db, "otRequests"),
            where("employeeId", "==", employeeId),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date?.toDate(),
            startTime: doc.data().startTime?.toDate(),
            endTime: doc.data().endTime?.toDate(),
            createdAt: doc.data().createdAt?.toDate(),
        })) as OTRequest[];
    },
};

// Swap Holiday Request CRUD operations
export const swapService = {
    async create(swap: Omit<SwapRequest, "id">) {
        const docRef = await addDoc(collection(db, "swapRequests"), {
            ...swap,
            workDate: Timestamp.fromDate(swap.workDate),
            holidayDate: Timestamp.fromDate(swap.holidayDate),
            createdAt: Timestamp.fromDate(swap.createdAt),
        });
        return docRef.id;
    },

    async getAll() {
        const q = query(collection(db, "swapRequests"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            workDate: doc.data().workDate?.toDate(),
            holidayDate: doc.data().holidayDate?.toDate(),
            createdAt: doc.data().createdAt?.toDate(),
        })) as SwapRequest[];
    },

    async getByEmployeeId(employeeId: string) {
        const q = query(
            collection(db, "swapRequests"),
            where("employeeId", "==", employeeId),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            workDate: doc.data().workDate?.toDate(),
            holidayDate: doc.data().holidayDate?.toDate(),
            createdAt: doc.data().createdAt?.toDate(),
        })) as SwapRequest[];
    },

    async updateStatus(id: string, status: SwapRequest["status"]) {
        const docRef = doc(db, "swapRequests", id);
        await updateDoc(docRef, { status });
    },

    async update(id: string, data: Partial<Omit<SwapRequest, "id">>) {
        const docRef = doc(db, "swapRequests", id);
        const updateData: any = { ...data };

        // Convert Date to Timestamp
        if (data.workDate) {
            updateData.workDate = Timestamp.fromDate(data.workDate);
        }
        if (data.holidayDate) {
            updateData.holidayDate = Timestamp.fromDate(data.holidayDate);
        }
        if (data.createdAt) {
            updateData.createdAt = Timestamp.fromDate(data.createdAt);
        }

        await updateDoc(docRef, updateData);
    },

    async delete(id: string) {
        await deleteDoc(doc(db, "swapRequests", id));
    },
};

// Shift CRUD operations (กะเวลาทำงาน)
export const shiftService = {
    async create(shift: Omit<Shift, "id">) {
        const docRef = await addDoc(collection(db, "shifts"), {
            ...shift,
            createdAt: Timestamp.fromDate(shift.createdAt),
        });
        return docRef.id;
    },

    async getAll() {
        const q = query(collection(db, "shifts"), orderBy("checkInHour", "asc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
        })) as Shift[];
    },

    async getById(id: string) {
        const docSnap = await getDoc(doc(db, "shifts", id));
        if (docSnap.exists()) {
            return {
                id: docSnap.id,
                ...docSnap.data(),
                createdAt: docSnap.data().createdAt?.toDate(),
            } as Shift;
        }
        return null;
    },

    async update(id: string, shift: Partial<Omit<Shift, "id">>) {
        const docRef = doc(db, "shifts", id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = { ...shift };
        if (shift.createdAt) {
            data.createdAt = Timestamp.fromDate(shift.createdAt);
        }
        Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);
        await updateDoc(docRef, data);
    },

    async delete(id: string) {
        await deleteDoc(doc(db, "shifts", id));
    },

    async getDefault() {
        const q = query(collection(db, "shifts"), where("isDefault", "==", true));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.docs.length > 0) {
            const doc = querySnapshot.docs[0];
            return {
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate(),
            } as Shift;
        }
        return null;
    },
};

export interface CustomHoliday {
    date: Date;
    name: string;
    workdayMultiplier: number; // Pay rate for working on this day (e.g. 2.0)
    otMultiplier: number; // OT rate for this day (e.g. 3.0)
}

export interface SystemConfig {
    id?: string;
    checkInHour: number;
    checkInMinute: number;
    checkOutHour: number;
    checkOutMinute: number;
    lateGracePeriod: number;
    minOTMinutes: number;
    // Work Time Enable/Disable
    workTimeEnabled?: boolean; // Enable work time tracking (late/OT)
    // Payroll Config
    otMultiplier: number; // Normal OT (e.g. 1.5)
    otMultiplierHoliday: number; // Holiday/Weekend OT (e.g. 3.0)
    weeklyHolidays: number[]; // Days of week that are holidays (0=Sun, 6=Sat)
    lateDeductionType: "none" | "pro-rated" | "fixed_per_minute";
    lateDeductionRate: number; // Used if fixed_per_minute
    customHolidays: CustomHoliday[];
    lineNotifyToken?: string; // Line Notify Token
    lineGroupId?: string; // Line Group ID for notifications
    locationConfig?: {
        enabled: boolean;
        latitude: number;
        longitude: number;
        radius: number; // meters
    };
    requirePhoto: boolean; // Require photo during check-in
    adminLineGroupId?: string; // Line Group ID for admin notifications
    enableDailyReport?: boolean; // Enable daily summary report
    allowNewRegistration?: boolean; // Allow new employee registration
    // Retroactive request limits (จำนวนวันย้อนหลัง)
    otRetroactiveDays?: number;      // วันย้อนหลังที่อนุญาตให้ขอ OT (default: 7)
    leaveRetroactiveDays?: number;   // วันย้อนหลังที่อนุญาตให้แนบหลักฐานลา (default: 7)
    swapAdvanceDays?: number;        // วันล่วงหน้าที่ต้องขอสลับวันหยุด (default: 3)
}
// System Config CRUD operations
export const systemConfigService = {
    async get() {
        const docRef = doc(db, "settings", "workTime");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                ...data,
                customHolidays: data.customHolidays?.map((h: any) => ({
                    ...h,
                    date: h.date?.toDate()
                })) || []
            } as SystemConfig;
        }
        return null;
    },

    async update(config: SystemConfig) {
        const docRef = doc(db, "settings", "workTime");
        // Use setDoc with merge: true to create if not exists or update if exists
        const { setDoc } = await import("firebase/firestore");

        // Convert Dates to Timestamps for storage
        const dataToSave = {
            ...config,
            customHolidays: config.customHolidays?.map(h => ({
                ...h,
                date: Timestamp.fromDate(h.date)
            })) || []
        };

        await setDoc(docRef, dataToSave, { merge: true });
    },
};

// Admin types
export interface Admin {
    id?: string;
    email: string;
    name: string;
    role: "super_admin" | "admin";
    createdAt: Date;
    lastLogin?: Date;
    lineUserId?: string; // LINE User ID สำหรับ Auto Login ผ่าน LINE
}

// Admin CRUD operations
export const adminService = {
    async create(admin: Omit<Admin, "id">) {
        const docRef = await addDoc(collection(db, "admins"), {
            ...admin,
            createdAt: Timestamp.fromDate(admin.createdAt),
            lastLogin: admin.lastLogin ? Timestamp.fromDate(admin.lastLogin) : null,
        });
        return docRef.id;
    },

    async getAll() {
        const q = query(collection(db, "admins"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            lastLogin: doc.data().lastLogin?.toDate(),
        })) as Admin[];
    },

    async update(id: string, data: Partial<Admin>) {
        const docRef = doc(db, "admins", id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = { ...data };
        if (data.createdAt) updateData.createdAt = Timestamp.fromDate(data.createdAt);
        if (data.lastLogin) updateData.lastLogin = Timestamp.fromDate(data.lastLogin);
        await updateDoc(docRef, updateData);
    },

    async delete(id: string) {
        await deleteDoc(doc(db, "admins", id));
    },

    async getByEmail(email: string) {
        const q = query(collection(db, "admins"), where("email", "==", email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            return {
                id: docSnap.id,
                ...docSnap.data(),
                createdAt: docSnap.data().createdAt?.toDate(),
                lastLogin: docSnap.data().lastLogin?.toDate(),
            } as Admin;
        }
        return null;
    },

    async getByLineUserId(lineUserId: string) {
        const q = query(collection(db, "admins"), where("lineUserId", "==", lineUserId));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            return {
                id: docSnap.id,
                ...docSnap.data(),
                createdAt: docSnap.data().createdAt?.toDate(),
                lastLogin: docSnap.data().lastLogin?.toDate(),
            } as Admin;
        }
        return null;
    },
};
