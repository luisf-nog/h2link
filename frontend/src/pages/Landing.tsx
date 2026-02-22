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
} from "lucide-react";
import { useState } from "react";

// ─── Jobs ticker data ────────────────
const tickerJobs = [
  { type: "H-2A", title: "Farmworker – Berries", location: "Salinas, CA", salary: "$16.00/h" },
  { type: "H-2B", title: "Concrete Finisher", location: "Morgantown, WV", salary: "$24.50/h" },
  { type: "H-2A", title: "Apple Harvester", location: "Yakima, WA", salary: "$17.20/h" },
  { type: "H-2B", title: "Landscape Laborer", location: "Austin, TX", salary: "$18.00/h" },
  { type: "H-2A", title: "Equipment Operator", location: "Des Moines, IA", salary: "$19.50/h" },
  { type: "H-2B", title: "Housekeeper", location: "Mackinaw City, MI", salary: "$15.50/h" },
  { type: "H-2A", title: "Tobacco Harvester", location: "Wilson, NC", salary: "$14.87/h" },
  { type: "H-2B", title: "Crab Picker", location: "Crisfield, MD", salary: "$16.54/h" },
  { type: "H-2A", title: "Nursery Worker", location: "Apopka, FL", salary: "$13.67/h" },
  { type: "H-2B", title: "Ski Lift Operator", location: "Vail, CO", salary: "$20.00/h" },
];

const stepIcons = [Upload, Mail, FileText, Search, Send, BarChart3];

const featureConfigs = [
  { icon: Shield, key: "warmup", badge: null, wide: true },
  { icon: Zap, key: "ai", badge: null, wide: false },
  { icon: Eye, key: "spy", badge: null, wide: false },
  { icon: Send, key: "autosend", badge: null, wide: false },
  { icon: Clock, key: "delay", badge: null, wide: false },
  { icon: Bot, key: "aipref", badge: "Black", wide: true },
  { icon: FileText, key: "jobcard", badge: null, wide: true },
  { icon: Radar, key: "radar", badge: null, wide: false },
  { icon: Users, key: "referrals", badge: null, wide: false },
];

