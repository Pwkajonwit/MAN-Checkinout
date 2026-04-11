import { PageHeader } from "@/components/layout/PageHeader";
import { AnalyticsCharts } from "@/components/analytics/AnalyticsCharts";
import { Button } from "@/components/ui/button";

export default function AnalyticsPage() {
    return (
        <div className="space-y-6">
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <PageHeader
                    title="ภาพรวมและรายงาน (Analytics)"
                    subtitle="วิเคราะห์ข้อมูลการเข้างาน การลา และโอที ของพนักงานในองค์กร"
                    searchPlaceholder="ค้นหารายงาน..."
                />
            </div>

            <div className="px-6 pb-8">
                <AnalyticsCharts />
            </div>
        </div>
    );
}
