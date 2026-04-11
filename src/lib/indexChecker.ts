import { collection, query, where, orderBy, getDocs, Timestamp, limit } from "firebase/firestore";
import { db } from "./firebase";

export interface IndexCheckResult {
    queryName: string;
    collection: string;
    status: "ok" | "missing" | "error";
    indexUrl?: string;
    error?: string;
    fields?: { fieldPath: string; order: "ASCENDING" | "DESCENDING" }[];
}

/**
 * List of all queries that require composite indexes in this app
 */
const REQUIRED_QUERIES: {
    name: string;
    collection: string;
    buildQuery: () => any;
    fields?: { fieldPath: string; order: "ASCENDING" | "DESCENDING" }[];
}[] = [
        {
            name: "Attendance by Employee (with date order)",
            collection: "attendance",
            buildQuery: () => query(
                collection(db, "attendance"),
                where("employeeId", "==", "__test__"),
                orderBy("date", "desc"),
                limit(1)
            ),
            fields: [
                { fieldPath: "employeeId", order: "ASCENDING" },
                { fieldPath: "date", order: "DESCENDING" }
            ]
        },
        {
            name: "Attendance by Date Range",
            collection: "attendance",
            buildQuery: () => {
                const now = new Date();
                return query(
                    collection(db, "attendance"),
                    where("date", ">=", Timestamp.fromDate(now)),
                    where("date", "<=", Timestamp.fromDate(now)),
                    orderBy("date", "desc"),
                    limit(1)
                );
            }
        },
        {
            name: "Leave Requests by Employee",
            collection: "leaveRequests",
            buildQuery: () => query(
                collection(db, "leaveRequests"),
                where("employeeId", "==", "__test__"),
                orderBy("createdAt", "desc"),
                limit(1)
            ),
            fields: [
                { fieldPath: "employeeId", order: "ASCENDING" },
                { fieldPath: "createdAt", order: "DESCENDING" }
            ]
        },
        {
            name: "Leave Requests by Date Range",
            collection: "leaveRequests",
            buildQuery: () => {
                const now = new Date();
                return query(
                    collection(db, "leaveRequests"),
                    where("startDate", ">=", Timestamp.fromDate(now)),
                    where("startDate", "<=", Timestamp.fromDate(now)),
                    orderBy("startDate", "desc"),
                    limit(1)
                );
            }
        },
        {
            name: "OT Requests by Employee",
            collection: "otRequests",
            buildQuery: () => query(
                collection(db, "otRequests"),
                where("employeeId", "==", "__test__"),
                orderBy("createdAt", "desc"),
                limit(1)
            ),
            fields: [
                { fieldPath: "employeeId", order: "ASCENDING" },
                { fieldPath: "createdAt", order: "DESCENDING" }
            ]
        },
        {
            name: "OT Requests by Date Range",
            collection: "otRequests",
            buildQuery: () => {
                const now = new Date();
                return query(
                    collection(db, "otRequests"),
                    where("date", ">=", Timestamp.fromDate(now)),
                    where("date", "<=", Timestamp.fromDate(now)),
                    orderBy("date", "desc"),
                    limit(1)
                );
            }
        },
        {
            name: "Employees by LINE User ID",
            collection: "employees",
            buildQuery: () => query(
                collection(db, "employees"),
                where("lineUserId", "==", "__test__"),
                limit(1)
            )
        },
        {
            name: "Employees by Phone",
            collection: "employees",
            buildQuery: () => query(
                collection(db, "employees"),
                where("phone", "==", "__test__"),
                limit(1)
            )
        },
        {
            name: "Admins by Email",
            collection: "admins",
            buildQuery: () => query(
                collection(db, "admins"),
                where("email", "==", "__test__"),
                limit(1)
            )
        },
        {
            name: "Swap Requests by Employee",
            collection: "swapRequests",
            buildQuery: () => query(
                collection(db, "swapRequests"),
                where("employeeId", "==", "__test__"),
                orderBy("createdAt", "desc"),
                limit(1)
            ),
            fields: [
                { fieldPath: "employeeId", order: "ASCENDING" },
                { fieldPath: "createdAt", order: "DESCENDING" }
            ]
        },
        {
            name: "Swap Requests by Date Range",
            collection: "swapRequests",
            buildQuery: () => {
                const now = new Date();
                return query(
                    collection(db, "swapRequests"),
                    where("workDate", ">=", Timestamp.fromDate(now)),
                    where("workDate", "<=", Timestamp.fromDate(now)),
                    orderBy("workDate", "desc"),
                    limit(1)
                );
            },
            fields: [
                { fieldPath: "workDate", order: "ASCENDING" },
                { fieldPath: "workDate", order: "DESCENDING" }
            ]
        },
        {
            name: "Shift Change Requests by Employee",
            collection: "shiftChangeRequests",
            buildQuery: () => query(
                collection(db, "shiftChangeRequests"),
                where("employeeId", "==", "__test__"),
                orderBy("createdAt", "desc"),
                limit(1)
            ),
            fields: [
                { fieldPath: "employeeId", order: "ASCENDING" },
                { fieldPath: "createdAt", order: "DESCENDING" }
            ]
        },
        {
            name: "Shift Change Requests by Date Range",
            collection: "shiftChangeRequests",
            buildQuery: () => {
                const now = new Date();
                return query(
                    collection(db, "shiftChangeRequests"),
                    where("date", ">=", Timestamp.fromDate(now)),
                    where("date", "<=", Timestamp.fromDate(now)),
                    orderBy("date", "desc"),
                    limit(1)
                );
            },
            fields: [
                { fieldPath: "date", order: "ASCENDING" },
                { fieldPath: "date", order: "DESCENDING" }
            ]
        },
        {
            name: "Approved Shift Change by Employee and Date",
            collection: "shiftChangeRequests",
            buildQuery: () => {
                const now = new Date();
                return query(
                    collection(db, "shiftChangeRequests"),
                    where("employeeId", "==", "__test__"),
                    where("date", ">=", Timestamp.fromDate(now)),
                    where("date", "<=", Timestamp.fromDate(now)),
                    where("status", "==", "อนุมัติ"),
                    limit(1)
                );
            },
            fields: [
                { fieldPath: "employeeId", order: "ASCENDING" },
                { fieldPath: "date", order: "ASCENDING" },
                { fieldPath: "status", order: "ASCENDING" }
            ]
        }
    ];