export default function Landing() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleChangeLanguage = (next: SupportedLanguage) => {
    i18n.changeLanguage(next);
    localStorage.setItem("app_language", next);
  };

  const steps = Array.from({ length: 6 }, (_, i) => ({
    n: String(i + 1).padStart(2, "0"),
    icon: stepIcons[i],
    title: t(`landing.step${i + 1}_title`),
    desc: t(`landing.step${i + 1}_desc`),
  }));

  const faqs = Array.from({ length: 5 }, (_, i) => ({
    q: t(`landing.faq${i + 1}_q`),
    a: t(`landing.faq${i + 1}_a`),
  }));

  const heroStats = [
    {
      value: t("landing.stats_jobs_value"),
      label: t("landing.stats_jobs_label"),
      sub: t("landing.stats_jobs_sub"),
      border: true,
    },
    {
      value: t("landing.stats_update_value"),
      label: t("landing.stats_update_label"),
      sub: t("landing.stats_update_sub"),
      border: true,
    },
    {
      value: t("landing.stats_free_value"),
      label: t("landing.stats_free_label"),
      sub: t("landing.stats_free_sub"),
      border: false,
    },
  ];

  const pricingBenefits = Array.from({ length: 5 }, (_, i) => t(`landing.pricing_benefit${i + 1}`));
  const competitorItems = Array.from({ length: 5 }, (_, i) => t(`landing.pricing_competitor${i + 1}`));

  const referralSteps = Array.from({ length: 4 }, (_, i) => ({
    n: String(i + 1).padStart(2, "0"),
    title: t(`landing.referral_step${i + 1}_title`),
    desc: t(`landing.referral_step${i + 1}_desc`),
  }));

  const requirements = Array.from({ length: 4 }, (_, i) => ({
    title: t(`landing.req${i + 1}_title`),
    desc: t(`landing.req${i + 1}_desc`),
  }));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
          background: #ffffff;
          color: #020617;
          -webkit-font-smoothing: antialiased;
        }

        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .ticker-track {
          display: flex;
          width: max-content;
          animation: ticker 38s linear infinite;
        }
        .ticker-track:hover { animation-play-state: paused; }
        .step-card:hover .step-num { color: #020617; }
        .step-card:hover { border-color: #020617; }
        .feat-card:hover { background: #f8fafc; }
        .feat-card:hover .feat-icon { color: hsl(199,88%,48%); }
        .t-card:hover { background: #f8fafc; border-color: #cbd5e1; }
        .t-quoteMark { user-select: none; }
        .faq-row:hover .faq-q { color: #D4500A; }
        .btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn-outline:hover { background: #020617; color: #fff; }
        .btn-ghost:hover  { color: #020617; }
        .nav-cta:hover { opacity: 0.85; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }

        @media (max-width: 768px) {
          .hero-grid     { grid-template-columns: 1fr !important; }
          .hero-left     { padding: 56px 0 32px !important; border-right: none !important; border-bottom: 1px solid #E2E8F0; }
          .hero-right    { padding: 32px 0 56px !important; }
          .steps-grid    { grid-template-columns: 1fr !important; }
          .bento-grid    { grid-template-columns: 1fr !important; }
          .lifetime-grid { grid-template-columns: 1fr !important; }
          .cta-row       { flex-direction: column !important; align-items: stretch !important; }
          .footer-row    { flex-direction: column !important; gap: 16px !important; align-items: center !important; text-align: center !important; }
          .req-grid      { grid-template-columns: 1fr !important; gap: 0 !important; }
        }
        @media (min-width: 768px) {
          .steps-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .bento-grid { grid-template-columns: repeat(3, 1fr) !important; }
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
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
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
                  lineHeight: 1.4,
                }}
              >
                {user ? "Dashboard" : t("landing.nav_cta_auth")}
              </button>
            </div>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section style={{ borderBottom: "1px solid #E2E8F0" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 540 }} className="hero-grid">
              <div
                style={{
                  padding: "72px 64px 72px 0",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  borderRight: "1px solid #E2E8F0",
                }}
                className="hero-left"
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    marginBottom: 32,
                    alignSelf: "flex-start",
                  }}
                >
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
                    fontSize: "clamp(36px, 4vw, 54px)",
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    lineHeight: 1.1,
                    color: "#020617",
                    marginBottom: 20,
                  }}
                >
                  {t("landing.hero_title_1")}
                  <br />
                  {t("landing.hero_title_2")}
                  <br />
                  <span style={{ color: "#D4500A" }}>{t("landing.hero_title_3")}</span>
                </h1>

                <p style={{ fontSize: 16, color: "#64748B", lineHeight: 1.7, marginBottom: 36, maxWidth: 440 }}>
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
                      whiteSpace: "nowrap",
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
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Search size={15} /> {t("landing.cta_view_jobs")}
                  </button>
                </div>
              </div>

              <div
                style={{
                  padding: "72px 0 72px 64px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 0,
                }}
                className="hero-right"
              >
                {heroStats.map((s) => (
                  <div
                    key={s.label}
                    style={{ padding: "28px 0", borderBottom: s.border ? "1px solid #E2E8F0" : "none" }}
                  >
                    <div
                      style={{
                        fontSize: 34,
                        fontWeight: 700,
                        color: "#020617",
                        letterSpacing: "-0.02em",
                        lineHeight: 1,
                        marginBottom: 6,
                      }}
                    >
                      {s.value}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#020617", marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontSize: 13, color: "#94A3B8" }}>{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── JOBS TICKER ── */}
        <div
          style={{
            borderTop: "1px solid #E2E8F0",
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
                <span style={{ color: "#E2E8F0", fontSize: 20, lineHeight: 1 }}>·</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── HOW IT WORKS ── */}
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
              {steps.map((step) => (
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
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#020617" }}>{step.title}</h3>
                  <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.65 }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES BENTO ── */}
        <section style={{ padding: "88px 24px", background: "#FAFAFA", borderBottom: "1px solid #E2E8F0" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ maxWidth: 560, marginBottom: 56 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "hsl(199,88%,40%)",
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

            <div className="bento-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {featureConfigs.map((f) => (
                <div
                  key={f.key}
                  className="feat-card"
                  style={{
                    background: "#fff",
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    padding: "28px 24px",
                    gridColumn: f.wide ? "span 2" : "span 1",
                    transition: "background 0.15s",
                    cursor: "default",
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
                        background: f.badge === "Black" ? "#020617" : "hsl(199,88%,48%,0.1)",
                        color: f.badge === "Black" ? "#fff" : "hsl(199,88%,35%)",
                        border: f.badge === "Black" ? "none" : "1px solid hsl(199,88%,48%,0.3)",
                        padding: "3px 8px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      {f.badge === "Black" && <Crown size={9} />}
                      {t("landing.plan_badge", { plan: f.badge })}
                    </div>
                  )}
                  <f.icon
                    className="feat-icon"
                    size={22}
                    style={{ color: "#CBD5E1", marginBottom: 16, transition: "color 0.2s" }}
                  />
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#020617" }}>
                    {t(`landing.feat_${f.key}_title`)}
                  </h3>
                  <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.65, maxWidth: f.wide ? 520 : "none" }}>
                    {t(`landing.feat_${f.key}_desc`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS (Updated: Name & Country Hardcoded) ── */}
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
                {t("landing.testimonials_tag")}
              </p>
              <h2
                style={{
                  fontSize: "clamp(28px, 4vw, 38px)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                }}
              >
                {t("landing.testimonials_title_1")}
                <br />
                {t("landing.testimonials_title_2")}
              </h2>
            </div>

            <div style={{ display: "flex", justifyContent: "center" }}>
              <div
                className="t-card"
                style={{
                  background: "#fff",
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  padding: "32px 28px",
                  position: "relative",
                  overflow: "hidden",
                  maxWidth: 640,
                  width: "100%",
                }}
              >
                <div
                  className="t-quoteMark"
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 16,
                    fontSize: 72,
                    fontWeight: 700,
                    color: "#F1F5F9",
                    lineHeight: 1,
                    letterSpacing: "-0.04em",
                  }}
                  aria-hidden="true"
                >
                  "
                </div>

                <div style={{ position: "relative", paddingTop: 28 }}>
                  <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.75 }}>{t("landing.testimonial1_quote")}</p>
                  <div style={{ marginTop: 24 }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#020617" }}>Cassiano Andrade</span>
                        <span style={{ fontSize: 14, color: "#64748B", fontWeight: 500 }}>, from Brazil</span>
                      </div>
                      <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>
                        {t("landing.testimonial_user_label")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PRICING COMPARISON ── */}
        <section style={{ padding: "88px 24px", borderBottom: "1px solid #E2E8F0" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
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
                {t("landing.pricing_tag")}
              </p>
              <h2
                style={{
                  fontSize: "clamp(28px, 4vw, 42px)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                }}
              >
                {t("landing.pricing_title_1")}
                <br />
                {t("landing.pricing_title_2")}
              </h2>
            </div>

            <div
              className="lifetime-grid"
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "stretch" }}
            >
              <div
                style={{
                  background: "#020617",
                  borderRadius: 12,
                  padding: "48px 40px",
                  color: "#fff",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -40,
                    right: -40,
                    width: 200,
                    height: 200,
                    borderRadius: "50%",
                    background: "hsl(199,88%,48%,0.06)",
                    pointerEvents: "none",
                  }}
                />
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: "hsl(199,88%,48%,0.12)",
                      border: "1px solid hsl(199,88%,48%,0.25)",
                      padding: "4px 12px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.07em",
                      color: "hsl(199,88%,65%)",
                      textTransform: "uppercase",
                      marginBottom: 28,
                    }}
                  >
                    <Crown size={11} /> {t("landing.pricing_h2linker_badge")}
                  </div>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <span
                    style={{
                      fontSize: 14,
                      color: "rgba(255,255,255,0.5)",
                      textTransform: "uppercase",
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {t("landing.pricing_from")}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 56,
                    fontWeight: 700,
                    color: "#fff",
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                    marginBottom: 8,
                  }}
                >
                  $19<span style={{ fontSize: 28, fontWeight: 500, color: "rgba(255,255,255,0.4)" }}>.99</span>
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.7)",
                    marginBottom: 36,
                    lineHeight: 1.4,
                  }}
                >
                  {t("landing.pricing_one_time")}
                  <br />
                  {t("landing.pricing_lifetime")}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {pricingBenefits.map((item) => (
                    <div key={item} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "#15803D",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Check size={11} color="#fff" />
                      </div>
                      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>{item}</span>
                    </div>
                  ))}
                </div>

                <button
                  className="btn-primary"
                  onClick={() => navigate("/auth")}
                  style={{
                    marginTop: 36,
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
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("landing.pricing_cta")} <ArrowRight size={15} />
                </button>
              </div>

              <div
                style={{ background: "#FAFAFA", border: "1px solid #E2E8F0", borderRadius: 12, padding: "48px 40px" }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    padding: "4px 12px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.07em",
                    color: "#DC2626",
                    textTransform: "uppercase",
                    marginBottom: 28,
                  }}
                >
                  {t("landing.pricing_competitor_badge")}
                </div>

                <div style={{ marginBottom: 8 }}>
                  <span
                    style={{
                      fontSize: 56,
                      fontWeight: 700,
                      color: "#94A3B8",
                      letterSpacing: "-0.03em",
                      lineHeight: 1,
                      textDecoration: "line-through",
                    }}
                  >
                    {t("landing.pricing_competitor_price")}
                  </span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#94A3B8", marginBottom: 36, lineHeight: 1.4 }}>
                  {t("landing.pricing_competitor_sub1")}
                  <br />
                  {t("landing.pricing_competitor_sub2")}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {competitorItems.map((item) => (
                    <div key={item} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "#FEE2E2",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <X size={11} color="#DC2626" />
                      </div>
                      <span style={{ fontSize: 14, color: "#94A3B8", fontWeight: 500 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── REFERRAL PROGRAM ── */}
        <section style={{ padding: "72px 24px", background: "#FAFAFA", borderBottom: "1px solid #E2E8F0" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 48, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 320px" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "hsl(142,76%,36%,0.08)",
                    border: "1px solid hsl(142,76%,36%,0.2)",
                    padding: "4px 12px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.07em",
                    color: "#15803D",
                    textTransform: "uppercase",
                    marginBottom: 20,
                  }}
                >
                  <Gift size={11} /> {t("landing.referral_tag")}
                </div>
                <h2
                  style={{
                    fontSize: "clamp(24px, 3.5vw, 34px)",
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.15,
                    marginBottom: 16,
                  }}
                >
                  {t("landing.referral_title_1")}
                  <br />
                  {t("landing.referral_title_2")}
                </h2>
                <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.7, maxWidth: 420 }}>
                  {t("landing.referral_desc")}
                </p>
              </div>

              <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 0 }}>
                {referralSteps.map((step, i, arr) => (
                  <div
                    key={step.n}
                    style={{
                      display: "flex",
                      gap: 16,
                      padding: "18px 0",
                      borderBottom: i < arr.length - 1 ? "1px solid #E2E8F0" : "none",
                      alignItems: "flex-start",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 12,
                        color: "#CBD5E1",
                        letterSpacing: "0.03em",
                        flexShrink: 0,
                        paddingTop: 2,
                        minWidth: 24,
                      }}
                    >
                      {step.n}
                    </span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#020617", marginBottom: 3 }}>
                        {step.title}
                      </div>
                      <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── REQUIREMENTS ── */}
        <section style={{ padding: "88px 24px", borderBottom: "1px solid #E2E8F0" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div
              className="req-grid"
              style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 80, alignItems: "start" }}
            >
              <div style={{ position: "sticky", top: 88 }}>
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
                  {t("landing.requirements_tag")}
                </p>
                <h2
                  style={{
                    fontSize: "clamp(26px, 3.5vw, 34px)",
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.2,
                    marginBottom: 16,
                  }}
                >
                  {t("landing.requirements_title")}
                </h2>
                <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.7 }}>{t("landing.requirements_desc")}</p>

                <button
                  className="btn-primary"
                  onClick={() => navigate("/auth")}
                  style={{
                    marginTop: 32,
                    background: "#020617",
                    color: "#fff",
                    border: "none",
                    padding: "12px 22px",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    transition: "all 0.2s",
                  }}
                >
                  {t("landing.requirements_cta")} <ArrowRight size={15} />
                </button>
              </div>

              <div>
                {requirements.map((item, i, arr) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 18,
                      padding: "26px 0",
                      borderBottom: i < arr.length - 1 ? "1px solid #E2E8F0" : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "#DCFCE7",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <CheckCircle2 size={16} color="#15803D" />
                    </div>
                    <div>
                      <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: "#020617" }}>{item.title}</h4>
                      <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.65 }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
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

            <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
              {faqs.map((item, i) => (
                <div
                  key={i}
                  className="faq-row"
                  style={{ borderBottom: i < faqs.length - 1 ? "1px solid #E2E8F0" : "none" }}
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
                      transition: "color 0.15s",
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

        {/* ── FINAL CTA ── */}
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
                  background: "hsl(199,88%,48%,0.08)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: -40,
                  left: "40%",
                  width: 180,
                  height: 180,
                  borderRadius: "50%",
                  background: "hsl(199,88%,48%,0.05)",
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
                    color: "hsl(199,88%,58%)",
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
                className="cta-row"
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
                    whiteSpace: "nowrap",
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
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
                >
                  <Globe size={14} /> {t("landing.final_cta_jobs")}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ borderTop: "1px solid #E2E8F0", padding: "32px 24px" }}>
          <div
            className="footer-row"
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <BrandWordmark height={26} />
            <p style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500 }}>
              © {new Date().getFullYear()} H2 Linker — {t("footer.tagline")}
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
