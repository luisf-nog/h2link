import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { isSupportedLanguage, type SupportedLanguage } from "@/i18n";
import {
  Upload,
  Mail,
  FileText,
  Send,
  BarChart3,
  Shield,
  Zap,
  Search,
  Clock,
  ArrowRight,
  CheckCircle2,
  Eye,
  Radar,
  Users,
  MapPin,
  ChevronDown,
  Globe,
  Gift,
  Crown,
  Bot,
  X,
  Check,
  Briefcase,
  Building2,
  UserCheck,
  TrendingUp,
  Star,
  ChevronRight,
  Layers,
  Database,
  Filter,
  Bell,
  Lock,
} from "lucide-react";
import { useState, useEffect } from "react";

type Role = "worker" | "employer" | null;

const tickerJobs = [
  { type: "H-2A", title: "Farmworker – Berries", location: "Salinas, CA", salary: "$16.00/h" },
  { type: "H-2B", title: "Concrete Finisher", location: "Morgantown, WV", salary: "$24.50/h" },
  { type: "H-2A", title: "Apple Harvester", location: "Yakima, WA", salary: "$17.20/h" },
  { type: "H-2B", title: "Landscape Laborer", location: "Austin, TX", salary: "$18.00/h" },
  { type: "H-2A", title: "Equipment Operator", location: "Des Moines, IA", salary: "$19.50/h" },
  { type: "H-2B", title: "Housekeeper", location: "Mackinaw City, MI", salary: "$15.50/h" },
  { type: "H-2A", title: "Tobacco Harvester", location: "Wilson, NC", salary: "$14.87/h" },
  { type: "H-2B", title: "Crab Picker", location: "Crisfield, MD", salary: "$16.54/h" },
];