/**
 * Extract index creation URL from Firebase error message
 */
function extractIndexUrl(errorMessage: string): string | undefined {
    const urlMatch = errorMessage.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
    return urlMatch ? urlMatch[0] : undefined;
}

/**
 * Check all required indexes and return results
 */
export async function checkAllIndexes(): Promise<IndexCheckResult[]> {
    const results: IndexCheckResult[] = [];

    for (const queryDef of REQUIRED_QUERIES) {
        try {
            const q = queryDef.buildQuery();
            await getDocs(q);

            results.push({
                queryName: queryDef.name,
                collection: queryDef.collection,
                status: "ok",
                fields: queryDef.fields
            });
        } catch (error: any) {
            const errorMessage = error?.message || String(error);
            const indexUrl = extractIndexUrl(errorMessage);

            if (indexUrl || errorMessage.includes("index")) {
                results.push({
                    queryName: queryDef.name,
                    collection: queryDef.collection,
                    status: "missing",
                    indexUrl: indexUrl,
                    error: "ต้องสร้าง Index",
                    fields: queryDef.fields
                });
            } else {
                // Other errors (e.g., permission denied) - likely OK
                results.push({
                    queryName: queryDef.name,
                    collection: queryDef.collection,
                    status: "ok"
                });
            }
        }
    }

    return results;
}

/**
 * Get only missing indexes
 */
export async function getMissingIndexes(): Promise<IndexCheckResult[]> {
    const results = await checkAllIndexes();
    return results.filter(r => r.status === "missing");
}
