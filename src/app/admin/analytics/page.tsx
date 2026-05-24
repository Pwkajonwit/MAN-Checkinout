import { PageHeader } from "@/components/layout/PageHeader";
import { AnalyticsCharts } from "@/components/analytics/AnalyticsCharts";
import { Button } from "@/components/ui/button";

export default function AnalyticsPage() {
    return (
        <div className="space-y-6">
                <PageHeader
                    title="ภาพรวมและรายงาน (Analytics)"
                    subtitle="วิเคราะห์ข้อมูลการเข้างาน การลา และโอที ของพนักงานในองค์กร"
                    searchPlaceholder="ค้นหารายงาน..."
                />
          

            <div className="p-2">
                <AnalyticsCharts />
            </div>
        </div>
    );
}
