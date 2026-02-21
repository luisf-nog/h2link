import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
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
  Cpu,
  X,
  Check,
} from "lucide-react";
import { useState, useEffect } from "react";

// ─── FAQ ────────────────────────────────────────────────────────────────────
const faqs = [
  {
    q: "O H2 Linker garante que vou conseguir a vaga?",
    a: "Não — e qualquer plataforma que prometa isso está mentindo. O H2 Linker não é uma agência de empregos e não tem poder de contratar ninguém. Somos um facilitador: nossa função é colocar o seu currículo na frente do maior número possível de empregadores verificados, no menor tempo possível, com a melhor apresentação possível. O processo H-2A e H-2B é um jogo de tempo e volume. Quem aplica primeiro, com um email profissional e rastreável, sai na frente. Estamos aqui para garantir que você jogue esse jogo com todas as vantagens.",
  },
  {
    q: "O que é o 'Early Access' e por que ele é tão importante?",
    a: "Early Access são vagas H-2A que acabaram de receber o NOA (Notice of Acceptance) do Departamento de Trabalho — aprovadas mas ainda não amplamente divulgadas. É a janela de ouro do processo: o empregador acabou de receber luz verde, ainda está montando o time, e sua candidatura chega antes da concorrência. Em H-2A, a velocidade é tudo. Empregadores recebem centenas de emails à medida que a vaga ganha visibilidade — quem chega primeiro fica na memória. Chegando no Early Access, você não está competindo com a multidão. Está na fila da frente.",
  },
  {
    q: "Como o sistema acessa meu e-mail?",
    a: "Não acessamos sua senha. Você gera uma 'Senha de App' no Google ou Outlook que permite apenas o envio de mensagens. Você mantém o controle total.",
  },
  {
    q: "As vagas são reais?",
    a: "Sim, todos os dados são extraídos e processados diretamente dos arquivos oficiais do Department of Labor (DOL) dos EUA.",
  },
  {
    q: "Quantos e-mails posso enviar por dia?",
    a: "Depende do seu plano e do aquecimento do seu email. O sistema começa com envios conservadores e vai aumentando gradualmente para proteger sua reputação.",
  },
];

// ─── Jobs ticker data ────────────────────────────────────────────────────────
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

// ─── How it works ────────────────────────────────────────────────────────────
const steps = [
  {
    n: "01",
    icon: Upload,
    title: "Importe seu currículo",
    desc: "Upload em PDF ou Word. O sistema extrai seus dados e personaliza cada candidatura.",
  },
  {
    n: "02",
    icon: Mail,
    title: "Configure seu email SMTP",
    desc: 'Conecte Gmail ou Outlook com "Senha de App". Os emails saem da sua caixa, sem intermediários.',
  },
  {
    n: "03",
    icon: FileText,
    title: "Personalize templates",
    desc: "Use templates prontos ou crie os seus. Nossa IA gera textos únicos para cada vaga.",
  },
  {
    n: "04",
    icon: Search,
    title: "Explore as vagas H-2A/H-2B",
    desc: "Centenas de vagas atualizadas diariamente do DOL. Cada vaga exibe salário completo, horas semanais, data de início da temporada, experiência exigida e educação mínima — informação real para tomar a decisão certa.",
  },
  {
    n: "05",
    icon: Send,
    title: "Monte a fila e envie",
    desc: "Selecione as vagas, adicione à fila e dispare candidaturas em massa com um clique.",
  },
  {
    n: "06",
    icon: BarChart3,
    title: "Aguarde o retorno dos empregadores",
    desc: "Após o envio, fique de olho na sua caixa de entrada. Os empregadores respondem diretamente para o seu email — sem intermediários.",
  },
];

