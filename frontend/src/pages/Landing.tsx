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
  Infinity as InfinityIcon,
  Gift,
  Crown,
  Bot,
  X,
  Check,
} from "lucide-react";
import { useState } from "react";

/** ─────────────────────────────────────────────────────────────────────────
 *  Flag: Brazil (mais bonita e consistente)
 *  ──────────────────────────────────────────────────────────────────────── */
function BRFlagMark({ size = 24 }: { size?: number }) {
  const s = size;
  return (
    <span
      aria-label="Brazil"
      title="Brazil"
      style={{
        width: s,
        height: s,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        background: "#fff",
        border: "1px solid #E2E8F0",
        boxShadow: "0 1px 2px rgba(2,6,23,0.10)",
      }}
    >
      <svg width={Math.round(s * 0.78)} height={Math.round(s * 0.78)} viewBox="0 0 64 64" style={{ display: "block" }}>
        <defs>
          <radialGradient id="g" cx="30%" cy="25%" r="80%">
            <stop offset="0%" stopColor="#28C76F" stopOpacity="1" />
            <stop offset="100%" stopColor="#1F8B3A" stopOpacity="1" />
          </radialGradient>
        </defs>

        <circle cx="32" cy="32" r="30" fill="url(#g)" />
        <path d="M32 10 L54 32 L32 54 L10 32 Z" fill="#F7C600" />
        <circle cx="32" cy="32" r="12" fill="#1E4AA8" />
        <path
          d="M19 31.5 C26 26, 38 26, 45 31.5"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.95"
        />
        <path
          d="M14 22 C18 15, 25 11, 32 11"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/** ─────────────────────────────────────────────────────────────────────────
 *  i18n keys (sem texto hardcoded)
 *  ──────────────────────────────────────────────────────────────────────── */
type FaqItem = { qKey: string; aKey: string };
type TickerJob = { typeKey: string; titleKey: string; locationKey: string; salaryKey: string };
type StepItem = { n: string; icon: any; titleKey: string; descKey: string };
type FeatureItem = { icon: any; titleKey: string; descKey: string; badge: "Black" | null; wide: boolean };

const faqs: FaqItem[] = [
  { qKey: "landing.faq.0.q", aKey: "landing.faq.0.a" },
  { qKey: "landing.faq.1.q", aKey: "landing.faq.1.a" },
  { qKey: "landing.faq.2.q", aKey: "landing.faq.2.a" },
  { qKey: "landing.faq.3.q", aKey: "landing.faq.3.a" },
  { qKey: "landing.faq.4.q", aKey: "landing.faq.4.a" },
];

const tickerJobs: TickerJob[] = [
  {
    typeKey: "landing.ticker.0.type",
    titleKey: "landing.ticker.0.title",
    locationKey: "landing.ticker.0.location",
    salaryKey: "landing.ticker.0.salary",
  },
  {
    typeKey: "landing.ticker.1.type",
    titleKey: "landing.ticker.1.title",
    locationKey: "landing.ticker.1.location",
    salaryKey: "landing.ticker.1.salary",
  },
  {
    typeKey: "landing.ticker.2.type",
    titleKey: "landing.ticker.2.title",
    locationKey: "landing.ticker.2.location",
    salaryKey: "landing.ticker.2.salary",
  },
  {
    typeKey: "landing.ticker.3.type",
    titleKey: "landing.ticker.3.title",
    locationKey: "landing.ticker.3.location",
    salaryKey: "landing.ticker.3.salary",
  },
  {
    typeKey: "landing.ticker.4.type",
    titleKey: "landing.ticker.4.title",
    locationKey: "landing.ticker.4.location",
    salaryKey: "landing.ticker.4.salary",
  },
  {
    typeKey: "landing.ticker.5.type",
    titleKey: "landing.ticker.5.title",
    locationKey: "landing.ticker.5.location",
    salaryKey: "landing.ticker.5.salary",
  },
  {
    typeKey: "landing.ticker.6.type",
    titleKey: "landing.ticker.6.title",
    locationKey: "landing.ticker.6.location",
    salaryKey: "landing.ticker.6.salary",
  },
  {
    typeKey: "landing.ticker.7.type",
    titleKey: "landing.ticker.7.title",
    locationKey: "landing.ticker.7.location",
    salaryKey: "landing.ticker.7.salary",
  },
  {
    typeKey: "landing.ticker.8.type",
    titleKey: "landing.ticker.8.title",
    locationKey: "landing.ticker.8.location",
    salaryKey: "landing.ticker.8.salary",
  },
  {
    typeKey: "landing.ticker.9.type",
    titleKey: "landing.ticker.9.title",
    locationKey: "landing.ticker.9.location",
    salaryKey: "landing.ticker.9.salary",
  },
];

const steps: StepItem[] = [
  { n: "01", icon: Upload, titleKey: "landing.steps.0.title", descKey: "landing.steps.0.desc" },
  { n: "02", icon: Mail, titleKey: "landing.steps.1.title", descKey: "landing.steps.1.desc" },
  { n: "03", icon: FileText, titleKey: "landing.steps.2.title", descKey: "landing.steps.2.desc" },
  { n: "04", icon: Search, titleKey: "landing.steps.3.title", descKey: "landing.steps.3.desc" },
  { n: "05", icon: Send, titleKey: "landing.steps.4.title", descKey: "landing.steps.4.desc" },
  { n: "06", icon: BarChart3, titleKey: "landing.steps.5.title", descKey: "landing.steps.5.desc" },
];

const features: FeatureItem[] = [
  { icon: Shield, titleKey: "landing.features.0.title", descKey: "landing.features.0.desc", badge: null, wide: true },
  { icon: Zap, titleKey: "landing.features.1.title", descKey: "landing.features.1.desc", badge: null, wide: false },
  { icon: Eye, titleKey: "landing.features.2.title", descKey: "landing.features.2.desc", badge: null, wide: false },
  { icon: Send, titleKey: "landing.features.3.title", descKey: "landing.features.3.desc", badge: null, wide: false },
  { icon: Clock, titleKey: "landing.features.4.title", descKey: "landing.features.4.desc", badge: null, wide: false },
  { icon: Bot, titleKey: "landing.features.5.title", descKey: "landing.features.5.desc", badge: "Black", wide: true },
  { icon: FileText, titleKey: "landing.features.6.title", descKey: "landing.features.6.desc", badge: null, wide: true },
  { icon: Radar, titleKey: "landing.features.7.title", descKey: "landing.features.7.desc", badge: null, wide: false },
  { icon: Users, titleKey: "landing.features.8.title", descKey: "landing.features.8.desc", badge: null, wide: false },
];

export default function Landing() {
  const navigate = useNavigate();
  const { i18n, t } = useTranslation();
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleChangeLanguage = (next: SupportedLanguage) => {
    i18n.changeLanguage(next);
    localStorage.setItem("app_language", next);
  };

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

        /* ── Ticker ── */
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

        /* ── Step number hover ── */
        .step-card:hover .step-num { color: #020617; }
        .step-card:hover { border-color: #020617; }

        /* ── Feature card ── */
        .feat-card:hover { background: #f8fafc; }
        .feat-card:hover .feat-icon { color: hsl(199,88%,48%); }

        /* ── FAQ ── */
        .faq-row:hover .faq-q { color: #D4500A; }

        /* ── Buttons ── */
        .btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn-outline:hover { background: #020617; color: #fff; }
        .btn-ghost:hover  { color: #020617; }

        /* ── Nav CTA ── */
        .nav-cta:hover { opacity: 0.85; }

        /* ── Scrollbar ── */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .hero-grid     { grid-template-columns: 1fr !important; }
          .hero-left     { padding: 56px 0 32px !important; border-right: none !important; border-bottom: 1px solid #E2E8F0; }
          .hero-right    { padding: 32px 0 56px !important; }
          .steps-grid    { grid-template-columns: 1fr !important; }
          .bento-grid    { grid-template-columns: 1fr !important; }
          .lifetime-grid { grid-template-columns: 1fr !important; }
          .cta-row       { flex-direction: column !important; align-items: stretch !important; }
          .footer-row    { flex-direction: column !important; gap: 16px !important; align-items: center !important; text-align: center !important; }
          .testi-grid    { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 768px) {
          .steps-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .bento-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .testi-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 1024px) {
          .steps-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .testi-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#fff" }}>
        {/* ── NAV ─────────────────────────────────────────────────────────── */}
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

              {user ? (
                <button
                  className="nav-cta"
                  onClick={() => navigate("/dashboard")}
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
                  {t("landing.nav.dashboard")}
                </button>
              ) : (
                <button
                  className="nav-cta"
                  onClick={() => navigate("/auth")}
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
                  {t("landing.nav.loginOrCreate")}
                </button>
              )}
            </div>
          </div>
        </nav>

        {/* ── HERO ────────────────────────────────────────────────────────── */}
        <section style={{ borderBottom: "1px solid #E2E8F0" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                minHeight: 540,
              }}
              className="hero-grid"
            >
              {/* Left column */}
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
                    {t("landing.hero.status")}
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
                  {t("landing.hero.h1.line1")}
                  <br />
                  {t("landing.hero.h1.line2")}
                  <br />
                  <span style={{ color: "#D4500A" }}>{t("landing.hero.h1.highlight")}</span>
                </h1>

                <p
                  style={{
                    fontSize: 16,
                    color: "#64748B",
                    lineHeight: 1.7,
                    marginBottom: 36,
                    maxWidth: 440,
                  }}
                >
                  {t("landing.hero.sub")}
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
                    {t("landing.hero.ctaPrimary")} <ArrowRight size={15} />
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
                    <Search size={15} /> {t("landing.hero.ctaSecondary")}
                  </button>
                </div>
              </div>

              {/* Right column */}
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
                {[
                  {
                    valueKey: "landing.hero.stats.0.value",
                    labelKey: "landing.hero.stats.0.label",
                    subKey: "landing.hero.stats.0.sub",
                    border: true,
                  },
                  {
                    valueKey: "landing.hero.stats.1.value",
                    labelKey: "landing.hero.stats.1.label",
                    subKey: "landing.hero.stats.1.sub",
                    border: true,
                  },
                  {
                    valueKey: "landing.hero.stats.2.value",
                    labelKey: "landing.hero.stats.2.label",
                    subKey: "landing.hero.stats.2.sub",
                    border: false,
                  },
                ].map((s) => (
                  <div
                    key={s.labelKey}
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
                      {t(s.valueKey)}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#020617", marginBottom: 3 }}>
                      {t(s.labelKey)}
                    </div>
                    <div style={{ fontSize: 13, color: "#94A3B8" }}>{t(s.subKey)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── JOBS TICKER ─────────────────────────────────────────────────── */}
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
            {[...tickerJobs, ...tickerJobs].map((job, i) => {
              const type = t(job.typeKey);
              const isH2A = String(type).toLowerCase().includes("h-2a");
              return (
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
                      background: isH2A ? "#DCFCE7" : "#DBEAFE",
                      color: isH2A ? "#15803D" : "#1D4ED8",
                    }}
                  >
                    {type}
                  </span>

                  <span style={{ fontWeight: 600 }}>{t(job.titleKey)}</span>
                  <span style={{ color: "#94A3B8", display: "flex", alignItems: "center", gap: 3 }}>
                    <MapPin size={11} /> {t(job.locationKey)}
                  </span>
                  <span style={{ color: "#64748B", fontWeight: 500 }}>{t(job.salaryKey)}</span>
                  <span style={{ color: "#E2E8F0", fontSize: 20, lineHeight: 1 }}>·</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
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
                {t("landing.how.kicker")}
              </p>
              <h2
                style={{
                  fontSize: "clamp(28px, 4vw, 38px)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                }}
              >
                {t("landing.how.h2.line1")}
                <br />
                {t("landing.how.h2.line2")}
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
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#020617" }}>
                    {t(step.titleKey)}
                  </h3>
                  <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.65 }}>{t(step.descKey)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES BENTO ──────────────────────────────────────────────── */}
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
                {t("landing.features.kicker")}
              </p>
              <h2
                style={{
                  fontSize: "clamp(28px, 4vw, 38px)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                }}
              >
                {t("landing.features.h2.line1")}
                <br />
                {t("landing.features.h2.line2")}
              </h2>
            </div>

            <div className="bento-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {features.map((f) => (
                <div
                  key={f.titleKey}
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
                        background: "#020617",
                        color: "#fff",
                        border: "none",
                        padding: "3px 8px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      <Crown size={9} />
                      {t("landing.features.badge.black")}
                    </div>
                  )}

                  <f.icon
                    className="feat-icon"
                    size={22}
                    style={{ color: "#CBD5E1", marginBottom: 16, transition: "color 0.2s" }}
                  />
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#020617" }}>{t(f.titleKey)}</h3>
                  <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.65, maxWidth: f.wide ? 520 : "none" }}>
                    {t(f.descKey)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS (1 card centralizado + bandeira + aspas grande + Diamond) ── */}
        <section style={{ padding: "88px 24px", borderBottom: "1px solid #E2E8F0", background: "#fff" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ maxWidth: 680, marginBottom: 56 }}>
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
                {t("landing.testimonials.kicker")}
              </p>
              <h2
                style={{
                  fontSize: "clamp(28px, 4vw, 38px)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                }}
              >
                {t("landing.testimonials.h2.line1")}
                <br />
                {t("landing.testimonials.h2.line2")}
              </h2>
            </div>

            <div className="testi-grid" style={{ display: "grid", justifyItems: "center" }}>
              <div
                style={{
                  width: "100%",
                  maxWidth: 760,
                  background: "#fff",
                  border: "1px solid #E2E8F0",
                  borderRadius: 14,
                  padding: "34px 34px 28px",
                  position: "relative",
                  boxShadow: "0 1px 2px rgba(2,6,23,0.06)",
                }}
              >
                {/* Aspas grande */}
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: 18,
                    left: 22,
                    fontSize: 64,
                    fontWeight: 800,
                    lineHeight: 1,
                    color: "#E2E8F0",
                    userSelect: "none",
                  }}
                >
                  “
                </div>

                {/* Bandeira (sem texto "Brazil") */}
                <div style={{ position: "absolute", top: 14, right: 14 }}>
                  <BRFlagMark size={24} />
                </div>

                <p
                  style={{
                    fontSize: 15,
                    color: "#334155",
                    lineHeight: 1.95,
                    marginTop: 28,
                    whiteSpace: "pre-line",
                  }}
                >
                  {t("landing.testimonials.items.0.quote")}
                </p>

                <div style={{ marginTop: 22 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#020617", marginBottom: 10 }}>
                    {t("landing.testimonials.items.0.name")}
                  </div>

                  {/* Badge Diamond */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 12px",
                      borderRadius: 999,
                      border: "1px solid #E2E8F0",
                      background: "#F8FAFC",
                    }}
                  >
                    <Crown size={14} style={{ color: "#0F172A" }} />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        color: "#0F172A",
                        textTransform: "uppercase",
                      }}
                    >
                      {t("landing.testimonials.items.0.badge")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── LIFETIME PRICING ────────────────────────────────────────────── */}
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
                {t("landing.pricing.kicker")}
              </p>
              <h2
                style={{
                  fontSize: "clamp(28px, 4vw, 38px)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                }}
              >
                {t("landing.pricing.h2.line1")}
                <br />
                {t("landing.pricing.h2.line2")}
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="lifetime-grid">
              <div
                style={{
                  background: "#020617",
                  borderRadius: 12,
                  padding: "48px 40px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -80,
                    right: -80,
                    width: 240,
                    height: 240,
                    borderRadius: "50%",
                    background: "hsl(199,88%,48%,0.07)",
                    pointerEvents: "none",
                  }}
                />

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "hsl(199,88%,48%,0.15)",
                    border: "1px solid hsl(199,88%,48%,0.3)",
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
                  <InfinityIcon size={12} /> {t("landing.pricing.cardA.tag")}
                </div>

                <div style={{ marginBottom: 8 }}>
                  <span
                    style={{ fontSize: 56, fontWeight: 700, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1 }}
                  >
                    {t("landing.pricing.cardA.price")}
                  </span>
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
                  {t("landing.pricing.cardA.sub")}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {[0, 1, 2, 3, 4].map((idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>
                        {t(`landing.pricing.cardA.bullets.${idx}`)}
                      </span>
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
                  {t("landing.pricing.cardA.cta")} <ArrowRight size={15} />
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
                  {t("landing.pricing.cardB.tag")}
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
                    {t("landing.pricing.cardB.price")}
                  </span>
                </div>

                <div style={{ fontSize: 18, fontWeight: 600, color: "#94A3B8", marginBottom: 36, lineHeight: 1.4 }}>
                  {t("landing.pricing.cardB.sub")}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {[0, 1, 2, 3, 4].map((idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                      <span style={{ fontSize: 14, color: "#94A3B8", fontWeight: 500 }}>
                        {t(`landing.pricing.cardB.bullets.${idx}`)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── REFERRAL PROGRAM ────────────────────────────────────────────── */}
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
                  <Gift size={11} /> {t("landing.referral.kicker")}
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
                  {t("landing.referral.h2.line1")}
                  <br />
                  {t("landing.referral.h2.line2")}
                </h2>

                <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.7, maxWidth: 420 }}>
                  {t("landing.referral.sub")}
                </p>
              </div>

              <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 0 }}>
                {[0, 1, 2, 3].map((idx, i, arr) => (
                  <div
                    key={idx}
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
                      {t(`landing.referral.steps.${idx}.n`)}
                    </span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#020617", marginBottom: 3 }}>
                        {t(`landing.referral.steps.${idx}.title`)}
                      </div>
                      <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>
                        {t(`landing.referral.steps.${idx}.desc`)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── REQUIREMENTS ────────────────────────────────────────────────── */}
        <section style={{ padding: "88px 24px", borderBottom: "1px solid #E2E8F0" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 80, alignItems: "start" }}>
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
                  {t("landing.requirements.kicker")}
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
                  {t("landing.requirements.h2")}
                </h2>
                <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.7 }}>{t("landing.requirements.sub")}</p>

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
                  {t("landing.requirements.cta")} <ArrowRight size={15} />
                </button>
              </div>

              <div>
                {[0, 1, 2, 3].map((idx, i, arr) => (
                  <div
                    key={idx}
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
                      <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: "#020617" }}>
                        {t(`landing.requirements.items.${idx}.title`)}
                      </h4>
                      <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.65 }}>
                        {t(`landing.requirements.items.${idx}.desc`)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
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
                {t("landing.faq.kicker")}
              </p>
              <h2 style={{ fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 700, letterSpacing: "-0.02em" }}>
                {t("landing.faq.title")}
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
                      {t(item.qKey)}
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
                      {t(item.aKey)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ───────────────────────────────────────────────────── */}
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
                  {t("landing.finalCta.kicker")}
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
                  {t("landing.finalCta.h2.line1")}
                  <br />
                  {t("landing.finalCta.h2.line2")}
                </h2>
                <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, maxWidth: 400 }}>
                  {t("landing.finalCta.sub")}
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
                  {t("landing.finalCta.ctaPrimary")} <ArrowRight size={16} />
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
                  <Globe size={14} /> {t("landing.finalCta.ctaSecondary")}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
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
              {t("landing.footer.copy", { year: new Date().getFullYear() })}
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
