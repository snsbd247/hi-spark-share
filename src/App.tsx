import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CustomerAuthProvider } from "@/contexts/CustomerAuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import CustomerProtectedRoute from "@/components/CustomerProtectedRoute";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Customers from "@/pages/Customers";
import Packages from "@/pages/Packages";
import Billing from "@/pages/Billing";
import Payments from "@/pages/Payments";
import CustomerLogin from "@/pages/portal/CustomerLogin";
import CustomerDashboard from "@/pages/portal/CustomerDashboard";
import CustomerBills from "@/pages/portal/CustomerBills";
import CustomerPayments from "@/pages/portal/CustomerPayments";
import CustomerProfile from "@/pages/portal/CustomerProfile";
import PaymentCallback from "@/pages/portal/PaymentCallback";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <CustomerAuthProvider>
              <Routes>
                {/* Admin Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
                <Route path="/packages" element={<ProtectedRoute><Packages /></ProtectedRoute>} />
                <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
                <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />

                {/* Customer Portal Routes */}
                <Route path="/portal/login" element={<CustomerLogin />} />
                <Route path="/portal" element={<CustomerProtectedRoute><CustomerDashboard /></CustomerProtectedRoute>} />
                <Route path="/portal/bills" element={<CustomerProtectedRoute><CustomerBills /></CustomerProtectedRoute>} />
                <Route path="/portal/payments" element={<CustomerProtectedRoute><CustomerPayments /></CustomerProtectedRoute>} />
                <Route path="/portal/profile" element={<CustomerProtectedRoute><CustomerProfile /></CustomerProtectedRoute>} />
                <Route path="/portal/payment-callback" element={<PaymentCallback />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </CustomerAuthProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
