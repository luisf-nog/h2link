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

// ─── Jobs ticker ─────────────────────────────────────────────────────────────
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

// ─── Steps ───────────────────────────────────────────────────────────────────
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
    desc: "Centenas de vagas atualizadas diariamente do DOL. Cada vaga exibe salário completo, horas semanais, data de início da temporada, experiência exigida e educação mínima.",
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
    title: "Aguarde o retorno",
    desc: "Os empregadores respondem diretamente para o seu email — sem intermediários.",
  },
];

// ─── Features ────────────────────────────────────────────────────────────────
const features = [
  {
    icon: Shield,
    title: "Aquecimento inteligente",
    desc: "Aumento progressivo do limite de envios que protege a reputação do seu domínio. Começa conservador e cresce automaticamente.",
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
    desc: "Controle total sobre formalidade, abertura, saudação, fechamento, tamanho e ênfases como idiomas e disponibilidade.",
    badge: "Black",
    wide: true,
  },
  {
    icon: FileText,
    title: "Fichas completas de cada vaga",
    desc: "Salário (faixa mínima e máxima), horas semanais, data de início, experiência exigida, educação requerida e contato direto com o empregador.",
    badge: null,
    wide: true,
  },
  {
    icon: Radar,
    title: "Radar de vagas",
    desc: "Configure filtros por setor, estado e salário. Vagas novas entram na sua fila automaticamente.",
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

// ─── US States ───────────────────────────────────────────────────────────────
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

// ─── Star SVG path (5-pointed) ───────────────────────────────────────────────
const STAR = "M10 1.5l2.4 7.4H20l-6.2 4.5 2.4 7.4L10 16.4 3.8 20.8l2.4-7.4L0 8.9h7.6z";

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

        :root {
          --navy:    #020B18;
          --navy-1:  #06152A;
          --navy-2:  #0C1F3A;
          --navy-3:  #112344;
          --red:     #B22234;
          --red-lt:  #CC2A40;
          --white:   #FFFFFF;
          --off-white: rgba(255,255,255,0.88);
          --muted:   rgba(255,255,255,0.45);
          --faint:   rgba(255,255,255,0.12);
          --border:  rgba(255,255,255,0.10);
          --orange:  #D4500A;
          --cyan:    hsl(199,88%,48%);
        }

        body {
          font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
          background: var(--navy);
          color: var(--white);
          -webkit-font-smoothing: antialiased;
        }

        /* ── Stars watermark ── */
        .stars-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .stars-bg::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpolygon points='30,4 35,20 52,20 38,30 43,46 30,36 17,46 22,30 8,20 25,20' fill='white' opacity='0.04'/%3E%3C/svg%3E");
          background-size: 60px 60px;
        }

        /* ── Red stripe accent ── */
        .stripe-top {
          border-top: 3px solid var(--red);
        }
        .stripe-bottom {
          border-bottom: 3px solid var(--red);
        }

        /* ── Ticker animations ── */
        @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes states-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .ticker-track { display: flex; width: max-content; animation: ticker 38s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }
        .states-track { display: flex; width: max-content; animation: states-scroll 55s linear infinite; }

        /* ── Cards ── */
        .glass-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.10);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-radius: 10px;
          transition: background 0.2s, border-color 0.2s;
        }
        .glass-card:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.18);
        }
        .glass-card:hover .feat-icon { color: var(--cyan) !important; }

        /* ── Step cards ── */
        .step-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          transition: background 0.2s, border-color 0.2s;
          cursor: default;
        }
        .step-card:hover {
          background: rgba(255,255,255,0.07);
          border-color: var(--red) !important;
        }
        .step-card:hover .step-num { color: var(--red) !important; }

        /* ── FAQ ── */
        .faq-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10); border-radius: 10px; overflow: hidden; }
        .faq-row:hover .faq-q { color: var(--cyan) !important; }

        /* ── Buttons ── */
        .btn-primary { transition: opacity 0.15s, transform 0.15s; }
        .btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn-outline:hover { background: rgba(255,255,255,0.12) !important; }
        .nav-cta:hover { opacity: 0.85; }

        /* ── Red stripe divider ── */
        .section-divider {
          height: 3px;
          background: linear-gradient(90deg, var(--red) 0%, var(--red-lt) 50%, var(--red) 100%);
          opacity: 0.7;
        }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .hero-grid     { grid-template-columns: 1fr !important; }
          .hero-left     { padding: 56px 0 32px !important; border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.10) !important; }
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

      <div style={{ minHeight: "100vh", background: "var(--navy)" }}>
        {/* ── NAV ─────────────────────────────────────────────────────────── */}
        <nav
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "rgba(2,11,24,0.92)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            height: 68,
            display: "flex",
            alignItems: "center",
          }}
        >
          {/* Red top line */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: "linear-gradient(90deg,#B22234,#CC2A40,#B22234)",
              opacity: 0.9,
            }}
          />
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
                    background: "var(--orange)",
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
                    background: "var(--orange)",
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
        <section
          style={{
            position: "relative",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            background: "var(--navy-1)",
            overflow: "hidden",
          }}
        >
          {/* Stars watermark */}
          <div className="stars-bg" />
          {/* Red side accent */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              background: "linear-gradient(180deg, #B22234 0%, rgba(178,34,52,0.2) 100%)",
            }}
          />

          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", position: "relative", zIndex: 1 }}>
            <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 560 }}>
              {/* Left */}
              <div
                className="hero-left"
                style={{
                  padding: "80px 64px 80px 0",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  borderRight: "1px solid rgba(255,255,255,0.10)",
                }}
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
                      boxShadow: "0 0 0 3px rgba(34,197,94,0.25)",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.55)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    Base DOL atualizada hoje
                  </span>
                </div>

                <h1
                  style={{
                    fontSize: "clamp(36px, 4vw, 56px)",
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    lineHeight: 1.08,
                    color: "#fff",
                    marginBottom: 22,
                  }}
                >
                  A ferramenta que faz
                  <br />
                  você chegar primeiro
                  <br />
                  <span style={{ color: "var(--orange)" }}>nas vagas H-2A e H-2B</span>
                </h1>

                <p
                  style={{
                    fontSize: 16,
                    color: "rgba(255,255,255,0.60)",
                    lineHeight: 1.75,
                    marginBottom: 40,
                    maxWidth: 440,
                  }}
                >
                  Automatize candidaturas e aplique para dezenas de empregadores verificados do DOL — tudo da sua
                  própria caixa de email.
                </p>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    className="btn-primary"
                    onClick={() => navigate("/auth")}
                    style={{
                      background: "var(--orange)",
                      color: "#fff",
                      border: "none",
                      padding: "14px 26px",
                      borderRadius: 7,
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Criar conta gratuita <ArrowRight size={16} />
                  </button>
                  <button
                    className="btn-outline"
                    onClick={() => navigate("/jobs")}
                    style={{
                      background: "transparent",
                      color: "rgba(255,255,255,0.8)",
                      border: "1.5px solid rgba(255,255,255,0.20)",
                      padding: "14px 22px",
                      borderRadius: 7,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      whiteSpace: "nowrap",
                      transition: "background 0.15s",
                    }}
                  >
                    <Search size={15} /> Ver vagas
                  </button>
                </div>
              </div>

              {/* Right — stats */}
              <div
                className="hero-right"
                style={{
                  padding: "80px 0 80px 64px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 0,
                }}
              >
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
                    style={{ padding: "30px 0", borderBottom: s.border ? "1px solid rgba(255,255,255,0.10)" : "none" }}
                  >
                    <div
                      style={{
                        fontSize: 38,
                        fontWeight: 700,
                        color: "#fff",
                        letterSpacing: "-0.025em",
                        lineHeight: 1,
                        marginBottom: 6,
                      }}
                    >
                      {s.value}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.80)", marginBottom: 3 }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)" }}>{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── RED STRIPE ──────────────────────────────────────────────────── */}
        <div
          style={{
            height: 4,
            background: "linear-gradient(90deg, var(--red) 0%, #D42B3F 33%, var(--red) 66%, var(--red-lt) 100%)",
          }}
        />

        {/* ── JOBS TICKER ─────────────────────────────────────────────────── */}
        <div
          style={{
            background: "var(--navy-2)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
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
              background: "linear-gradient(to right, var(--navy-2), transparent)",
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
              background: "linear-gradient(to left, var(--navy-2), transparent)",
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
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.07em",
                    padding: "2px 7px",
                    borderRadius: 4,
                    background: job.type === "H-2A" ? "rgba(34,197,94,0.15)" : "rgba(59,130,246,0.15)",
                    color: job.type === "H-2A" ? "#4ADE80" : "#60A5FA",
                    border: `1px solid ${job.type === "H-2A" ? "rgba(34,197,94,0.25)" : "rgba(59,130,246,0.25)"}`,
                  }}
                >
                  {job.type}
                </span>
                <span style={{ fontWeight: 600, color: "#fff" }}>{job.title}</span>
                <span style={{ color: "rgba(255,255,255,0.40)", display: "flex", alignItems: "center", gap: 3 }}>
                  <MapPin size={11} /> {job.location}
                </span>
                <span style={{ color: "var(--orange)", fontWeight: 600 }}>{job.salary}</span>
                <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 18 }}>·</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── US STATES BAND ──────────────────────────────────────────────── */}
        <div
          style={{
            background: "var(--red)",
            overflow: "hidden",
            padding: "9px 0",
            position: "relative",
            borderBottom: "1px solid rgba(0,0,0,0.2)",
          }}
        >
          <div className="states-track">
            {[...US_STATES, ...US_STATES].map((state, i) => (
              <span
                key={i}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "0 18px",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.75)",
                  whiteSpace: "nowrap",
                }}
              >
                {state}
                <span style={{ color: "rgba(255,255,255,0.40)", fontSize: 7 }}>★</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
        <section
          style={{
            position: "relative",
            padding: "88px 24px",
            background: "var(--navy-1)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <div className="stars-bg" />
          <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
            <div style={{ maxWidth: 560, marginBottom: 56 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--red-lt)",
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
                  color: "#fff",
                }}
              >
                Do zero às candidaturas
                <br />
                em 6 passos simples
              </h2>
            </div>

            <div className="steps-grid" style={{ display: "grid", gap: 1, background: "rgba(255,255,255,0.06)" }}>
              {steps.map((step) => (
                <div
                  key={step.n}
                  className="step-card"
                  style={{ padding: "32px 28px", border: "1px solid transparent", cursor: "default" }}
                >
                  <div
                    className="step-num"
                    style={{
                      fontSize: 52,
                      fontWeight: 700,
                      lineHeight: 1,
                      color: "rgba(255,255,255,0.07)",
                      marginBottom: 20,
                      transition: "color 0.2s",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {step.n}
                  </div>
                  <step.icon size={20} color="var(--orange)" style={{ marginBottom: 14 }} />
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#fff" }}>{step.title}</h3>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.50)", lineHeight: 1.65 }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── RED STRIPE ──────────────────────────────────────────────────── */}
        <div
          style={{
            height: 4,
            background: "linear-gradient(90deg, var(--red) 0%, #D42B3F 33%, var(--red) 66%, var(--red-lt) 100%)",
          }}
        />

        {/* ── FEATURES BENTO ──────────────────────────────────────────────── */}
        <section
          style={{
            padding: "88px 24px",
            background: "var(--navy-2)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ maxWidth: 560, marginBottom: 56 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--cyan)",
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
                  color: "#fff",
                }}
              >
                Ferramentas que fazem
                <br />a diferença
              </h2>
            </div>

            <div className="bento-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {features.map((f) => (
                <div
                  key={f.title}
                  className="glass-card"
                  style={{ padding: "28px 24px", gridColumn: f.wide ? "span 2" : "span 1", position: "relative" }}
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
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        padding: "3px 8px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.65)",
                      }}
                    >
                      <Crown size={9} /> Plano {f.badge}
                    </div>
                  )}
                  <f.icon
                    className="feat-icon"
                    size={22}
                    style={{ color: "rgba(255,255,255,0.20)", marginBottom: 16, transition: "color 0.2s" }}
                  />
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#fff" }}>{f.title}</h3>
                  <p
                    style={{
                      fontSize: 14,
                      color: "rgba(255,255,255,0.50)",
                      lineHeight: 1.65,
                      maxWidth: f.wide ? 520 : "none",
                    }}
                  >
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── LIFETIME PRICING ────────────────────────────────────────────── */}
        <section
          style={{
            position: "relative",
            padding: "88px 24px",
            background: "var(--navy-1)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <div className="stars-bg" />
          <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
            <div style={{ maxWidth: 560, marginBottom: 56 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--orange)",
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
                  color: "#fff",
                }}
              >
                Pague uma vez.
                <br />
                Use para sempre.
              </h2>
            </div>

            <div className="lifetime-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* H2 Linker card */}
              <div
                style={{
                  background: "rgba(210,76,10,0.10)",
                  border: "1px solid rgba(210,76,10,0.35)",
                  borderRadius: 12,
                  padding: "48px 40px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -60,
                    right: -60,
                    width: 200,
                    height: 200,
                    borderRadius: "50%",
                    background: "rgba(210,76,10,0.08)",
                    pointerEvents: "none",
                  }}
                />
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "rgba(210,76,10,0.15)",
                    border: "1px solid rgba(210,76,10,0.35)",
                    padding: "4px 12px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.07em",
                    color: "var(--orange)",
                    textTransform: "uppercase",
                    marginBottom: 28,
                  }}
                >
                  <InfinityIcon size={12} /> H2 Linker
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span
                    style={{ fontSize: 56, fontWeight: 700, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1 }}
                  >
                    1x
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.65)",
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
                      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.80)", fontWeight: 500 }}>{item}</span>
                    </div>
                  ))}
                </div>
                <button
                  className="btn-primary"
                  onClick={() => navigate("/auth")}
                  style={{
                    marginTop: 36,
                    background: "var(--orange)",
                    color: "#fff",
                    border: "none",
                    padding: "13px 24px",
                    borderRadius: 7,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    whiteSpace: "nowrap",
                  }}
                >
                  Ver planos <ArrowRight size={15} />
                </button>
              </div>

              {/* Competitors card */}
              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: "48px 40px",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "rgba(178,34,52,0.12)",
                    border: "1px solid rgba(178,34,52,0.30)",
                    padding: "4px 12px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.07em",
                    color: "#F87171",
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
                      color: "rgba(255,255,255,0.25)",
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
                    color: "rgba(255,255,255,0.35)",
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
                          background: "rgba(178,34,52,0.20)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <X size={11} color="#F87171" />
                      </div>
                      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── RED STRIPE ──────────────────────────────────────────────────── */}
        <div
          style={{
            height: 4,
            background: "linear-gradient(90deg, var(--red) 0%, #D42B3F 33%, var(--red) 66%, var(--red-lt) 100%)",
          }}
        />

        {/* ── REFERRAL PROGRAM ────────────────────────────────────────────── */}
        <section
          style={{
            padding: "72px 24px",
            background: "var(--navy-2)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 56, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 320px" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "rgba(34,197,94,0.10)",
                    border: "1px solid rgba(34,197,94,0.22)",
                    padding: "4px 12px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.07em",
                    color: "#4ADE80",
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
                    color: "#fff",
                  }}
                >
                  Indique amigos.
                  <br />
                  Ganhe mais envios por dia.
                </h2>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.50)", lineHeight: 1.7, maxWidth: 420 }}>
                  Para usuários do plano gratuito, cada amigo que você indicar e ativar a conta aumenta seu limite
                  diário de envios — sem pagar nada. É a forma mais rápida de acelerar suas candidaturas.
                </p>
              </div>
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
                      borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                      alignItems: "flex-start",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 12,
                        color: "rgba(255,255,255,0.20)",
                        letterSpacing: "0.03em",
                        flexShrink: 0,
                        paddingTop: 2,
                        minWidth: 24,
                      }}
                    >
                      {step.n}
                    </span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 3 }}>{step.title}</div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── REQUIREMENTS ────────────────────────────────────────────────── */}
        <section
          style={{
            padding: "88px 24px",
            background: "var(--navy-3)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 80, alignItems: "start" }}>
              <div style={{ position: "sticky", top: 88 }}>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--orange)",
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
                    color: "#fff",
                  }}
                >
                  O que você precisa para começar
                </h2>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.50)", lineHeight: 1.7 }}>
                  Tenha esses itens em mãos. O processo de configuração leva menos de 5 minutos e tem tutorial em vídeo
                  para cada etapa.
                </p>
                <button
                  className="btn-primary"
                  onClick={() => navigate("/auth")}
                  style={{
                    marginTop: 32,
                    background: "var(--orange)",
                    color: "#fff",
                    border: "none",
                    padding: "12px 22px",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  Criar conta grátis <ArrowRight size={15} />
                </button>
              </div>
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
                    desc: "Uma senha especial gerada pelo Google ou Microsoft para autorizar envios via SMTP. Tutorial incluso.",
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
                      borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "rgba(34,197,94,0.15)",
                        border: "1px solid rgba(34,197,94,0.25)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <CheckCircle2 size={15} color="#4ADE80" />
                    </div>
                    <div>
                      <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: "#fff" }}>{item.title}</h4>
                      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.50)", lineHeight: 1.65 }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        <section
          style={{
            position: "relative",
            padding: "88px 24px",
            background: "var(--navy-1)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <div className="stars-bg" />
          <div style={{ maxWidth: 720, margin: "0 auto", position: "relative", zIndex: 1 }}>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--red-lt)",
                  marginBottom: 12,
                }}
              >
                FAQ
              </p>
              <h2
                style={{ fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 700, letterSpacing: "-0.02em", color: "#fff" }}
              >
                Perguntas frequentes
              </h2>
            </div>

            <div className="faq-card">
              {faqs.map((item, i) => (
                <div
                  key={i}
                  className="faq-row"
                  style={{ borderBottom: i < faqs.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}
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
                      color: "#fff",
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
                        color: "rgba(255,255,255,0.30)",
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
                        color: "rgba(255,255,255,0.55)",
                        lineHeight: 1.75,
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

        {/* ── RED STRIPE ──────────────────────────────────────────────────── */}
        <div
          style={{
            height: 4,
            background: "linear-gradient(90deg, var(--red) 0%, #D42B3F 33%, var(--red) 66%, var(--red-lt) 100%)",
          }}
        />

        {/* ── FINAL CTA ───────────────────────────────────────────────────── */}
        <section
          style={{ position: "relative", padding: "96px 24px", background: "var(--navy-2)", overflow: "hidden" }}
        >
          <div className="stars-bg" />
          {/* Big decorative star */}
          <div
            style={{
              position: "absolute",
              right: -80,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              opacity: 0.04,
            }}
          >
            <svg width="400" height="400" viewBox="0 0 20 20">
              <polygon
                points="10,1 12.4,7.4 19,7.4 13.8,11.9 16.2,18.3 10,14.5 3.8,18.3 6.2,11.9 1,7.4 7.6,7.4"
                fill="white"
              />
            </svg>
          </div>

          <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(178,34,52,0.12)",
                border: "1px solid rgba(178,34,52,0.28)",
                padding: "5px 14px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.10em",
                color: "#F87171",
                textTransform: "uppercase",
                marginBottom: 28,
              }}
            >
              ★ ★ ★ &nbsp; Comece agora — é grátis &nbsp; ★ ★ ★
            </div>
            <h2
              style={{
                fontSize: "clamp(32px, 5vw, 52px)",
                fontWeight: 700,
                letterSpacing: "-0.028em",
                lineHeight: 1.08,
                color: "#fff",
                marginBottom: 16,
              }}
            >
              Pronto para encontrar
              <br />
              sua vaga nos EUA?
            </h2>
            <p
              style={{
                fontSize: 17,
                color: "rgba(255,255,255,0.50)",
                lineHeight: 1.65,
                maxWidth: 440,
                margin: "0 auto 44px",
              }}
            >
              Crie sua conta em menos de 2 minutos. Sem cartão de crédito.
            </p>
            <div
              className="cta-row"
              style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}
            >
              <button
                className="btn-primary"
                onClick={() => navigate("/auth")}
                style={{
                  background: "var(--orange)",
                  color: "#fff",
                  border: "none",
                  padding: "15px 32px",
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  whiteSpace: "nowrap",
                }}
              >
                Criar conta gratuita <ArrowRight size={17} />
              </button>
              <button
                onClick={() => navigate("/jobs")}
                style={{
                  background: "transparent",
                  color: "rgba(255,255,255,0.55)",
                  border: "1.5px solid rgba(255,255,255,0.15)",
                  padding: "15px 28px",
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  transition: "color 0.15s, border-color 0.15s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#fff";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "rgba(255,255,255,0.55)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                }}
              >
                <Globe size={15} /> Ver vagas disponíveis
              </button>
            </div>
          </div>
        </section>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <footer
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "32px 24px", background: "var(--navy)" }}
        >
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
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", fontWeight: 500 }}>
              © {new Date().getFullYear()} H2 Linker — Smart connections. Real opportunities.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
