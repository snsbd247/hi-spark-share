import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import DynamicFooter from "@/components/DynamicFooter";
import { useTenantSync } from "@/hooks/useTenantSync";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  // Sync tenant context with API proxy for all tenant admin pages
  useTenantSync();

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-auto">
        <main className="flex-1">
          <div className="p-4 sm:p-6 max-w-7xl mx-auto pt-16 md:pt-6">{children}</div>
        </main>
        <DynamicFooter />
      </div>
    </div>
  );
}
