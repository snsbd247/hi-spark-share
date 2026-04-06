import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import MobileBottomNav from "./MobileBottomNav";
import DynamicFooter from "@/components/DynamicFooter";
import Breadcrumb from "./Breadcrumb";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-auto main-scroll">
        <main className="flex-1">
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto pt-16 md:pt-6 pb-20 md:pb-6 animate-page-enter">
            <Breadcrumb />
            {children}
          </div>
        </main>
        <DynamicFooter />
      </div>
      <MobileBottomNav />
    </div>
  );
}
