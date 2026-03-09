import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useIsEmployer } from "@/hooks/useIsEmployer";
import { AppLayout } from "@/components/layout/AppLayout";
import { useTranslation } from "react-i18next";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
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
import Landing from "./pages/Landing";
import ApplyJob from "./pages/ApplyJob";
import Landing from "./pages/Landing";
import ApplyJob from "./pages/ApplyJob";
import EmployerDashboard from "./pages/employer/EmployerDashboard";
import EmployerPlans from "./pages/employer/EmployerPlans";
import EmployerJobs from "./pages/employer/EmployerJobs";
import CreateJob from "./pages/employer/CreateJob";
import JobApplicants from "./pages/employer/JobApplicants";

const queryClient = new QueryClient();

// --- PROTECTED ROUTE (O Porteiro do Onboarding) ---
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, smtpStatus } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const { isEmployer, loading: employerLoading } = useIsEmployer();

  // 1. Se estiver carregando a sessão inicial
  if (loading || employerLoading) {
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

  // 3. Employers are isolated to employer portal routes
  if (isEmployer) {
    return <Navigate to="/employer/dashboard" replace />;
  }

  // 4. Verificação de Onboarding for workers
  const needsOnboarding = !smtpStatus || !smtpStatus.hasPassword || !smtpStatus.hasRiskProfile;
  const isSettingsRoute = location.pathname.startsWith("/settings");

  if (needsOnboarding && !isSettingsRoute) {
    console.log("DEBUG: Onboarding pendente. Redirecionando...");
    return <Navigate to="/onboarding" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

// --- EMPLOYER ROUTE ---
function EmployerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isEmployer, loading: employerLoading } = useIsEmployer();
  const { t } = useTranslation();

  if (loading || employerLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isEmployer) return <Navigate to="/dashboard" replace />;

  return <AppLayout>{children}</AppLayout>;
}

// --- ONBOARDING ROUTE ---
function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, smtpStatus } = useAuth();
  const { isEmployer, loading: employerLoading } = useIsEmployer();
  const { t } = useTranslation();

  if (loading || employerLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Employers don't need SMTP onboarding
  if (isEmployer) {
    return <Navigate to="/employer/dashboard" replace />;
  }

  // Se já completou tudo, não deixa ficar no onboarding
  if (smtpStatus?.hasPassword && smtpStatus?.hasRiskProfile) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// --- PUBLIC ROUTE ---
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isEmployer, loading: employerLoading } = useIsEmployer();
  const { t } = useTranslation();
  const location = useLocation();

  if (loading || employerLoading) {
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
      return <Navigate to={isEmployer ? "/employer/dashboard" : "/dashboard"} replace />;
    }
  }

  return <>{children}</>;
}

// --- PUBLIC OR PROTECTED ROUTE (accessible without login, but shows full layout when logged in) ---
function PublicOrProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, smtpStatus } = useAuth();
  const { isEmployer, loading: employerLoading } = useIsEmployer();
  const { t } = useTranslation();
  const location = useLocation();

  if (loading || employerLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  // If not logged in, show with AppLayout (which has a login button in header)
  if (!user) {
    return <AppLayout>{children}</AppLayout>;
  }

  // Employers are isolated to employer portal routes
  if (isEmployer) {
    return <Navigate to="/employer/dashboard" replace />;
  }

  // If logged in and needs onboarding, redirect
  const needsOnboarding = !smtpStatus || !smtpStatus.hasPassword || !smtpStatus.hasRiskProfile;
  const isSettingsRoute = location.pathname.startsWith("/settings");
  if (needsOnboarding && !isSettingsRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
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
    <Route path="/" element={<Landing />} />
    <Route path="/job/:jobId" element={<SharedJobView />} />
    <Route path="/apply/:jobId" element={<ApplyJob />} />
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

    {/* PERSISTENT ROUTES — rendered inside AppLayout, children=null */}
    <Route path="/dashboard" element={<ProtectedRoute>{null}</ProtectedRoute>} />
    <Route path="/jobs" element={<PublicOrProtectedRoute>{null}</PublicOrProtectedRoute>} />
    <Route path="/queue" element={<ProtectedRoute>{null}</ProtectedRoute>} />
    <Route path="/radar" element={<ProtectedRoute>{null}</ProtectedRoute>} />

    {/* NON-PERSISTENT PROTECTED ROUTES */}
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

    {/* EMPLOYER ROUTES */}
    <Route path="/employer/dashboard" element={<EmployerRoute><EmployerDashboard /></EmployerRoute>} />
    <Route path="/employer/plans" element={<EmployerRoute><EmployerPlans /></EmployerRoute>} />
    <Route path="/employer/jobs" element={<EmployerRoute><EmployerJobs /></EmployerRoute>} />
    <Route path="/employer/jobs/new" element={<EmployerRoute><CreateJob /></EmployerRoute>} />
    <Route path="/employer/jobs/:jobId/applicants" element={<EmployerRoute><JobApplicants /></EmployerRoute>} />

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
