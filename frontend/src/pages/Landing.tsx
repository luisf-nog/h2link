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

// ─── Design System (Premium Minimalist) ─────────────────────────────────────
const Theme = {
  navy: "#020817", // Deep Navy (Base)
  navyLighter: "#0F172A",
  navyBorder: "#1E293B",
  white: "#FFFFFF",
  slate: "#94A3B8", // Muted Text
  orange: "#D4500A", // Action Color
  red: "#B22234", // American Red
  cyan: "#0EA5E9", // Feature Accents
  h2a: "#10B981",
  h2b: "#3B82F6",
  early: "#8B5CF6",
};

// ─── Data ───────────────────────────────────────────────────────────────────
const tickerJobs = [
  { type: "H-2A", title: "Farmworker – Berries", location: "Salinas, CA", salary: "$16.00/h" },
  { type: "H-2B", title: "Concrete Finisher", location: "Morgantown, WV", salary: "$24.50/h" },
  { type: "H-2A", title: "Apple Harvester", location: "Yakima, WA", salary: "$17.20/h" },
  { type: "H-2B", title: "Landscape Laborer", location: "Austin, TX", salary: "$18.00/h" },
  { type: "H-2A", title: "Equipment Operator", location: "Des Moines, IA", salary: "$19.50/h" },
  { type: "H-2B", title: "Housekeeper", location: "Mackinaw City, MI", salary: "$15.50/h" },
];

const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
];

