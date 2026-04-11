"use client";

import { useEffect, useState } from "react";
import { attendanceService, leaveService, otService } from "@/lib/firestore";
import { Attendance, LeaveRequest, OTRequest } from "@/lib/firestore";
import { format, subDays } from "date-fns";
import { th } from "date-fns/locale";
import { EmployeeHeader } from "@/components/mobile/EmployeeHeader";
import { useEmployee } from "@/contexts/EmployeeContext";
import { Calendar, Clock, MapPin, FileText, Clock as ClockIcon, ChevronDown, Loader2 } from "lucide-react";

// Number of days to load initially
const INITIAL_DAYS = 30;
const LOAD_MORE_DAYS = 30;

export default function HistoryPage() {
    const { employee } = useEmployee();
    const [activeTab, setActiveTab] = useState<"attendance" | "leave" | "ot">("attendance");

    const [attendance, setAttendance] = useState<Attendance[]>([]);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [ots, setOts] = useState<OTRequest[]>([]);

    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [currentDaysLoaded, setCurrentDaysLoaded] = useState(INITIAL_DAYS);
    const [hasMoreAttendance, setHasMoreAttendance] = useState(true);

    const [loadedTabs, setLoadedTabs] = useState<{ attendance: boolean; leave: boolean; ot: boolean }>({
        attendance: false,
        leave: false,
        ot: false
    });

    // Fetch Attendance (Initial Load)
    useEffect(() => {
        const fetchAttendance = async () => {
            if (!employee?.id || loadedTabs.attendance) return;

            setLoading(true);
            try {
                // Calculate date range - only fetch last 30 days initially
                const endDate = new Date();
                endDate.setHours(23, 59, 59, 999);
                const startDate = subDays(endDate, INITIAL_DAYS);
                startDate.setHours(0, 0, 0, 0);

                const attendanceData = await attendanceService.getHistory(employee.id, startDate, endDate);
                setAttendance(attendanceData);
                setHasMoreAttendance(attendanceData.length > 0);
                setLoadedTabs(prev => ({ ...prev, attendance: true }));
            } catch (error) {
                console.error("Error fetching attendance:", error);
            } finally {
                setLoading(false);
            }
        };

        if (employee) {
            fetchAttendance();
        }
    }, [employee]);

    // Fetch Leaves (Lazy Load)
    useEffect(() => {
        const fetchLeaves = async () => {
            if (!employee?.id || activeTab !== "leave" || loadedTabs.leave) return;

            setLoading(true);
            try {
                const leaveData = await leaveService.getByEmployeeId(employee.id);
                setLeaves(leaveData);
                setLoadedTabs(prev => ({ ...prev, leave: true }));
            } catch (error) {
                console.error("Error fetching leaves:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaves();
    }, [activeTab, employee]);

    // Fetch OT (Lazy Load)
    useEffect(() => {
        const fetchOT = async () => {
            if (!employee?.id || activeTab !== "ot" || loadedTabs.ot) return;

            setLoading(true);
            try {
                const otData = await otService.getByEmployeeId(employee.id);
                setOts(otData);
                setLoadedTabs(prev => ({ ...prev, ot: true }));
            } catch (error) {
                console.error("Error fetching OT:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchOT();
    }, [activeTab, employee]);

    const loadMoreAttendance = async () => {
        if (!employee?.id || loadingMore) return;

        setLoadingMore(true);
        try {
            const newDays = currentDaysLoaded + LOAD_MORE_DAYS;
            const endDate = new Date();
            endDate.setHours(23, 59, 59, 999);
            const startDate = subDays(endDate, newDays);
            startDate.setHours(0, 0, 0, 0);

            const attendanceData = await attendanceService.getHistory(employee.id, startDate, endDate);

            setAttendance(attendanceData);
            setCurrentDaysLoaded(newDays);

            // If we got the same number of records, there's no more data
            setHasMoreAttendance(attendanceData.length > attendance.length);
        } catch (error) {
            console.error("Error loading more attendance:", error);
        } finally {
            setLoadingMore(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "อนุมัติ": return "bg-green-100 text-green-700";
            case "ไม่อนุมัติ": return "bg-red-100 text-red-700";
            case "รออนุมัติ": return "bg-yellow-100 text-yellow-700";
            default: return "bg-gray-100 text-gray-700";
        }
    };

    const getStatusBorder = (status: string) => {
        switch (status) {
            case "อนุมัติ": return "bg-green-500";
            case "ไม่อนุมัติ": return "bg-red-500";
            case "รออนุมัติ": return "bg-yellow-500";
            default: return "bg-gray-500";
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-10">
            <EmployeeHeader />

            <main className="px-6 -mt-6 relative z-10 space-y-6">

                {/* Tabs */}
                <div className="bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 flex">
                    <button
                        onClick={() => setActiveTab("attendance")}
                        className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === "attendance"
                            ? "bg-primary text-white shadow-md"
                            : "text-gray-500 hover:bg-gray-50"
                            }`}
                    >
                        ลงเวลา
                    </button>
                    <button
                        onClick={() => setActiveTab("leave")}
                        className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === "leave"
                            ? "bg-primary text-white shadow-md"
                            : "text-gray-500 hover:bg-gray-50"
                            }`}
                    >
                        การลา
                    </button>
                    <button
                        onClick={() => setActiveTab("ot")}
                        className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === "ot"
                            ? "bg-primary text-white shadow-md"
                            : "text-gray-500 hover:bg-gray-50"
                            }`}
                    >
                        โอที
                    </button>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100 min-h-[300px]">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        {activeTab === "attendance" && <Calendar className="w-5 h-5 text-orange-500" />}
                        {activeTab === "leave" && <FileText className="w-5 h-5 text-blue-500" />}
                        {activeTab === "ot" && <ClockIcon className="w-5 h-5 text-purple-500" />}

                        {activeTab === "attendance" && "ประวัติการลงเวลา"}
                        {activeTab === "leave" && "ประวัติการลา"}
                        {activeTab === "ot" && "ประวัติการขอโอที"}
                    </h2>

                    {loading ? (
                        <div className="text-center py-12 text-gray-400 flex flex-col items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                            กำลังโหลดข้อมูล...
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Attendance List */}
                            {activeTab === "attendance" && (
                                <>
                                    {/* Info about date range */}
                                    <div className="text-xs text-gray-500 text-center mb-3">
                                        แสดงข้อมูล {currentDaysLoaded} วันล่าสุด ({attendance.length} รายการ)
                                    </div>

                                    {attendance.length === 0 ? (
                                        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                            ไม่พบประวัติการลงเวลาใน {currentDaysLoaded} วันล่าสุด
                                        </div>
                                    ) : (
                                        attendance.map((record) => (
                                            <div
                                                key={record.id}
                                                className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                                            >
                                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${record.status === 'เข้างาน' ? 'bg-green-500' :
                                                    record.status === 'ออกงาน' ? 'bg-red-500' : 'bg-orange-500'
                                                    }`} />

                                                <div className="flex justify-between items-start mb-2 pl-2">
                                                    <div>
                                                        <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold mb-1 ${record.status === 'เข้างาน' ? 'bg-green-100 text-green-700' :
                                                            record.status === 'ออกงาน' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                                            }`}>
                                                            {record.status}
                                                        </span>
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {format(record.date, "d MMMM yyyy", { locale: th })}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-lg font-bold text-gray-800 flex items-center justify-end gap-1">
                                                            <Clock className="w-4 h-4 text-gray-400" />
                                                            {format(record.date, "HH:mm")}
                                                        </div>
                                                    </div>
                                                </div>

                                                {record.location && (
                                                    <div className="flex items-start gap-1.5 text-xs text-gray-500 pl-2 mt-2 pt-2 border-t border-gray-50">
                                                        <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                                        <span className="line-clamp-1">{record.location}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}

                                    {/* Load More Button */}
                                    {hasMoreAttendance && attendance.length > 0 && (
                                        <button
                                            onClick={loadMoreAttendance}
                                            disabled={loadingMore}
                                            className="w-full py-3 mt-4 text-sm font-medium text-gray-600 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {loadingMore ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    กำลังโหลด...
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDown className="w-4 h-4" />
                                                    โหลดเพิ่ม (อีก {LOAD_MORE_DAYS} วัน)
                                                </>
                                            )}
                                        </button>
                                    )}
                                </>
                            )}

                            {/* Leave List */}
                            {activeTab === "leave" && (
                                leaves.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                        ไม่พบประวัติการลา
                                    </div>
                                ) : (
                                    leaves.map((leave) => (
                                        <div
                                            key={leave.id}
                                            className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                                        >
                                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${getStatusBorder(leave.status)}`} />

                                            <div className="flex justify-between items-start mb-2 pl-2">
                                                <div>
                                                    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold mb-1 ${getStatusColor(leave.status)}`}>
                                                        {leave.status}
                                                    </span>
                                                    <div className="text-sm font-bold text-gray-900">
                                                        {leave.leaveType}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-gray-500 mb-1">วันที่ลา</div>
                                                    <div className="text-sm font-medium text-gray-800">
                                                        {format(leave.startDate, "d MMM", { locale: th })} - {format(leave.endDate, "d MMM", { locale: th })}
                                                    </div>
                                                </div>
                                            </div>

                                            {leave.reason && (
                                                <div className="text-xs text-gray-500 pl-2 mt-2 pt-2 border-t border-gray-50">
                                                    เหตุผล: {leave.reason}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )
                            )}

                            {/* OT List */}
                            {activeTab === "ot" && (
                                ots.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                        ไม่พบประวัติการขอโอที
                                    </div>
                                ) : (
                                    ots.map((ot) => (
                                        <div
                                            key={ot.id}
                                            className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                                        >
                                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${getStatusBorder(ot.status)}`} />

                                            <div className="flex justify-between items-start mb-2 pl-2">
                                                <div>
                                                    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold mb-1 ${getStatusColor(ot.status)}`}>
                                                        {ot.status}
                                                    </span>
                                                    <div className="text-sm font-bold text-gray-900">
                                                        {format(ot.date, "d MMMM yyyy", { locale: th })}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-gray-500 mb-1">เวลา</div>
                                                    <div className="text-sm font-medium text-gray-800">
                                                        {format(ot.startTime, "HH:mm")} - {format(ot.endTime, "HH:mm")}
                                                    </div>
                                                </div>
                                            </div>

                                            {ot.reason && (
                                                <div className="text-xs text-gray-500 pl-2 mt-2 pt-2 border-t border-gray-50">
                                                    เหตุผล: {ot.reason}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )
                            )}

                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