// ─── Features bento ─────────────────────────────────────────────────────────
const features = [
  {
    icon: Shield,
    title: "Aquecimento inteligente",
    desc: "Aumento progressivo do limite de envios que protege a reputação do seu domínio e evita bloqueios. Começa conservador e cresce automaticamente.",
    badge: null,
    wide: true,
  },
  {
    icon: Zap,
    title: "IA personalizada por vaga",
    desc: "Emails únicos gerados para cada vaga, passando pelos filtros de spam com linguagem natural.",
    badge: null,
    wide: false,
  },
  {
    icon: Eye,
    title: "Spy pixel avançado",
    desc: "Filtra scanners de antivírus e mostra apenas aberturas genuínas do empregador.",
    badge: null,
    wide: false,
  },
  {
    icon: Send,
    title: "Auto-send — piloto automático",
    desc: "O Radar detecta uma vaga que bate com seus filtros e envia a candidatura sozinho. Você não precisa fazer nada.",
    badge: null,
    wide: false,
  },
  {
    icon: Clock,
    title: "Delay anti-spam",
    desc: "Intervalos randomizados entre envios simulando comportamento humano para proteger sua conta.",
    badge: null,
    wide: false,
  },
  {
    icon: Bot,
    title: "Preferências de IA avançadas",
    desc: "Controle total sobre o estilo dos seus emails: formalidade, abertura, saudação, fechamento, tamanho e ênfases como idiomas e disponibilidade.",
    badge: "Black",
    wide: true,
  },
  {
    icon: FileText,
    title: "Fichas completas de cada vaga",
    desc: "Salário (faixa mínima e máxima), horas semanais, data de início da temporada, experiência mínima exigida, educação requerida e contato direto com o empregador. Não é uma listagem crua — é tudo que você precisa para decidir antes de aplicar.",
    badge: null,
    wide: true,
  },
  {
    icon: Radar,
    title: "Radar de vagas",
    desc: "Configure filtros por setor, estado e salário. Vagas novas entram na sua fila automaticamente, sem busca manual.",
    badge: null,
    wide: false,
  },
  {
    icon: Users,
    title: "Programa de indicações",
    desc: "Indique amigos e ganhe créditos extras de envio. Quanto mais indicações ativas, mais candidaturas por dia — sem pagar nada.",
    badge: null,
    wide: false,
  },
];

