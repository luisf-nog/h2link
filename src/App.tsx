import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { useTranslation } from "react-i18next";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import Queue from "./pages/Queue";
import Referrals from "./pages/Referrals";
import Plans from "./pages/Plans";
import Settings from "./pages/Settings";
import PaymentSuccess from "./pages/PaymentSuccess";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import AdminAiUsage from "./pages/AdminAiUsage";
import PublicProfile from "./pages/PublicProfile";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, smtpStatus } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect to onboarding if SMTP not fully configured
  // Skip redirect if already on settings page (allow manual config)
  const needsOnboarding = smtpStatus && (!smtpStatus.hasPassword || !smtpStatus.hasRiskProfile);
  const isSettingsRoute = location.pathname.startsWith("/settings");
  
  if (needsOnboarding && !isSettingsRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, smtpStatus } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If SMTP is fully configured, redirect to dashboard
  if (smtpStatus?.hasPassword && smtpStatus?.hasRiskProfile) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  // Important: when arriving at /auth from an email link (confirmation or recovery),
  // we must allow the Auth page to process the callback and/or show the reset UI.
  // Otherwise, the presence of a session will instantly redirect to /dashboard.
  if (user) {
    const isAuthRoute = location.pathname === "/auth";
    const params = new URLSearchParams(location.search);
    const isAuthCallback =
      params.has("code") ||
      params.has("token_hash") ||
      params.has("token") ||
      params.has("type") ||
      params.has("error") ||
      params.has("error_code") ||
      params.has("error_description");

    if (!(isAuthRoute && isAuthCallback)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route
      path="/auth"
      element={
        <PublicRoute>
          <Auth />
        </PublicRoute>
      }
    />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route
      path="/"
      element={<Navigate to="/dashboard" replace />}
    />
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/jobs"
      element={
        <ProtectedRoute>
          <Jobs />
        </ProtectedRoute>
      }
    />
    <Route
      path="/queue"
      element={
        <ProtectedRoute>
          <Queue />
        </ProtectedRoute>
      }
    />
    <Route
      path="/referrals"
      element={
        <ProtectedRoute>
          <Referrals />
        </ProtectedRoute>
      }
    />
    <Route
      path="/plans"
      element={
        <ProtectedRoute>
          <Plans />
        </ProtectedRoute>
      }
    />
    <Route
      path="/payment-success"
      element={
        <ProtectedRoute>
          <PaymentSuccess />
        </ProtectedRoute>
      }
    />
    <Route
      path="/settings"
      element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      }
    />
    <Route
      path="/settings/email"
      element={
        <ProtectedRoute>
          <Settings defaultTab="email" />
        </ProtectedRoute>
      }
    />
    <Route
      path="/onboarding"
      element={
        <OnboardingRoute>
          <Onboarding />
        </OnboardingRoute>
      }
    />
    <Route
      path="/admin/ai-usage"
      element={
        <ProtectedRoute>
          <AdminAiUsage />
        </ProtectedRoute>
      }
    />
    <Route path="/v/:token" element={<PublicProfile />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
