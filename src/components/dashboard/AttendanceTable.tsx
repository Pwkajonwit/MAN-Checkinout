import { cn } from "@/lib/utils";
import { type Attendance } from "@/lib/firestore";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { isLate, getLateMinutes, isEligibleForOT, getOTMinutes, formatMinutesToHours } from "@/lib/workTime";
import { MapPin, X, Edit2, Trash2 } from "lucide-react";
import { useState } from "react";

interface AttendanceTableProps {
    attendances: Attendance[];
    onEdit?: (attendance: Attendance) => void;
    onDelete?: (id: string) => void;
    isSuperAdmin?: boolean;
    locationEnabled?: boolean;
    workTimeEnabled?: boolean;
}

export function AttendanceTable({ attendances, onEdit, onDelete, isSuperAdmin = false, locationEnabled = false, workTimeEnabled = true }: AttendanceTableProps) {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const openMap = (lat: number, lng: number) => {
        window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
    };

    return (
        <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100 text-left">
                                <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                                <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">วันที่</th>
                                <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">เข้า/ออกงาน</th>
                                <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">สถานที่</th>
                                <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">พิกัด</th>
                                <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">หมายเหตุ</th>
                                {isSuperAdmin && (
                                    <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {attendances.length === 0 ? (
                                <tr>
                                    <td colSpan={isSuperAdmin ? 8 : 7} className="py-12 text-center text-gray-500">
                                        ไม่มีข้อมูลการลงเวลาวันนี้
                                    </td>
                                </tr>
                            ) : (
                                attendances.map((attendance, index) => (
                                    <tr key={attendance.id || index} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                {attendance.photo ? (
                                                    <button
                                                        onClick={() => setSelectedImage(attendance.photo!)}
                                                        className="w-8 h-8 rounded-full overflow-hidden border-2 border-gray-200 hover:border-blue-500 transition-colors cursor-pointer"
                                                    >
                                                        <img
                                                            src={attendance.photo}
                                                            alt={attendance.employeeName}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </button>
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                                                        {attendance.employeeName.charAt(0)}
                                                    </div>
                                                )}
                                                <span className="text-sm font-medium text-gray-700">{attendance.employeeName}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={cn(
                                                "px-3 py-1 rounded-full text-xs font-medium",
                                                attendance.status === "เข้างาน" ? "bg-green-100 text-green-700" :
                                                    attendance.status === "ออกงาน" ? "bg-blue-100 text-blue-700" :
                                                        attendance.status === "ก่อนพัก" ? "bg-orange-100 text-orange-700" :
                                                            attendance.status === "หลังพัก" ? "bg-cyan-100 text-cyan-700" :
                                                                attendance.status === "ลางาน" ? "bg-yellow-100 text-yellow-700" :
                                                                    "bg-red-100 text-red-700"
                                            )}>
                                                {attendance.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-sm text-gray-600">
                                                {attendance.date ? format(attendance.date, "d MMM yyyy", { locale: th }) : "-"}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-sm text-gray-600">
                                                {attendance.checkIn ? format(attendance.checkIn, "HH:mm") :
                                                    attendance.checkOut ? format(attendance.checkOut, "HH:mm") : "-"}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="max-w-[150px]">
                                                <span
                                                    className="text-sm text-gray-500 block truncate"
                                                    title={attendance.location || "-"}
                                                >
                                                    {attendance.location || "-"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            {attendance.latitude && attendance.longitude ? (
                                                <div className="flex flex-col items-start gap-1">
                                                    <button
                                                        onClick={() => openMap(attendance.latitude!, attendance.longitude!)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors text-xs font-medium"
                                                        title={`${attendance.latitude}, ${attendance.longitude}`}
                                                    >
                                                        <MapPin className="w-3.5 h-3.5" />
                                                        แผนที่
                                                    </button>
                                                    {locationEnabled && attendance.distance !== undefined && (
                                                        <span className="text-xs text-gray-500 ml-1">
                                                            ห่าง {attendance.distance < 1000 ? `${Math.round(attendance.distance)} ม.` : `${(attendance.distance / 1000).toFixed(2)} กม.`}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6">
                                            {(() => {
                                                const notes = [];

                                                // Only show late if workTimeEnabled
                                                if (workTimeEnabled && (attendance.status === "เข้างาน" || attendance.status === "สาย") && attendance.checkIn) {
                                                    // ใช้ค่า lateMinutes ที่บันทึกไว้ในฐานข้อมูล แทนการคำนวณใหม่
                                                    const lateMinutes = attendance.lateMinutes || 0;
                                                    if (lateMinutes > 0) {
                                                        notes.push(
                                                            <span key="late" className="inline-flex items-center px-2 py-1 rounded-md bg-red-50 text-red-700 text-xs font-medium">
                                                                สาย {formatMinutesToHours(lateMinutes)}
                                                            </span>
                                                        );
                                                    }
                                                }

                                                // หมายเหตุ: ไม่แสดง OT อัตโนมัติแล้ว จะแสดงเฉพาะเมื่อมี OT Request ที่อนุมัติ
                                                // ลบโค้ดแสดง OT อัตโนมัติออก เพื่อให้สอดคล้องกับ Feature Request

                                                if (attendance.locationNote) {
                                                    notes.push(
                                                        <span key="location-note" className="inline-flex items-center px-2 py-1 rounded-md bg-orange-50 text-orange-700 text-xs font-medium" title={attendance.locationNote}>
                                                            นอกพื้นที่: {attendance.locationNote}
                                                        </span>
                                                    );
                                                }

                                                return notes.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">{notes}</div>
                                                ) : (
                                                    <span className="text-sm text-gray-400">-</span>
                                                );
                                            })()}
                                        </td>
                                        {isSuperAdmin && attendance.id && (
                                            <td className="py-4 px-6">
                                                <div className="flex gap-2">
                                                    {onEdit && (
                                                        <button
                                                            onClick={() => onEdit(attendance)}
                                                            className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                                                            title="แก้ไข"
                                                        >
                                                            <Edit2 className="w-4 h-4 text-blue-600" />
                                                        </button>
                                                    )}
                                                    {onDelete && (
                                                        <button
                                                            onClick={() => {
                                                                if (confirm(`คุณต้องการลบบันทึกการลงเวลาของ ${attendance.employeeName} ใช่หรือไม่?`)) {
                                                                    onDelete(attendance.id!);
                                                                }
                                                            }}
                                                            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                                            title="ลบ"
                                                        >
                                                            <Trash2 className="w-4 h-4 text-red-600" />
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
            </div>

            {/* Image Preview Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-200"
                    onClick={() => setSelectedImage(null)}
                >
                    <button
                        onClick={() => setSelectedImage(null)}
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <img
                        src={selectedImage}
                        alt="Preview"
                        className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
}