export default function Landing() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [role, setRole] = useState<Role>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [hovered, setHovered] = useState<Role>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  const handleChangeLanguage = (next: SupportedLanguage) => {
    i18n.changeLanguage(next);
    localStorage.setItem("app_language", next);
  };

  const selectRole = (r: Role) => {
    setRole(r);
    setTimeout(() => {
      const el = document.getElementById("role-content");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  // Remove isLangPt/isLangEs — use t() instead

  const workerFeatures = [
    { icon: Database, title: t("landing.feat_radar_title"), desc: t("landing.feat_radar_desc") },
    { icon: Zap, title: t("landing.feat_ai_title"), desc: t("landing.feat_ai_desc") },
    { icon: Shield, title: t("landing.feat_warmup_title"), desc: t("landing.feat_warmup_desc") },
    { icon: Clock, title: t("landing.feat_delay_title"), desc: t("landing.feat_delay_desc") },
    { icon: Bot, title: t("landing.feat_aipref_title"), desc: t("landing.feat_aipref_desc"), badge: "Black" },
    { icon: Bell, title: t("landing.feat_autosend_title"), desc: t("landing.feat_autosend_desc") },
  ];

  const employerFeatures = [
    {
      icon: Users,
      wide: true,
      title: t("landing.employer_feat1_title"),
      desc: t("landing.employer_feat1_desc"),
    },
    {
      icon: Layers,
      wide: false,
      title: t("landing.employer_feat2_title"),
      desc: t("landing.employer_feat2_desc"),
    },
    {
      icon: Search,
      wide: false,
      title: t("landing.employer_feat3_title"),
      desc: t("landing.employer_feat3_desc"),
    },
    {
      icon: Briefcase,
      wide: false,
      title: t("landing.employer_feat4_title"),
      desc: t("landing.employer_feat4_desc"),
    },
    {
      icon: TrendingUp,
      wide: true,
      title: t("landing.employer_feat5_title"),
      desc: t("landing.employer_feat5_desc"),
    },
    {
      icon: FileText,
      wide: false,
      title: t("landing.employer_feat6_title"),
      desc: t("landing.employer_feat6_desc"),
    },
  ];

  const workerSteps = [
    { n: "01", icon: Upload, title: t("landing.step1_title"), desc: t("landing.step1_desc") },
    { n: "02", icon: Mail, title: t("landing.step2_title"), desc: t("landing.step2_desc") },
    { n: "03", icon: FileText, title: t("landing.step3_title"), desc: t("landing.step3_desc") },
    { n: "04", icon: Search, title: t("landing.step4_title"), desc: t("landing.step4_desc") },
    { n: "05", icon: Send, title: t("landing.step5_title"), desc: t("landing.step5_desc") },
    { n: "06", icon: BarChart3, title: t("landing.step6_title"), desc: t("landing.step6_desc") },
  ];

  const employerSteps = [
    { n: "01", icon: UserCheck, title: t("landing.employer_step1_title"), desc: t("landing.employer_step1_desc") },
    { n: "02", icon: Briefcase, title: t("landing.employer_step2_title"), desc: t("landing.employer_step2_desc") },
    { n: "03", icon: Layers, title: t("landing.employer_step3_title"), desc: t("landing.employer_step3_desc") },
    { n: "04", icon: Search, title: t("landing.employer_step4_title"), desc: t("landing.employer_step4_desc") },
    { n: "05", icon: FileText, title: t("landing.employer_step5_title"), desc: t("landing.employer_step5_desc") },
  ];

  const workerFaqs = [
    { q: t("landing.faq1_q"), a: t("landing.faq1_a") },
    { q: t("landing.faq2_q"), a: t("landing.faq2_a") },
    { q: t("landing.faq3_q"), a: t("landing.faq3_a") },
    { q: t("landing.faq4_q"), a: t("landing.faq4_a") },
    { q: t("landing.faq5_q"), a: t("landing.faq5_a") },
  ];

  const employerFaqs = [
    { q: t("landing.employer_faq1_q"), a: t("landing.employer_faq1_a") },
    { q: t("landing.employer_faq2_q"), a: t("landing.employer_faq2_a") },
    { q: t("landing.employer_faq3_q"), a: t("landing.employer_faq3_a") },
    { q: t("landing.employer_faq4_q"), a: t("landing.employer_faq4_a") },
    { q: t("landing.employer_faq5_q"), a: t("landing.employer_faq5_a") },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif; background: #ffffff; color: #020617; -webkit-font-smoothing: antialiased; }

        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }

        .ticker-track { display: flex; width: max-content; animation: ticker 38s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }

        .role-card {
          position: relative; cursor: pointer; overflow: hidden;
          transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1.5px solid #E2E8F0;
          border-radius: 14px;
        }
        .role-card:hover { transform: translateY(-3px); box-shadow: 0 20px 60px rgba(2,6,23,0.12); }
        .role-card.selected-worker { border-color: #D4500A; box-shadow: 0 0 0 3px rgba(212,80,10,0.12), 0 20px 60px rgba(212,80,10,0.1); }
        .role-card.selected-employer { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,0.12), 0 20px 60px rgba(14,165,233,0.1); }

        .step-card:hover .step-num { color: #020617; }
        .step-card:hover { border-color: #020617; }
        .feat-card:hover { background: #f8fafc; }
        .feat-card:hover .feat-icon { color: #D4500A; }
        .feat-card-employer:hover .feat-icon { color: #0ea5e9; }
        .faq-row:hover .faq-q { color: #D4500A; }
        .faq-row-employer:hover .faq-q { color: #0ea5e9; }
        .btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn-outline:hover { background: #020617; color: #fff; }
        .nav-cta:hover { opacity: 0.85; }

        .role-content-enter { animation: scaleIn 0.4s cubic-bezier(0.4,0,0.2,1) forwards; }

        .tab-pill {
          padding: 8px 20px; border-radius: 999px; font-size: 13px; font-weight: 600;
          cursor: pointer; border: none; font-family: inherit;
          transition: all 0.2s;
        }
        .tab-pill.active-worker { background: #D4500A; color: #fff; }
        .tab-pill.active-employer { background: #0ea5e9; color: #fff; }
        .tab-pill.inactive { background: transparent; color: #94A3B8; }
        .tab-pill.inactive:hover { color: #020617; }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }

        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .role-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .bento-grid { grid-template-columns: 1fr !important; }
          .footer-row { flex-direction: column !important; gap: 16px !important; align-items: center !important; text-align: center !important; }
          .req-grid { grid-template-columns: 1fr !important; gap: 0 !important; }
        }
        @media (min-width: 768px) {
          .steps-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .bento-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .role-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (min-width: 1024px) {
          .steps-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#fff" }}>
        {/* ── NAV ── */}
        <nav
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "#fff",
            borderBottom: "1px solid #E2E8F0",
            height: 68,
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              width: "100%",
              padding: "0 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <BrandWordmark height={38} />
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Role switcher pill — only visible after selection */}
              {role && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 999,
                    padding: "4px 6px",
                  }}
                >
                  <button
                    className={`tab-pill ${role === "worker" ? "active-worker" : "inactive"}`}
                    onClick={() => setRole("worker")}
                  >
                    {t("landing.role_worker_tab")}
                  </button>
                  <button
                    className={`tab-pill ${role === "employer" ? "active-employer" : "inactive"}`}
                    onClick={() => setRole("employer")}
                  >
                    {t("landing.role_employer_tab")}
                  </button>
                </div>
              )}

              <LanguageSwitcher
                value={isSupportedLanguage(i18n.language) ? i18n.language : "pt"}
                onChange={handleChangeLanguage}
              />
              <button
                className="nav-cta"
                onClick={() => navigate(user ? "/dashboard" : "/auth")}
                style={{
                  background: "#020617",
                  color: "#fff",
                  border: "none",
                  padding: "10px 22px",
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "opacity 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {user ? "Dashboard" : t("landing.nav_cta_auth")}
              </button>
            </div>
          </div>
        </nav>

        {/* ── ROLE SELECTOR HERO ── */}
        <section style={{ borderBottom: "1px solid #E2E8F0", padding: "80px 24px 72px" }}>
          <div style={{ maxWidth: 960, margin: "0 auto" }}>
            <div
              style={{
                textAlign: "center",
                marginBottom: 52,
                opacity: visible ? 1 : 0,
                animation: visible ? "fadeUp 0.6s ease forwards" : "none",
              }}
            >
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 24 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#22C55E",
                    boxShadow: "0 0 0 3px rgba(34,197,94,0.18)",
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#64748B",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {t("landing.status_tag")}
                </span>
              </div>
              <h1
                style={{
                  fontSize: "clamp(32px, 5vw, 52px)",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.1,
                  color: "#020617",
                  marginBottom: 16,
                }}
              >
                {t("landing.role_hero_title")}{" "}
                <span style={{ color: "#D4500A" }}>H2 Linker?</span>
              </h1>
              <p style={{ fontSize: 16, color: "#64748B", lineHeight: 1.7, maxWidth: 520, margin: "0 auto" }}>
                {t("landing.role_hero_subtitle")}
              </p>
            </div>

            {/* Role Cards */}
            <div
              className="role-grid"
              style={{
                display: "grid",
                gap: 20,
                opacity: visible ? 1 : 0,
                animation: visible ? "fadeUp 0.7s 0.1s ease both" : "none",
              }}
            >
              {/* Worker Card */}
              <div
                className={`role-card ${role === "worker" ? "selected-worker" : ""}`}
                onClick={() => selectRole("worker")}
                onMouseEnter={() => setHovered("worker")}
                onMouseLeave={() => setHovered(null)}
                style={{ background: role === "worker" ? "#FFFAF7" : "#fff", padding: "36px 32px" }}
              >
                {role === "worker" && (
                  <div
                    style={{
                      position: "absolute",
                      top: 16,
                      right: 16,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#D4500A",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Check size={12} color="#fff" />
                  </div>
                )}
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: role === "worker" || hovered === "worker" ? "rgba(212,80,10,0.08)" : "#F8FAFC",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 20,
                    transition: "background 0.2s",
                  }}
                >
                  <Users
                    size={24}
                    color={role === "worker" || hovered === "worker" ? "#D4500A" : "#94A3B8"}
                    style={{ transition: "color 0.2s" }}
                  />
                </div>
                <h2
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#020617",
                    marginBottom: 10,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {isLangPt ? "Sou Trabalhador" : isLangEs ? "Soy Trabajador" : "I'm a Worker"}
                </h2>
                <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.65, marginBottom: 24 }}>
                  {isLangPt
                    ? "Quero encontrar vagas H-2A/H-2B, enviar candidaturas em massa e aumentar minhas chances de conseguir emprego nos EUA."
                    : isLangEs
                      ? "Quiero encontrar trabajos H-2A/H-2B, enviar solicitudes en masa y aumentar mis posibilidades de conseguir empleo en EE.UU."
                      : "I want to find H-2A/H-2B jobs, send mass applications and increase my chances of getting employment in the US."}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
                  {[
                    isLangPt ? "10.000+ vagas DOL" : "10,000+ DOL jobs",
                    isLangPt ? "Envio automatizado" : "Automated sending",
                    isLangPt ? "IA por vaga" : "AI per job",
                    isLangPt ? "Radar de vagas" : "Job radar",
                  ].map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: 4,
                        background: "rgba(212,80,10,0.08)",
                        color: "#D4500A",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 14,
                    fontWeight: 600,
                    color: role === "worker" ? "#D4500A" : "#94A3B8",
                    transition: "color 0.2s",
                  }}
                >
                  {isLangPt ? "Ver funcionalidades" : isLangEs ? "Ver funcionalidades" : "See features"}{" "}
                  <ChevronRight size={15} />
                </div>
              </div>

              {/* Employer Card */}
              <div
                className={`role-card ${role === "employer" ? "selected-employer" : ""}`}
                onClick={() => selectRole("employer")}
                onMouseEnter={() => setHovered("employer")}
                onMouseLeave={() => setHovered(null)}
                style={{ background: role === "employer" ? "#F0F9FF" : "#fff", padding: "36px 32px" }}
              >
                {role === "employer" && (
                  <div
                    style={{
                      position: "absolute",
                      top: 16,
                      right: 16,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#0ea5e9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Check size={12} color="#fff" />
                  </div>
                )}
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: role === "employer" || hovered === "employer" ? "rgba(14,165,233,0.08)" : "#F8FAFC",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 20,
                    transition: "background 0.2s",
                  }}
                >
                  <Building2
                    size={24}
                    color={role === "employer" || hovered === "employer" ? "#0ea5e9" : "#94A3B8"}
                    style={{ transition: "color 0.2s" }}
                  />
                </div>
                <h2
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#020617",
                    marginBottom: 10,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {isLangPt ? "Sou Empregador" : isLangEs ? "Soy Empleador" : "I'm an Employer"}
                </h2>
                <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.65, marginBottom: 24 }}>
                  {isLangPt
                    ? "Quero encontrar trabalhadores H-2, centralizar candidaturas em um só lugar e simplificar minha documentação de recrutamento para o DOL."
                    : isLangEs
                      ? "Quiero encontrar trabajadores H-2, centralizar solicitudes en un solo lugar y simplificar mi documentación de reclutamiento para el DOL."
                      : "I want to find H-2 workers, organize applications in one place, and simplify my DOL recruitment documentation."}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
                  {[
                    isLangPt ? "Encontrar candidatos" : "Find candidates",
                    isLangPt ? "Candidaturas organizadas" : "Organized applications",
                    isLangPt ? "Menos intermediários" : "Less intermediaries",
                    isLangPt ? "Reporte DOL" : "DOL reporting",
                  ].map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: 4,
                        background: "rgba(14,165,233,0.08)",
                        color: "#0284c7",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 14,
                    fontWeight: 600,
                    color: role === "employer" ? "#0ea5e9" : "#94A3B8",
                    transition: "color 0.2s",
                  }}
                >
                  {isLangPt ? "Ver funcionalidades" : isLangEs ? "Ver funcionalidades" : "See features"}{" "}
                  <ChevronRight size={15} />
                </div>
              </div>
            </div>

            {/* No role selected hint */}
            {!role && (
              <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "#CBD5E1" }}>
                {isLangPt
                  ? "Clique em um perfil para continuar ↓"
                  : isLangEs
                    ? "Haz clic en un perfil para continuar ↓"
                    : "Click a profile to continue ↓"}
              </p>
            )}
          </div>
        </section>

        {/* ── JOBS TICKER (always visible) ── */}
        <div
          style={{
            borderBottom: "1px solid #E2E8F0",
            background: "#FAFAFA",
            overflow: "hidden",
            padding: "14px 0",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 80,
              background: "linear-gradient(to right, #FAFAFA, transparent)",
              zIndex: 2,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: 80,
              background: "linear-gradient(to left, #FAFAFA, transparent)",
              zIndex: 2,
              pointerEvents: "none",
            }}
          />
          <div className="ticker-track">
            {[...tickerJobs, ...tickerJobs].map((job, i) => (
              <div
                key={i}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "0 28px",
                  whiteSpace: "nowrap",
                  fontSize: 13,
                  color: "#020617",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    padding: "2px 7px",
                    borderRadius: 4,
                    background: job.type === "H-2A" ? "#DCFCE7" : "#DBEAFE",
                    color: job.type === "H-2A" ? "#15803D" : "#1D4ED8",
                  }}
                >
                  {job.type}
                </span>
                <span style={{ fontWeight: 600 }}>{job.title}</span>
                <span style={{ color: "#94A3B8", display: "flex", alignItems: "center", gap: 3 }}>
                  <MapPin size={11} /> {job.location}
                </span>
                <span style={{ color: "#64748B", fontWeight: 500 }}>{job.salary}</span>
                <span style={{ color: "#E2E8F0", fontSize: 20 }}>·</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── ROLE CONTENT ── */}
        {role && (
          <div id="role-content" className="role-content-enter">
            {/* ── WORKER CONTENT ── */}
            {role === "worker" && (
              <>
                {/* Worker Hero Banner */}
                <section style={{ padding: "72px 24px", borderBottom: "1px solid #E2E8F0", background: "#FFFAF7" }}>
                  <div
                    style={{
                      maxWidth: 1200,
                      margin: "0 auto",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 64,
                      alignItems: "center",
                    }}
                    className="hero-grid"
                  >
                    <div>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "rgba(212,80,10,0.08)",
                          border: "1px solid rgba(212,80,10,0.2)",
                          padding: "4px 12px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.07em",
                          color: "#D4500A",
                          textTransform: "uppercase",
                          marginBottom: 24,
                        }}
                      >
                        <Users size={11} /> {isLangPt ? "Área do Trabalhador" : "Worker Area"}
                      </div>
                      <h2
                        style={{
                          fontSize: "clamp(28px, 4vw, 44px)",
                          fontWeight: 700,
                          letterSpacing: "-0.025em",
                          lineHeight: 1.1,
                          color: "#020617",
                          marginBottom: 16,
                        }}
                      >
                        {t("landing.hero_title_1")}
                        <br />
                        {t("landing.hero_title_2")}
                        <br />
                        <span style={{ color: "#D4500A" }}>{t("landing.hero_title_3")}</span>
                      </h2>
                      <p style={{ fontSize: 16, color: "#64748B", lineHeight: 1.7, marginBottom: 32, maxWidth: 440 }}>
                        {t("landing.hero_desc")}
                      </p>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          className="btn-primary"
                          onClick={() => navigate("/auth")}
                          style={{
                            background: "#D4500A",
                            color: "#fff",
                            border: "none",
                            padding: "13px 24px",
                            borderRadius: 7,
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            transition: "all 0.2s",
                          }}
                        >
                          {t("landing.cta_create_account")} <ArrowRight size={15} />
                        </button>
                        <button
                          className="btn-outline"
                          onClick={() => navigate("/jobs")}
                          style={{
                            background: "transparent",
                            color: "#020617",
                            border: "1.5px solid #E2E8F0",
                            padding: "13px 20px",
                            borderRadius: 7,
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            transition: "all 0.2s",
                          }}
                        >
                          <Search size={15} /> {t("landing.cta_view_jobs")}
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0,
                        borderLeft: "1px solid #E2E8F0",
                        paddingLeft: 64,
                      }}
                    >
                      {[
                        {
                          value: t("landing.stats_jobs_value"),
                          label: t("landing.stats_jobs_label"),
                          sub: t("landing.stats_jobs_sub"),
                        },
                        {
                          value: t("landing.stats_update_value"),
                          label: t("landing.stats_update_label"),
                          sub: t("landing.stats_update_sub"),
                        },
                        {
                          value: t("landing.stats_free_value"),
                          label: t("landing.stats_free_label"),
                          sub: t("landing.stats_free_sub"),
                        },
                      ].map((s, i, arr) => (
                        <div
                          key={s.label}
                          style={{ padding: "24px 0", borderBottom: i < arr.length - 1 ? "1px solid #E2E8F0" : "none" }}
                        >
                          <div
                            style={{
                              fontSize: 32,
                              fontWeight: 700,
                              color: "#020617",
                              letterSpacing: "-0.02em",
                              lineHeight: 1,
                              marginBottom: 5,
                            }}
                          >
                            {s.value}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#020617", marginBottom: 2 }}>
                            {s.label}
                          </div>
                          <div style={{ fontSize: 13, color: "#94A3B8" }}>{s.sub}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* How it works — Worker */}
                <section style={{ padding: "88px 24px", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                    <div style={{ maxWidth: 560, marginBottom: 56 }}>
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "#D4500A",
                          marginBottom: 12,
                        }}
                      >
                        {t("landing.how_it_works_tag")}
                      </p>
                      <h2
                        style={{
                          fontSize: "clamp(28px, 4vw, 38px)",
                          fontWeight: 700,
                          letterSpacing: "-0.02em",
                          lineHeight: 1.15,
                        }}
                      >
                        {t("landing.how_it_works_title_1")}
                        <br />
                        {t("landing.how_it_works_title_2")}
                      </h2>
                    </div>
                    <div className="steps-grid" style={{ display: "grid", gap: 1, background: "#E2E8F0" }}>
                      {workerSteps.map((step) => (
                        <div
                          key={step.n}
                          className="step-card"
                          style={{
                            background: "#fff",
                            padding: "32px 28px",
                            transition: "border-color 0.15s",
                            border: "1px solid transparent",
                            cursor: "default",
                          }}
                        >
                          <div
                            className="step-num"
                            style={{
                              fontSize: 52,
                              fontWeight: 700,
                              lineHeight: 1,
                              color: "#F1F5F9",
                              marginBottom: 20,
                              transition: "color 0.2s",
                              letterSpacing: "-0.03em",
                            }}
                          >
                            {step.n}
                          </div>
                          <step.icon size={20} color="#D4500A" style={{ marginBottom: 14 }} />
                          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#020617" }}>
                            {step.title}
                          </h3>
                          <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.65 }}>{step.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Features — Worker */}
                <section style={{ padding: "88px 24px", background: "#FAFAFA", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                    <div style={{ maxWidth: 560, marginBottom: 56 }}>
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "#D4500A",
                          marginBottom: 12,
                        }}
                      >
                        {t("landing.features_tag")}
                      </p>
                      <h2
                        style={{
                          fontSize: "clamp(28px, 4vw, 38px)",
                          fontWeight: 700,
                          letterSpacing: "-0.02em",
                          lineHeight: 1.15,
                        }}
                      >
                        {t("landing.features_title_1")}
                        <br />
                        {t("landing.features_title_2")}
                      </h2>
                    </div>
                    <div
                      className="bento-grid"
                      style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}
                    >
                      {workerFeatures.map((f, i) => (
                        <div
                          key={f.title}
                          className="feat-card"
                          style={{
                            background: "#fff",
                            border: "1px solid #E2E8F0",
                            borderRadius: 10,
                            padding: "28px 24px",
                            gridColumn: i === 0 || i === 4 ? "span 2" : "span 1",
                            transition: "background 0.15s",
                            position: "relative",
                          }}
                        >
                          {f.badge && (
                            <div
                              style={{
                                position: "absolute",
                                top: 16,
                                right: 16,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                background: "#020617",
                                color: "#fff",
                                padding: "3px 8px",
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                              }}
                            >
                              <Crown size={9} /> {f.badge}
                            </div>
                          )}
                          <f.icon
                            className="feat-icon"
                            size={22}
                            style={{ color: "#CBD5E1", marginBottom: 16, transition: "color 0.2s" }}
                          />
                          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#020617" }}>
                            {f.title}
                          </h3>
                          <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.65 }}>{f.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Worker FAQ */}
                <section style={{ padding: "88px 24px", background: "#FAFAFA", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ maxWidth: 720, margin: "0 auto" }}>
                    <div style={{ textAlign: "center", marginBottom: 56 }}>
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "#D4500A",
                          marginBottom: 12,
                        }}
                      >
                        {t("landing.faq_tag")}
                      </p>
                      <h2 style={{ fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 700, letterSpacing: "-0.02em" }}>
                        {t("landing.faq_title")}
                      </h2>
                    </div>
                    <div
                      style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden", background: "#fff" }}
                    >
                      {workerFaqs.map((item, i) => (
                        <div
                          key={i}
                          className="faq-row"
                          style={{ borderBottom: i < workerFaqs.length - 1 ? "1px solid #E2E8F0" : "none" }}
                        >
                          <button
                            onClick={() => setOpenFaq(openFaq === i ? null : i)}
                            style={{
                              width: "100%",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "20px 24px",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontFamily: "inherit",
                              fontSize: 15,
                              fontWeight: 600,
                              color: "#020617",
                              textAlign: "left",
                              gap: 16,
                            }}
                          >
                            <span className="faq-q" style={{ transition: "color 0.15s" }}>
                              {item.q}
                            </span>
                            <ChevronDown
                              size={18}
                              style={{
                                color: "#94A3B8",
                                flexShrink: 0,
                                transform: openFaq === i ? "rotate(180deg)" : "none",
                                transition: "transform 0.22s",
                              }}
                            />
                          </button>
                          {openFaq === i && (
                            <div style={{ padding: "0 24px 20px", fontSize: 14, color: "#64748B", lineHeight: 1.7 }}>
                              {item.a}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Worker CTA */}
                <section style={{ padding: "88px 24px" }}>
                  <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                    <div
                      style={{
                        background: "#020617",
                        borderRadius: 16,
                        padding: "72px 48px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 40,
                        flexWrap: "wrap",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: -60,
                          right: -60,
                          width: 260,
                          height: 260,
                          borderRadius: "50%",
                          background: "rgba(212,80,10,0.08)",
                          pointerEvents: "none",
                        }}
                      />
                      <div style={{ position: "relative" }}>
                        <p
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color: "#D4500A",
                            marginBottom: 14,
                          }}
                        >
                          {t("landing.final_cta_tag")}
                        </p>
                        <h2
                          style={{
                            fontSize: "clamp(28px, 4vw, 44px)",
                            fontWeight: 700,
                            letterSpacing: "-0.025em",
                            lineHeight: 1.1,
                            color: "#fff",
                            marginBottom: 12,
                          }}
                        >
                          {t("landing.final_cta_title_1")}
                          <br />
                          {t("landing.final_cta_title_2")}
                        </h2>
                        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, maxWidth: 400 }}>
                          {t("landing.final_cta_desc")}
                        </p>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 12,
                          alignItems: "stretch",
                          position: "relative",
                          minWidth: 220,
                        }}
                      >
                        <button
                          className="btn-primary"
                          onClick={() => navigate("/auth")}
                          style={{
                            background: "#D4500A",
                            color: "#fff",
                            border: "none",
                            padding: "14px 28px",
                            borderRadius: 8,
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            transition: "all 0.2s",
                          }}
                        >
                          {t("landing.cta_create_account")} <ArrowRight size={16} />
                        </button>
                        <button
                          onClick={() => navigate("/jobs")}
                          style={{
                            background: "transparent",
                            color: "rgba(255,255,255,0.55)",
                            border: "none",
                            padding: "12px 28px",
                            borderRadius: 8,
                            fontSize: 14,
                            fontWeight: 500,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          <Globe size={14} /> {t("landing.final_cta_jobs")}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* ── EMPLOYER CONTENT ── */}
            {role === "employer" && (
              <>
                {/* Employer Hero Banner */}
                <section style={{ padding: "72px 24px", borderBottom: "1px solid #E2E8F0", background: "#F0F9FF" }}>
                  <div
                    style={{
                      maxWidth: 1200,
                      margin: "0 auto",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 64,
                      alignItems: "center",
                    }}
                    className="hero-grid"
                  >
                    <div>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "rgba(14,165,233,0.08)",
                          border: "1px solid rgba(14,165,233,0.2)",
                          padding: "4px 12px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.07em",
                          color: "#0284c7",
                          textTransform: "uppercase",
                          marginBottom: 24,
                        }}
                      >
                        <Building2 size={11} /> {isLangPt ? "Área do Empregador" : "Employer Area"}
                      </div>
                      <h2
                        style={{
                          fontSize: "clamp(28px, 4vw, 44px)",
                          fontWeight: 700,
                          letterSpacing: "-0.025em",
                          lineHeight: 1.1,
                          color: "#020617",
                          marginBottom: 16,
                        }}
                      >
                        {isLangPt ? (
                          <>
                            Recrute trabalhadores H-2
                            <br />
                            <span style={{ color: "#0ea5e9" }}>sem a confusão</span>
                          </>
                        ) : (
                          <>
                            Recruit H-2 workers
                            <br />
                            <span style={{ color: "#0ea5e9" }}>without the chaos</span>
                          </>
                        )}
                      </h2>
                      <p style={{ fontSize: 16, color: "#64748B", lineHeight: 1.7, marginBottom: 32, maxWidth: 440 }}>
                        {isLangPt
                          ? "O H2 Linker simplifica o recrutamento H-2 dando ao empregador as ferramentas para encontrar candidatos, organizar candidaturas e cuidar da documentação do DOL — tudo em um só lugar."
                          : "H2 Linker simplifies H-2 recruitment by giving employers the tools to find candidates, organize applications, and handle DOL documentation — all in one place."}
                      </p>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          className="btn-primary"
                          onClick={() => navigate("/employer/plans")}
                          style={{
                            background: "#0ea5e9",
                            color: "#fff",
                            border: "none",
                            padding: "13px 24px",
                            borderRadius: 7,
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            transition: "all 0.2s",
                          }}
                        >
                          {isLangPt ? "Centralizar meu recrutamento" : "Centralize my recruitment"}{" "}
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0,
                        borderLeft: "1px solid #BAE6FD",
                        paddingLeft: 64,
                      }}
                    >
                      {[
                        {
                          value: isLangPt ? "H-2A e H-2B" : "H-2A & H-2B",
                          label: isLangPt ? "Tipos de visto" : "Both visa types",
                          sub: isLangPt
                            ? "Trabalhadores configuram perfil por tipo de programa"
                            : "Workers set up profiles by program type",
                        },
                        {
                          value: isLangPt ? "1 lugar" : "1 place",
                          label: isLangPt ? "Para todas as candidaturas" : "For all applications",
                          sub: isLangPt
                            ? "Sem ficar espalhado entre e-mails e apps"
                            : "No more scattered emails and messaging apps",
                        },
                        {
                          value: "DOL-ready",
                          label: isLangPt ? "Registros de recrutamento" : "Recruitment records",
                          sub: isLangPt
                            ? "Relatórios organizados sem coleta manual"
                            : "Organized reporting without manual collection",
                        },
                      ].map((s, i, arr) => (
                        <div
                          key={s.label}
                          style={{ padding: "24px 0", borderBottom: i < arr.length - 1 ? "1px solid #BAE6FD" : "none" }}
                        >
                          <div
                            style={{
                              fontSize: 32,
                              fontWeight: 700,
                              color: "#020617",
                              letterSpacing: "-0.02em",
                              lineHeight: 1,
                              marginBottom: 5,
                            }}
                          >
                            {s.value}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#020617", marginBottom: 2 }}>
                            {s.label}
                          </div>
                          <div style={{ fontSize: 13, color: "#94A3B8" }}>{s.sub}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* How it works — Employer */}
                <section style={{ padding: "88px 24px", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                    <div style={{ maxWidth: 560, marginBottom: 56 }}>
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "#0ea5e9",
                          marginBottom: 12,
                        }}
                      >
                        {t("landing.how_it_works_tag")}
                      </p>
                      <h2
                        style={{
                          fontSize: "clamp(28px, 4vw, 38px)",
                          fontWeight: 700,
                          letterSpacing: "-0.02em",
                          lineHeight: 1.15,
                        }}
                      >
                        {isLangPt ? (
                          <>
                            Do cadastro à contratação
                            <br />
                            em 5 passos simples
                          </>
                        ) : (
                          <>
                            From signup to hiring
                            <br />
                            in 5 simple steps
                          </>
                        )}
                      </h2>
                    </div>
                    <div className="steps-grid" style={{ display: "grid", gap: 1, background: "#E2E8F0" }}>
                      {employerSteps.map((step) => (
                        <div
                          key={step.n}
                          className="step-card"
                          style={{
                            background: "#fff",
                            padding: "32px 28px",
                            transition: "border-color 0.15s",
                            border: "1px solid transparent",
                            cursor: "default",
                          }}
                        >
                          <div
                            className="step-num"
                            style={{
                              fontSize: 52,
                              fontWeight: 700,
                              lineHeight: 1,
                              color: "#F1F5F9",
                              marginBottom: 20,
                              transition: "color 0.2s",
                              letterSpacing: "-0.03em",
                            }}
                          >
                            {step.n}
                          </div>
                          <step.icon size={20} color="#0ea5e9" style={{ marginBottom: 14 }} />
                          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#020617" }}>
                            {step.title}
                          </h3>
                          <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.65 }}>{step.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Features — Employer */}
                <section style={{ padding: "88px 24px", background: "#FAFAFA", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                    <div style={{ maxWidth: 560, marginBottom: 56 }}>
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "#0ea5e9",
                          marginBottom: 12,
                        }}
                      >
                        {t("landing.features_tag")}
                      </p>
                      <h2
                        style={{
                          fontSize: "clamp(28px, 4vw, 38px)",
                          fontWeight: 700,
                          letterSpacing: "-0.02em",
                          lineHeight: 1.15,
                        }}
                      >
                        {isLangPt ? (
                          <>
                            Ferramentas que tornam
                            <br />a contratação eficiente
                          </>
                        ) : (
                          <>
                            Tools that make
                            <br />
                            hiring efficient
                          </>
                        )}
                      </h2>
                    </div>
                    <div
                      className="bento-grid"
                      style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}
                    >
                      {employerFeatures.map((f, i) => (
                        <div
                          key={i}
                          className="feat-card feat-card-employer"
                          style={{
                            background: "#fff",
                            border: "1px solid #E2E8F0",
                            borderRadius: 10,
                            padding: "28px 24px",
                            gridColumn: f.wide ? "span 2" : "span 1",
                            transition: "background 0.15s",
                            position: "relative",
                          }}
                        >
                          <f.icon
                            className="feat-icon"
                            size={22}
                            style={{ color: "#CBD5E1", marginBottom: 16, transition: "color 0.2s" }}
                          />
                          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#020617" }}>
                            {f.title}
                          </h3>
                          <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.65 }}>{f.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* ── INDUSTRY SOCIAL PROOF STRIP ── */}
                <section style={{ padding: "52px 24px", background: "#fff", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "#94A3B8",
                        marginBottom: 32,
                      }}
                    >
                      {isLangPt
                        ? "Conectando os principais setores do programa H-2"
                        : "Connecting the leading sectors of the H-2 program"}
                    </p>
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
                      {[
                        { icon: "🌾", labelPt: "Agricultura", labelEn: "Agriculture" },
                        { icon: "🏗️", labelPt: "Construção", labelEn: "Construction" },
                        { icon: "🌿", labelPt: "Paisagismo", labelEn: "Landscaping" },
                        { icon: "🏨", labelPt: "Hospitalidade", labelEn: "Hospitality" },
                        { icon: "🐟", labelPt: "Pesca", labelEn: "Seafood" },
                        { icon: "🎿", labelPt: "Ski Resorts", labelEn: "Ski Resorts" },
                        { icon: "🌲", labelPt: "Silvicultura", labelEn: "Forestry" },
                      ].map((sector, i, arr) => (
                        <div key={sector.labelEn} style={{ display: "flex", alignItems: "center" }}>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 10,
                              padding: "16px 28px",
                            }}
                          >
                            <span style={{ fontSize: 28 }}>{sector.icon}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B", letterSpacing: "0.02em" }}>
                              {isLangPt ? sector.labelPt : sector.labelEn}
                            </span>
                          </div>
                          {i < arr.length - 1 && (
                            <div style={{ width: 1, height: 36, background: "#E2E8F0", flexShrink: 0 }} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Employer FAQ */}
                <section style={{ padding: "88px 24px", background: "#FAFAFA", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ maxWidth: 720, margin: "0 auto" }}>
                    <div style={{ textAlign: "center", marginBottom: 56 }}>
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "#0ea5e9",
                          marginBottom: 12,
                        }}
                      >
                        {t("landing.faq_tag")}
                      </p>
                      <h2 style={{ fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 700, letterSpacing: "-0.02em" }}>
                        {t("landing.faq_title")}
                      </h2>
                    </div>
                    <div
                      style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden", background: "#fff" }}
                    >
                      {employerFaqs.map((item, i) => (
                        <div
                          key={i}
                          className="faq-row-employer"
                          style={{ borderBottom: i < employerFaqs.length - 1 ? "1px solid #E2E8F0" : "none" }}
                        >
                          <button
                            onClick={() => setOpenFaq(openFaq === 100 + i ? null : 100 + i)}
                            style={{
                              width: "100%",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "20px 24px",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontFamily: "inherit",
                              fontSize: 15,
                              fontWeight: 600,
                              color: "#020617",
                              textAlign: "left",
                              gap: 16,
                            }}
                          >
                            <span className="faq-q" style={{ transition: "color 0.15s" }}>
                              {item.q}
                            </span>
                            <ChevronDown
                              size={18}
                              style={{
                                color: "#94A3B8",
                                flexShrink: 0,
                                transform: openFaq === 100 + i ? "rotate(180deg)" : "none",
                                transition: "transform 0.22s",
                              }}
                            />
                          </button>
                          {openFaq === 100 + i && (
                            <div style={{ padding: "0 24px 20px", fontSize: 14, color: "#64748B", lineHeight: 1.7 }}>
                              {item.a}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Employer CTA */}
                <section style={{ padding: "88px 24px" }}>
                  <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                    <div
                      style={{
                        background: "#020617",
                        borderRadius: 16,
                        padding: "72px 48px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 40,
                        flexWrap: "wrap",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: -60,
                          right: -60,
                          width: 260,
                          height: 260,
                          borderRadius: "50%",
                          background: "rgba(14,165,233,0.06)",
                          pointerEvents: "none",
                        }}
                      />
                      <div style={{ position: "relative" }}>
                        <p
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color: "#38bdf8",
                            marginBottom: 14,
                          }}
                        >
                          {isLangPt ? "Comece agora" : "Start now"}
                        </p>
                        <h2
                          style={{
                            fontSize: "clamp(28px, 4vw, 44px)",
                            fontWeight: 700,
                            letterSpacing: "-0.025em",
                            lineHeight: 1.1,
                            color: "#fff",
                            marginBottom: 12,
                          }}
                        >
                          {isLangPt ? (
                            <>
                              Pronto para simplificar
                              <br />o recrutamento H-2?
                            </>
                          ) : (
                            <>
                              Ready to simplify
                              <br />
                              H-2 recruitment?
                            </>
                          )}
                        </h2>
                        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, maxWidth: 400 }}>
                          {isLangPt
                            ? "Crie sua conta e comece a encontrar trabalhadores, organizar candidaturas e gerenciar documentação DOL em um só lugar."
                            : "Create your employer account and start finding workers, organizing applications, and managing DOL documentation in one place."}
                        </p>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 12,
                          alignItems: "stretch",
                          position: "relative",
                          minWidth: 220,
                        }}
                      >
                        <button
                          className="btn-primary"
                          onClick={() => navigate("/employer/plans")}
                          style={{
                            background: "#0ea5e9",
                            color: "#fff",
                            border: "none",
                            padding: "14px 28px",
                            borderRadius: 8,
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            transition: "all 0.2s",
                          }}
                        >
                          {isLangPt ? "Começar a receber candidatos" : "Start receiving candidates"}{" "}
                          <ArrowRight size={16} />
                        </button>
                        <button
                          onClick={() => navigate("/jobs")}
                          style={{
                            background: "transparent",
                            color: "rgba(255,255,255,0.55)",
                            border: "none",
                            padding: "12px 28px",
                            borderRadius: 8,
                            fontSize: 14,
                            fontWeight: 500,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          <Globe size={14} /> {isLangPt ? "Ver vagas disponíveis" : "View available jobs"}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        )}

        {/* ── FOOTER ── */}
        <footer style={{ borderTop: "1px solid #E2E8F0", padding: "28px 24px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div
              className="footer-row"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}
            >
              <BrandWordmark height={26} />
              <p style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500 }}>
                © {new Date().getFullYear()} H2 Linker — {t("footer.tagline")}
              </p>
            </div>
            <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 14 }}>
              <p style={{ fontSize: 11, color: "#CBD5E1", lineHeight: 1.6, maxWidth: 760 }}>
                H2 Linker is a recruitment technology platform and is not a law firm or a government agency. H2 Linker
                does not provide legal advice and is not affiliated with the U.S. Department of Labor (DOL) or U.S.
                Citizenship and Immigration Services (USCIS). All visa and compliance requirements are the sole
                responsibility of the employer and worker.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