export default function Landing() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: 'Inter', sans-serif; 
          background: ${Theme.navy}; 
          color: ${Theme.white};
          -webkit-font-smoothing: antialiased;
        }

        /* Hero Glow Effect (SpaceX Style) */
        .hero-glow {
          position: absolute;
          top: -10%;
          right: -5%;
          width: 60%;
          height: 70%;
          background: radial-gradient(circle, rgba(212,80,10,0.07) 0%, rgba(2,8,23,0) 70%);
          filter: blur(100px);
          pointer-events: none;
          z-index: 0;
        }

        /* Ticker Animations */
        @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .ticker-track { display: flex; width: max-content; animation: ticker 40s linear infinite; }
        .states-track { display: flex; width: max-content; animation: ticker 60s linear infinite; }

        /* Custom UI Elements */
        .glass-panel {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid ${Theme.navyBorder};
          backdrop-filter: blur(12px);
        }

        .btn-main:hover { transform: translateY(-1px); filter: brightness(1.1); }
        .section-padding { padding: 120px 24px; }
      `}</style>

      <div style={{ position: "relative", overflow: "hidden" }}>
        <div className="hero-glow" />

        {/* ── NAV ── */}
        <nav
          style={{
            height: 72,
            borderBottom: `1px solid ${Theme.navyBorder}`,
            position: "sticky",
            top: 0,
            background: "rgba(2,8,23,0.8)",
            backdropFilter: "blur(10px)",
            zHeight: 100,
          }}
        >
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              padding: "0 24px",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <BrandWordmark height={30} />
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <LanguageSwitcher value={i18n.language as SupportedLanguage} onChange={(l) => i18n.changeLanguage(l)} />
              <button
                onClick={() => navigate("/auth")}
                style={{
                  background: Theme.orange,
                  color: "#fff",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 4,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {user ? "Dashboard" : "Entrar"}
              </button>
            </div>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section className="section-padding" style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "1.2fr 0.8fr",
              gap: 60,
              alignItems: "center",
            }}
            className="hero-container"
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  border: `1px solid ${Theme.navyBorder}`,
                  padding: "6px 12px",
                  borderRadius: 100,
                  fontSize: 12,
                  fontWeight: 600,
                  color: Theme.slate,
                  marginBottom: 32,
                }}
              >
                <span style={{ width: 6, height: 6, background: "#22C55E", borderRadius: "50%" }} /> Agora com +10.000
                vagas ativas
              </div>
              <h1
                style={{
                  fontSize: "clamp(42px, 5vw, 68px)",
                  fontWeight: 800,
                  lineHeight: 1,
                  letterSpacing: "-0.04em",
                  marginBottom: 24,
                }}
              >
                Sua candidatura <br /> <span style={{ color: Theme.orange }}>chega primeiro.</span>
              </h1>
              <p style={{ fontSize: 19, color: Theme.slate, lineHeight: 1.6, marginBottom: 48, maxWidth: 550 }}>
                O H2 Linker automatiza o processo de busca e envio para vagas H-2A e H-2B, garantindo que você esteja no
                topo da fila dos empregadores americanos.
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  className="btn-main"
                  onClick={() => navigate("/auth")}
                  style={{
                    background: Theme.orange,
                    color: "#fff",
                    border: "none",
                    padding: "16px 32px",
                    borderRadius: 4,
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  Criar conta gratuita <ArrowRight size={20} />
                </button>
                <button
                  style={{
                    background: "transparent",
                    color: "#fff",
                    border: `1px solid ${Theme.navyBorder}`,
                    padding: "16px 32px",
                    borderRadius: 4,
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Ver vagas
                </button>
              </div>
            </div>

            {/* Quick Stats Panel */}
            <div className="glass-panel" style={{ padding: 40, borderRadius: 8 }}>
              {[
                { label: "Vagas Processadas", value: "10k+", color: Theme.white },
                { label: "Tempo de Resposta", value: "Real-time", color: Theme.orange },
                { label: "Tipo de Vistos", value: "H-2A & H-2B", color: Theme.white },
              ].map((stat, i) => (
                <div key={i} style={{ marginBottom: i < 2 ? 32 : 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: Theme.slate,
                      textTransform: "uppercase",
                      marginBottom: 8,
                    }}
                  >
                    {stat.label}
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── JOB TICKER ── */}
        <div
          style={{
            background: Theme.navyLighter,
            borderTop: `1px solid ${Theme.navyBorder}`,
            borderBottom: `1px solid ${Theme.navyBorder}`,
            padding: "16px 0",
          }}
        >
          <div className="ticker-track">
            {[...tickerJobs, ...tickerJobs].map((job, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "0 40px",
                  fontSize: 13,
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontWeight: 800, color: job.type === "H-2A" ? Theme.h2a : Theme.h2b }}>{job.type}</span>
                <span style={{ fontWeight: 600 }}>{job.title}</span>
                <span style={{ color: Theme.slate }}>{job.location}</span>
                <span style={{ color: Theme.orange, fontWeight: 700 }}>{job.salary}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── STATES TICKER (Refinado) ── */}
        <div style={{ background: Theme.navy, borderBottom: `1px solid ${Theme.navyBorder}`, padding: "10px 0" }}>
          <div className="states-track">
            {[...US_STATES, ...US_STATES].map((state, i) => (
              <span
                key={i}
                style={{
                  padding: "0 20px",
                  fontSize: 11,
                  fontWeight: 700,
                  color: Theme.slate,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {state} <span style={{ color: Theme.red, marginLeft: 10 }}>★</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── FEATURES (Bento Style) ── */}
        <section className="section-padding" style={{ background: "#020617" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ marginBottom: 64 }}>
              <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 16 }}>
                Tecnologia de ponta para sua aprovação.
              </h2>
              <p style={{ color: Theme.slate, fontSize: 18 }}>
                Recursos exclusivos que te colocam meses à frente da concorrência.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
              {[
                {
                  icon: Radar,
                  title: "Radar H-2A Early Access",
                  desc: "Exclusivo para vagas agrícolas: saiba no segundo em que o NOA é emitido.",
                  color: Theme.early,
                },
                {
                  icon: Mail,
                  title: "Envios via SMTP Real",
                  desc: "Os e-mails saem da sua própria conta, garantindo entrega máxima e confiança.",
                  color: Theme.orange,
                },
                {
                  icon: BarChart3,
                  title: "Pixel de Rastreamento",
                  desc: "Saiba quando o patrão abriu seu e-mail e quantas vezes ele viu seu currículo.",
                  color: Theme.cyan,
                },
                {
                  icon: Shield,
                  title: "Delay Humano Anti-Spam",
                  desc: "O sistema simula o comportamento humano para proteger a saúde do seu e-mail.",
                  color: Theme.h2a,
                },
              ].map((f, i) => (
                <div
                  key={i}
                  style={{
                    padding: 32,
                    border: `1px solid ${Theme.navyBorder}`,
                    borderRadius: 4,
                    background: Theme.navyLighter,
                  }}
                >
                  <f.icon size={24} color={f.color} style={{ marginBottom: 20 }} />
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{f.title}</h3>
                  <p style={{ color: Theme.slate, fontSize: 15, lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── LIFETIME PRICING ── */}
        <section className="section-padding" style={{ borderTop: `1px solid ${Theme.navyBorder}` }}>
          <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div
              style={{
                padding: 48,
                border: `2px solid ${Theme.orange}`,
                borderRadius: 8,
                background: "rgba(212,80,10,0.03)",
              }}
            >
              <Badge color={Theme.orange}>H2 LINKER</Badge>
              <div style={{ fontSize: 56, fontWeight: 800, margin: "24px 0 8px" }}>1x</div>
              <p style={{ fontSize: 18, fontWeight: 600, color: Theme.slate, marginBottom: 32 }}>
                Pagamento único. Acesso vitalício.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {["Acesso a +10k vagas", "IA Personalizada por vaga", "Radar Early Access", "Suporte via E-mail"].map(
                  (item) => (
                    <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                      <Check size={16} color={Theme.h2a} /> {item}
                    </div>
                  ),
                )}
              </div>
            </div>
            <div style={{ padding: 48, border: `1px solid ${Theme.navyBorder}`, borderRadius: 8, opacity: 0.6 }}>
              <Badge color={Theme.slate}>CONCORRÊNCIA</Badge>
              <div style={{ fontSize: 56, fontWeight: 800, margin: "24px 0 8px", textDecoration: "line-through" }}>
                Mensal
              </div>
              <p style={{ fontSize: 18, fontWeight: 600, color: Theme.slate, marginBottom: 32 }}>
                Cobrança recorrente todo mês.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {["Acesso limitado", "Cobranças surpresa", "Sem suporte humano", "Cancela = Perde tudo"].map((item) => (
                  <div
                    key={item}
                    style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: Theme.slate }}
                  >
                    <X size={16} color={Theme.red} /> {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="section-padding" style={{ background: Theme.navyLighter }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 800, marginBottom: 48 }}>
              Perguntas Frequentes
            </h2>
            {/* FAQ ITEM */}
            {[
              {
                q: "O H2 Linker garante minha vaga?",
                a: "Não. Somos um facilitador técnico. Nossa função é garantir que seu currículo chegue antes e melhor apresentado. A decisão final é sempre do empregador.",
              },
              {
                q: "O que é o Early Access?",
                a: "É o acesso às vagas H-2A no minuto em que o governo americano as aceita. Isso te dá semanas de vantagem sobre quem busca em sites de empregos comuns.",
              },
            ].map((item, i) => (
              <div
                key={i}
                style={{ borderBottom: `1px solid ${Theme.navyBorder}`, padding: "24px 0", cursor: "pointer" }}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                  {item.q}{" "}
                  <ChevronDown
                    size={20}
                    style={{ transform: openFaq === i ? "rotate(180deg)" : "none", transition: "0.2s" }}
                  />
                </div>
                {openFaq === i && <div style={{ marginTop: 16, color: Theme.slate, lineHeight: 1.6 }}>{item.a}</div>}
              </div>
            ))}
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ padding: "80px 24px", textAlign: "center", borderTop: `1px solid ${Theme.navyBorder}` }}>
          <BrandWordmark height={26} />
          <p style={{ marginTop: 24, fontSize: 13, color: Theme.slate, fontWeight: 500 }}>
            © 2025 H2 Linker — Smart connections. Real opportunities.
          </p>
        </footer>
      </div>
    </>
  );
}

// Helper Badge Component
const Badge = ({ children, color }: any) => (
  <span
    style={{
      padding: "4px 12px",
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 800,
      background: `${color}15`,
      color: color,
      border: `1px solid ${color}30`,
      letterSpacing: "0.05em",
    }}
  >
    {children}
  </span>
);
