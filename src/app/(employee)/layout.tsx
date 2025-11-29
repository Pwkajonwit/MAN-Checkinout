import { EmployeeProvider } from "@/contexts/EmployeeContext";

export default function EmployeeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <EmployeeProvider>
            {children}
        </EmployeeProvider>
    );
}
