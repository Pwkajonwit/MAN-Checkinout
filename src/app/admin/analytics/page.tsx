import { PageHeader } from "@/components/layout/PageHeader";
import { AnalyticsCharts } from "@/components/analytics/AnalyticsCharts";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function AnalyticsPage() {
    return (
        <div>
            <PageHeader
                title="Analytics"
                subtitle="Overview of employee performance and attendance"
                searchPlaceholder="Search reports..."
                action={
                    <Button variant="outline" className="gap-2 rounded-xl border-gray-200 text-gray-600 hover:text-gray-900">
                        <Download className="w-4 h-4" />
                        Export Report
                    </Button>
                }
            />

            <AnalyticsCharts />
        </div>
    );
}
