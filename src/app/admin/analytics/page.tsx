import { PageHeader } from "@/components/layout/PageHeader";
import { AnalyticsCharts } from "@/components/analytics/AnalyticsCharts";
import { Button } from "@/components/ui/button";

export default function AnalyticsPage() {
    return (
        <div>
            <PageHeader
                title="Analytics"
                subtitle="Overview of employee performance and attendance"
                searchPlaceholder="Search reports..."
            />

            <AnalyticsCharts />
        </div>
    );
}
