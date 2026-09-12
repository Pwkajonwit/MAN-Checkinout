import { cn } from "@/lib/utils";
import { type Attendance } from "@/lib/firestore";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { formatMinutesToHours } from "@/lib/workTime";
import { MapPin, X, Edit2, Trash2, Clock } from "lucide-react";
import { useState } from "react";

interface AttendanceTableProps {
    attendances: Attendance[];
    onEdit?: (attendance: Attendance) => void;
    onDelete?: (id: string) => void;
    isSuperAdmin?: boolean;
    locationEnabled?: boolean;
    workTimeEnabled?: boolean;
}

export function AttendanceTable({
    attendances,
    onEdit,
    onDelete,
    isSuperAdmin = false,
    locationEnabled = false,
    workTimeEnabled = true
}: AttendanceTableProps) {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const openMap = (lat: number, lng: number) => {
        window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "เข้างาน":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-xs font-normal whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        เข้างาน
                    </span>
                );
            case "ออกงาน":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-full text-xs font-normal whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        ออกงาน
                    </span>
                );
            case "สาย":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-full text-xs font-normal whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        สาย
                    </span>
                );
            case "ก่อนพัก":
            case "หลังพัก":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-cyan-50 text-cyan-700 border border-cyan-200/80 rounded-full text-xs font-normal whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                        {status}
                    </span>
                );
            case "ออกนอกพื้นที่ขาไป":
            case "ออกนอกพื้นที่ขากลับ":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200/80 rounded-full text-xs font-normal whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                        {status === "ออกนอกพื้นที่ขาไป" ? "นอกพื้นที่ (ขาไป)" : "นอกพื้นที่ (กลับ)"}
                    </span>
                );
            case "ลางาน":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded-full text-xs font-normal whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                        ลางาน
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-full text-xs font-normal whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        {status}
                    </span>
                );
        }
    };

    return (
        <>
            <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/80 border-b border-slate-200">
                            <tr>
                                <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">พนักงาน</th>
                                <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">สถานะ</th>
                                <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">วันที่</th>
                                <th className="px-3.5 py-2.5 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">เข้า/ออกงาน</th>
                                <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">สถานที่</th>
                                <th className="px-3.5 py-2.5 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">พิกัด</th>
                                <th className="px-3.5 py-2.5 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">หมายเหตุ</th>
                                {isSuperAdmin && (
                                    <th className="px-3.5 py-2.5 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">จัดการ</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {attendances.length === 0 ? (
                                <tr>
                                    <td colSpan={isSuperAdmin ? 8 : 7} className="px-4 py-12 text-center text-slate-500 font-normal text-sm">
                                        ไม่มีข้อมูลการลงเวลาในวันที่เลือก
                                    </td>
                                </tr>
                            ) : (
                                attendances.map((attendance, index) => (
                                    <tr key={attendance.id || index} className="hover:bg-slate-50/60 transition-colors">
                                        {/* Employee */}
                                        <td className="px-3.5 py-2.5">
                                            <div className="flex items-center gap-2.5">
                                                {attendance.photo ? (
                                                    <button
                                                        onClick={() => setSelectedImage(attendance.photo!)}
                                                        className="w-7 h-7 rounded-full overflow-hidden ring-1 ring-slate-200 hover:ring-slate-400 transition-all cursor-pointer shrink-0"
                                                        title="ดูรูปภาพ"
                                                    >
                                                        <img
                                                            src={attendance.photo}
                                                            alt={attendance.employeeName}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </button>
                                                ) : (
                                                    <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-medium text-xs flex items-center justify-center shrink-0 ring-1 ring-slate-200">
                                                        {attendance.employeeName ? attendance.employeeName.charAt(0) : "?"}
                                                    </div>
                                                )}
                                                <span className="text-sm font-medium text-slate-800 leading-tight truncate">
                                                    {attendance.employeeName}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                                            {getStatusBadge(attendance.status)}
                                        </td>

                                        {/* Date */}
                                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                                            <span className="text-sm font-normal text-slate-600">
                                                {attendance.date ? format(attendance.date, "d MMM yyyy", { locale: th }) : "-"}
                                            </span>
                                        </td>

                                        {/* Time */}
                                        <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                            {attendance.status === "สาย" ? (
                                                <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-normal tabular-nums text-sm">
                                                    {attendance.checkIn ? format(attendance.checkIn, "HH:mm") : "-"}
                                                </span>
                                            ) : (
                                                <span className="text-sm font-normal text-slate-800 tabular-nums">
                                                    {attendance.checkIn ? format(attendance.checkIn, "HH:mm") :
                                                        attendance.checkOut ? format(attendance.checkOut, "HH:mm") : "-"}
                                                </span>
                                            )}
                                        </td>

                                        {/* Location */}
                                        <td className="px-3.5 py-2.5">
                                            <div className="max-w-[200px]">
                                                <span
                                                    className="text-sm font-normal text-slate-600 block truncate"
                                                    title={attendance.location || "-"}
                                                >
                                                    {attendance.location || "-"}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Coordinates / Map */}
                                        <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                            {attendance.latitude && attendance.longitude ? (
                                                <div className="inline-flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => openMap(attendance.latitude!, attendance.longitude!)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-colors text-xs font-normal"
                                                        title={`${attendance.latitude}, ${attendance.longitude}`}
                                                    >
                                                        <MapPin className="w-3 h-3 text-slate-500" />
                                                        แผนที่
                                                    </button>
                                                    {locationEnabled && attendance.distance !== undefined && (
                                                        <span className="text-[11px] font-normal text-slate-400">
                                                            ({attendance.distance < 1000 ? `${Math.round(attendance.distance)} ม.` : `${(attendance.distance / 1000).toFixed(1)} กม.`})
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-sm font-normal text-slate-400">-</span>
                                            )}
                                        </td>

                                        {/* Notes */}
                                        <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                            {(() => {
                                                const notes = [];

                                                if (workTimeEnabled && (attendance.status === "เข้างาน" || attendance.status === "สาย") && attendance.checkIn) {
                                                    const lateMinutes = attendance.lateMinutes || 0;
                                                    if (lateMinutes > 0) {
                                                        notes.push(
                                                            <span key="late" className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-xs font-normal">
                                                                <Clock className="w-3 h-3 text-amber-600" />
                                                                สาย {formatMinutesToHours(lateMinutes)}
                                                            </span>
                                                        );
                                                    }
                                                }

                                                if (attendance.locationNote) {
                                                    notes.push(
                                                        <span key="location-note" className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-xs font-normal" title={attendance.locationNote}>
                                                            นอกพื้นที่: {attendance.locationNote}
                                                        </span>
                                                    );
                                                }

                                                return notes.length > 0 ? (
                                                    <div className="flex flex-wrap justify-center gap-1">{notes}</div>
                                                ) : (
                                                    <span className="text-sm font-normal text-slate-400">-</span>
                                                );
                                            })()}
                                        </td>

                                        {/* SuperAdmin Actions */}
                                        {isSuperAdmin && attendance.id && (
                                            <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                <div className="inline-flex items-center gap-1">
                                                    {onEdit && (
                                                        <button
                                                            onClick={() => onEdit(attendance)}
                                                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
                                                            title="แก้ไข"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {onDelete && (
                                                        <button
                                                            onClick={() => {
                                                                if (confirm(`คุณต้องการลบบันทึกการลงเวลาของ ${attendance.employeeName} ใช่หรือไม่?`)) {
                                                                    onDelete(attendance.id!);
                                                                }
                                                            }}
                                                            className="p-1 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors"
                                                            title="ลบ"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Table Footer */}
                <div className="px-3.5 py-2.5 bg-slate-50/80 border-t border-slate-200 text-xs font-normal text-slate-500 flex flex-wrap items-center justify-between gap-2">
                    <span>
                        แสดงผล <span className="font-semibold text-slate-800">{attendances.length}</span> รายการ
                    </span>
                    <span className="text-slate-400 text-[11px]">
                        คลิกที่การ์ดสถิติด้านบนเพื่อกรองตามสถานะ
                    </span>
                </div>
            </div>

            {/* Image Preview Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
                    onClick={() => setSelectedImage(null)}
                >
                    <button
                        onClick={() => setSelectedImage(null)}
                        className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <img
                        src={selectedImage}
                        alt="Preview"
                        className="max-w-full max-h-[85vh] rounded-xl shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
}
