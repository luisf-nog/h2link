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

// --- PROTECTED ROUTE (O Porteiro do Onboarding) ---
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, smtpStatus } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  // 1. Se estiver carregando os dados iniciais do Supabase ou SMTP
  if (loading || !smtpStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  // 2. Se não estiver logado
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // 3. Verificação de Onboarding
  const needsOnboarding = !smtpStatus.hasPassword || !smtpStatus.hasRiskProfile;
  const isSettingsRoute = location.pathname.startsWith("/settings");

  // Se precisa de onboarding e NÃO está tentando acessar as configurações
  if (needsOnboarding && !isSettingsRoute) {
    console.log("DEBUG: Onboarding pendente. Redirecionando...");
    return <Navigate to="/onboarding" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

// --- ONBOARDING ROUTE ---
function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, smtpStatus } = useAuth();
  const { t } = useTranslation();

  if (loading || !smtpStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Se já completou tudo, não deixa ficar no onboarding
  if (smtpStatus.hasPassword && smtpStatus.hasRiskProfile) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// --- PUBLIC ROUTE ---
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
    const isAuthCallback = params.has("code") || params.has("token_hash");

    if (!(isAuthRoute && isAuthCallback)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    {/* AUTH & PUBLIC */}
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
    <Route path="/job/:jobId" element={<SharedJobView />} />
    <Route path="/v/:token" element={<PublicProfile />} />

    {/* ONBOARDING FLOW */}
    <Route
      path="/onboarding"
      element={
        <OnboardingRoute>
          <Onboarding />
        </OnboardingRoute>
      }
    />

    {/* PROTECTED ROUTES */}
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
      path="/plans"
      element={
        <ProtectedRoute>
          <Plans />
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
      path="/radar"
      element={
        <ProtectedRoute>
          <Radar />
        </ProtectedRoute>
      }
    />
    <Route
      path="/resume-converter"
      element={
        <ProtectedRoute>
          <ResumeConverter />
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
      path="/payment-success"
      element={
        <ProtectedRoute>
          <PaymentSuccess />
        </ProtectedRoute>
      }
    />

    {/* ADMIN */}
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

    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
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
