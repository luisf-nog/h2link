import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
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
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminImport from "./pages/AdminImport";
import PublicProfile from "./pages/PublicProfile";
import SharedJobView from "./pages/SharedJobView";
import ResumeConverter from "./pages/ResumeConverter";
import Radar from "./pages/Radar";

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
    <Route path="/" element={<Navigate to="/jobs" replace />} />
    {/* Public Routes - No auth required */}
    <Route
      path="/dashboard"
      element={
        <AppLayout>
          <Dashboard />
        </AppLayout>
      }
    />
    <Route
      path="/jobs"
      element={
        <AppLayout>
          <Jobs />
        </AppLayout>
      }
    />
    <Route path="/job/:jobId" element={<SharedJobView />} />
    <Route
      path="/resume-converter"
      element={
        <ProtectedRoute>
          <ResumeConverter />
        </ProtectedRoute>
      }
    />
    <Route
      path="/plans"
      element={
        <AppLayout>
          <Plans />
        </AppLayout>
      }
    />
    <Route
      path="/referrals"
      element={
        <AppLayout>
          <Referrals />
        </AppLayout>
      }
    />
    {/* Protected Routes - Auth required */}
    <Route
      path="/queue"
      element={
        <ProtectedRoute>
          <Queue />
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
      path="/radar"
      element={
        <ProtectedRoute>
          <Radar />
        </ProtectedRoute>
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
    <Route
      path="/admin/analytics"
      element={
        <ProtectedRoute>
          <AdminAnalytics />
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin/import"
      element={
        <ProtectedRoute>
          <AdminImport />
        </ProtectedRoute>
      }
    />
    <Route path="/v/:token" element={<PublicProfile />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      {/* Atenção: O AuthProvider DEVE estar dentro do BrowserRouter 
        (para usar hooks de navegação se necessário) mas DEVE envolver 
        todas as rotas e componentes de UI que possam depender do user.
      */}
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AppRoutes />
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