// ─── Component ───────────────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
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
          background: #FDFCFA;
          color: #020617;
          -webkit-font-smoothing: antialiased;
        }

        /* ── Jobs Ticker ── */
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

        /* ── States Ticker ── */
        @keyframes states-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .states-track {
          display: flex;
          width: max-content;
          animation: states-scroll 55s linear infinite;
        }

        /* ── Map dot grid (hero right column) ── */
        .map-dot-grid {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, #CBD5E1 1px, transparent 1px);
          background-size: 22px 22px;
          opacity: 0.45;
          pointer-events: none;
        }

        /* ── Field rows (how it works bg) ── */
        .field-rows {
          background-color: #F5F2EC;
          background-image: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 30px,
            rgba(180,170,155,0.18) 30px,
            rgba(180,170,155,0.18) 31px
          );
        }

        /* ── Horizon gradient (features bg) ── */
        .horizon-bg {
          background: linear-gradient(180deg, #EEF4FB 0%, #F4F8FC 100%);
        }

        /* ── Step number hover ── */
        .step-card:hover .step-num { color: #020617; }
        .step-card:hover { border-color: #020617; }
        .step-card { background: #FFFEFB !important; }

        /* ── Feature card ── */
        .feat-card:hover { background: #f0f6ff !important; }
        .feat-card:hover .feat-icon { color: hsl(199,88%,48%); }
        .feat-card { background: #fff !important; }

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
        }
        @media (min-width: 768px) {
          .steps-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .bento-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (min-width: 1024px) {
          .steps-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#FDFCFA" }}>
        {/* ── NAV ─────────────────────────────────────────────────────────── */}
        <nav
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "#FDFCFA",
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
                  Dashboard
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
                  Entrar / Criar conta
                </button>
              )}
            </div>
          </div>
        </nav>

        {/* ── HERO ────────────────────────────────────────────────────────── */}
        <section style={{ borderBottom: "1px solid #E2E8F0", background: "#FDFCFA" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                minHeight: 540,
              }}
              className="hero-grid"
            >
              {/* Left column — content */}
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
                {/* Status tag — not a pill, more like a label */}
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
                    Base DOL atualizada hoje
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
                  A ferramenta que faz
                  <br />
                  você chegar primeiro
                  <br />
                  <span style={{ color: "#D4500A" }}>nas vagas H-2A e H-2B</span>
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
                  Automatize candidaturas, rastreie aberturas em tempo real e aplique para dezenas de empregadores
                  verificados do DOL — tudo da sua própria caixa de email.
                </p>

                {/* CTAs */}
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
                    Criar conta gratuita <ArrowRight size={15} />
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
                    <Search size={15} /> Ver vagas
                  </button>
                </div>
              </div>

              {/* Right column — stats + trust signals */}
              <div
                style={{
                  padding: "72px 0 72px 64px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 0,
                  position: "relative",
                  overflow: "hidden",
                }}
                className="hero-right"
              >
                {/* Map dot grid watermark */}
                <div className="map-dot-grid" />
                {/* Big stats */}
                <div style={{ position: "relative", zIndex: 1 }}>
                  {[
                    {
                      value: "10.000+",
                      label: "Vagas no banco de dados",
                      sub: "Direto do Department of Labor",
                      border: true,
                    },
                    {
                      value: "Diário",
                      label: "Frequência de atualização",
                      sub: "Vagas novas aparecem assim que aprovadas",
                      border: true,
                    },
                    {
                      value: "100%",
                      label: "Grátis para começar",
                      sub: "Sem cartão de crédito. Sem surpresas.",
                      border: false,
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      style={{
                        padding: "28px 0",
                        borderBottom: s.border ? "1px solid #E2E8F0" : "none",
                      }}
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
          </div>
        </section>

        {/* ── JOBS TICKER ─────────────────────────────────────────────────── */}
        <div
          style={{
            borderBottom: "1px solid #DDD8CF",
            background: "#F0EBE2",
            overflow: "hidden",
            padding: "14px 0",
            position: "relative",
          }}
        >
          {/* Fade edges */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 80,
              background: "linear-gradient(to right, #F0EBE2, transparent)",
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
              background: "linear-gradient(to left, #F0EBE2, transparent)",
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
                {/* Type badge */}
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
                {/* Dot separator */}
                <span style={{ color: "#E2E8F0", fontSize: 20, lineHeight: 1 }}>·</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── US STATES BAND ──────────────────────────────────────────────── */}
        <div
          style={{
            borderBottom: "1px solid #E2E8F0",
            background: "#020617",
            overflow: "hidden",
            padding: "10px 0",
            position: "relative",
          }}
        >
          <div className="states-track">
            {[...Array(2)].map((_, rep) =>
              [
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
              ].map((state) => (
                <span
                  key={`${rep}-${state}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "0 18px",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.35)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {state}
                  <span style={{ color: "#D4500A", fontSize: 8 }}>◆</span>
                </span>
              )),
            )}
          </div>
        </div>

        {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
        <section className="field-rows" style={{ padding: "88px 24px", borderBottom: "1px solid #D6CFC4" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            {/* Section header */}
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
                Como funciona
              </p>
              <h2
                style={{
                  fontSize: "clamp(28px, 4vw, 38px)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                }}
              >
                Do zero às candidaturas
                <br />
                em 6 passos simples
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
                  {/* Number */}
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

        {/* ── FEATURES BENTO ──────────────────────────────────────────────── */}
        <section className="horizon-bg" style={{ padding: "88px 24px", borderBottom: "1px solid #D6E4F0" }}>
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
                Recursos
              </p>
              <h2
                style={{
                  fontSize: "clamp(28px, 4vw, 38px)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                }}
              >
                Ferramentas que fazem
                <br />a diferença
              </h2>
            </div>

            <div
              className="bento-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
              }}
            >
              {features.map((f, i) => (
                <div
                  key={f.title}
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
                      Plano {f.badge}
                    </div>
                  )}
                  <f.icon
                    className="feat-icon"
                    size={22}
                    style={{ color: "#CBD5E1", marginBottom: 16, transition: "color 0.2s" }}
                  />
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#020617" }}>{f.title}</h3>
                  <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.65, maxWidth: f.wide ? 520 : "none" }}>
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── LIFETIME PRICING ────────────────────────────────────────────── */}
        <section style={{ padding: "88px 24px", borderBottom: "1px solid #E2E8F0", background: "#FDFAF5" }}>
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
                Preço
              </p>
              <h2
                style={{
                  fontSize: "clamp(28px, 4vw, 38px)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                }}
              >
                Pague uma vez.
                <br />
                Use para sempre.
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="lifetime-grid">
              {/* H2 Linker card */}
              <div
                style={{
                  background: "#020617",
                  borderRadius: 12,
                  padding: "48px 40px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Subtle glow */}
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
                  <InfinityIcon size={12} /> H2 Linker
                </div>

                <div style={{ marginBottom: 8 }}>
                  <span
                    style={{
                      fontSize: 56,
                      fontWeight: 700,
                      color: "#fff",
                      letterSpacing: "-0.03em",
                      lineHeight: 1,
                    }}
                  >
                    1x
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
                  Pagamento único.
                  <br />
                  Acesso vitalício, sem mensalidade.
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {[
                    "Acesso a todas as vagas H-2A e H-2B",
                    "Envios automatizados com IA",
                    "Radar + auto-send incluídos",
                    "Rastreamento de abertura e visualização",
                    "Atualizações gratuitas para sempre",
                  ].map((item) => (
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
                  Ver planos <ArrowRight size={15} />
                </button>
              </div>

              {/* Competitors card */}
              <div
                style={{
                  background: "#F5F2ED",
                  border: "1px solid #DDD8CF",
                  borderRadius: 12,
                  padding: "48px 40px",
                }}
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
                  Concorrência típica
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
                    R$100
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: "#94A3B8",
                    marginBottom: 36,
                    lineHeight: 1.4,
                  }}
                >
                  por mês. Todo mês.
                  <br />
                  R$ 1.200 por ano — sem parar.
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {[
                    "Cobrança mensal recorrente",
                    "Cancela = perde o acesso imediatamente",
                    "Sem funcionar? Continua cobrando.",
                    "Reajustes a qualquer momento",
                    "Suporte premium bloqueado por plano",
                  ].map((item) => (
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

        {/* ── REFERRAL PROGRAM ────────────────────────────────────────────── */}
        <section style={{ padding: "72px 24px", background: "#F2FAF4", borderBottom: "1px solid #C9E8D2" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 48,
                flexWrap: "wrap",
              }}
            >
              {/* Left */}
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
                  <Gift size={11} /> Programa de indicações
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
                  Indique amigos.
                  <br />
                  Ganhe mais envios por dia.
                </h2>
                <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.7, maxWidth: 420 }}>
                  Para usuários do plano gratuito, cada amigo que você indicar e ativar a conta aumenta seu limite
                  diário de envios — sem pagar nada. É a forma mais rápida de acelerar suas candidaturas sem investir em
                  um plano pago.
                </p>
              </div>

              {/* Right — visual steps */}
              <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 0 }}>
                {[
                  {
                    n: "01",
                    title: "Copie seu link único",
                    desc: "Gerado automaticamente no seu perfil após criar a conta.",
                  },
                  {
                    n: "02",
                    title: "Compartilhe com amigos",
                    desc: "WhatsApp, Instagram, grupos — quanto mais, melhor.",
                  },
                  {
                    n: "03",
                    title: "Eles ativam a conta",
                    desc: "Assim que o amigo usar o sistema pela primeira vez, o crédito é seu.",
                  },
                  {
                    n: "04",
                    title: "Você envia mais",
                    desc: "Cada indicação ativa aumenta seu limite diário de candidaturas.",
                  },
                ].map((step, i, arr) => (
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

        {/* ── REQUIREMENTS ────────────────────────────────────────────────── */}
        <section style={{ padding: "88px 24px", borderBottom: "1px solid #E2E8F0", background: "#FDFCFA" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 80, alignItems: "start" }}>
              {/* Left — sticky title */}
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
                  Pré-requisitos
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
                  O que você precisa para começar
                </h2>
                <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.7 }}>
                  Tenha esses itens em mãos. O processo de configuração leva menos de 5 minutos e tem tutorial em vídeo
                  para cada etapa.
                </p>

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
                  Criar conta grátis <ArrowRight size={15} />
                </button>
              </div>

              {/* Right — checklist */}
              <div>
                {[
                  {
                    title: "Currículo em PDF ou Word",
                    desc: "Seu currículo atualizado. O sistema extrai os dados e personaliza cada candidatura automaticamente.",
                  },
                  {
                    title: "Conta Gmail ou Outlook",
                    desc: "Os emails saem da SUA caixa de saída. Você mantém controle total sobre o que é enviado.",
                  },
                  {
                    title: '"Senha de App" do seu email',
                    desc: "Uma senha especial (não a sua senha normal) gerada pelo Google ou Microsoft para autorizar envios via SMTP. Tutorial incluso.",
                  },
                  {
                    title: "Alguns minutos para revisar",
                    desc: "Você escolhe as vagas, monta a fila e define quando enviar. Nada acontece sem seu comando.",
                  },
                ].map((item, i, arr) => (
                  <div
                    key={item.title}
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

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        <section style={{ padding: "88px 24px", background: "#F5F2EC", borderBottom: "1px solid #D6CFC4" }}>
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
                FAQ
              </p>
              <h2 style={{ fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 700, letterSpacing: "-0.02em" }}>
                Perguntas frequentes
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
                    <div
                      style={{
                        padding: "0 24px 20px",
                        fontSize: 14,
                        color: "#64748B",
                        lineHeight: 1.7,
                      }}
                    >
                      {item.a}
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
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent, transparent 32px, rgba(255,255,255,0.025) 32px, rgba(255,255,255,0.025) 33px)",
              }}
            >
              {/* Decorative accent */}
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
                  Comece agora — é grátis
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
                  Pronto para encontrar
                  <br />
                  sua vaga nos EUA?
                </h2>
                <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, maxWidth: 400 }}>
                  Crie sua conta em menos de 2 minutos. Sem cartão de crédito.
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
                  Criar conta gratuita <ArrowRight size={16} />
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
                  <Globe size={14} /> Ver vagas disponíveis
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <footer style={{ borderTop: "1px solid #E2E8F0", padding: "32px 24px", background: "#FDFCFA" }}>
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
              © {new Date().getFullYear()} H2 Linker — Smart connections. Real opportunities.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
