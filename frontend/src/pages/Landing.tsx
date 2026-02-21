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
} from "lucide-react";

// ─── Tokens ─────────────────────────────────────────────────────────────────
const C = {
  cream: "#F5F0E8",
  ink: "#141210",
  inkMid: "#4A453E",
  inkLight: "#9A938A",
  orange: "#D4500A",
  orangeHover: "#B84408",
  navy: "#0A2342",
  white: "#FFFFFF",
  border: "#D6CFC4",
};

const font = {
  display: "'Playfair Display', Georgia, serif",
  body: "'DM Sans', system-ui, sans-serif",
};

// ─── Inline style helpers ────────────────────────────────────────────────────
const styles = {
  page: {
    fontFamily: font.body,
    background: C.cream,
    color: C.ink,
    minHeight: "100vh",
  } as React.CSSProperties,

  nav: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    borderBottom: `1px solid ${C.border}`,
    background: C.cream,
  } as React.CSSProperties,

  navInner: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "0 24px",
    height: 64,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  } as React.CSSProperties,

  btnPrimary: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 24px",
    background: C.orange,
    color: C.white,
    border: "none",
    fontFamily: font.body,
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
    transition: "background 0.15s",
  } as React.CSSProperties,

  btnSecondary: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 24px",
    background: "transparent",
    color: C.ink,
    border: `1.5px solid ${C.ink}`,
    fontFamily: font.body,
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
    transition: "background 0.15s, color 0.15s",
  } as React.CSSProperties,

  btnNavPrimary: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 20px",
    background: C.ink,
    color: C.white,
    border: "none",
    fontFamily: font.body,
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  } as React.CSSProperties,
};

// ─── Steps & Features data ────────────────────────────────────────────────────
const steps = [
  {
    icon: Upload,
    title: "Importe seu currículo",
    desc: "Faça upload em PDF ou Word. O sistema extrai seus dados e personaliza cada candidatura automaticamente.",
  },
  {
    icon: Mail,
    title: "Configure seu email",
    desc: 'Conecte Gmail ou Outlook com uma "Senha de App" segura. Os emails saem direto da sua caixa, sem intermediários.',
  },
  {
    icon: FileText,
    title: "Personalize templates",
    desc: "Crie ou use templates prontos. Nossa IA gera assuntos e corpos únicos para cada vaga.",
  },
  {
    icon: Search,
    title: "Navegue pelas vagas H-2A/H-2B",
    desc: "Centenas de vagas atualizadas diariamente direto do DOL. Filtre por estado, salário e tipo de visto.",
  },
  {
    icon: Send,
    title: "Adicione à fila e envie",
    desc: "Selecione as vagas, monte sua fila e envie candidaturas em massa com um clique.",
  },
  {
    icon: BarChart3,
    title: "Acompanhe seus resultados",
    desc: "Veja quem abriu seu email, quem visualizou seu currículo e quantas vezes. Dados reais.",
  },
];

const features = [
  {
    icon: Shield,
    title: "Aquecimento inteligente",
    desc: "Sistema progressivo que protege a reputação do seu email, aumentando o limite de envios gradualmente.",
  },
  {
    icon: Zap,
    title: "IA personalizada",
    desc: "Emails únicos para cada vaga, evitando filtros de spam e aumentando respostas dos empregadores.",
  },
  {
    icon: Eye,
    title: "Rastreamento avançado",
    desc: "Spy pixel que filtra scanners de antivírus e mostra apenas aberturas genuínas do empregador.",
  },
  {
    icon: Radar,
    title: "Radar de vagas",
    desc: "Configure filtros e receba novas vagas automaticamente na sua fila, sem buscar manualmente.",
  },
  {
    icon: Clock,
    title: "Delay anti-spam",
    desc: "Intervalos randomizados entre envios para simular comportamento humano e proteger sua conta.",
  },
  {
    icon: Users,
    title: "Programa de indicações",
    desc: "Indique amigos e ganhe créditos extras de envio. Mais indicações ativas, mais emails por dia.",
  },
];

const requirements = [
  {
    title: "Um currículo em PDF ou Word",
    desc: "Seu currículo atualizado para que o sistema personalize cada candidatura.",
  },
  {
    title: "Uma conta Gmail ou Outlook",
    desc: "Os emails saem da SUA caixa de saída. Você mantém controle total.",
  },
  {
    title: '"Senha de App" do seu email',
    desc: "Uma senha especial (não a sua senha normal) que autoriza o envio via sistema. Tutorial incluso no app.",
  },
  {
    title: "Disposição para revisar e enviar",
    desc: "Você escolhe as vagas, monta a fila e controla quando enviar. Nada é enviado sem seu comando.",
  },
];

// ─── Component ───────────────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const handleChangeLanguage = (next: SupportedLanguage) => {
    i18n.changeLanguage(next);
    localStorage.setItem("app_language", next);
  };

  const goToAuth = () => navigate("/auth");
  const goToJobs = () => navigate("/jobs");

  return (
    <>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .btn-primary:hover { background: ${C.orangeHover} !important; }
        .btn-secondary:hover { background: ${C.ink} !important; color: ${C.white} !important; }
        .btn-secondary-light:hover { background: ${C.white}22 !important; }
        .step-card:hover { border-color: ${C.orange} !important; }
        .feature-card:hover .feature-icon { color: ${C.orange} !important; }

        @media (max-width: 640px) {
          .hero-title { font-size: 42px !important; }
          .stats-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .cta-buttons { flex-direction: column !important; }
          .nav-actions { gap: 8px !important; }
        }
        @media (min-width: 768px) {
          .steps-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .features-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (min-width: 1024px) {
          .steps-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .features-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>

      <div style={styles.page}>
        {/* ── NAV ─────────────────────────────────────────────────────────── */}
        <nav style={styles.nav}>
          <div style={styles.navInner}>
            <BrandWordmark height={32} />
            <div className="nav-actions" style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <LanguageSwitcher
                value={isSupportedLanguage(i18n.language) ? i18n.language : "pt"}
                onChange={handleChangeLanguage}
              />
              {user ? (
                <button className="btn-primary" style={styles.btnNavPrimary} onClick={() => navigate("/dashboard")}>
                  Dashboard
                </button>
              ) : (
                <button className="btn-primary" style={styles.btnNavPrimary} onClick={goToAuth}>
                  Entrar / Criar Conta
                </button>
              )}
            </div>
          </div>
        </nav>

        {/* ── HERO ────────────────────────────────────────────────────────── */}
        <section style={{ borderBottom: `1px solid ${C.border}` }}>
          <div style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 24px 72px" }}>
            {/* Eyebrow */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                border: `1px solid ${C.border}`,
                padding: "6px 14px",
                marginBottom: 32,
                fontFamily: font.body,
                fontSize: 13,
                fontWeight: 500,
                color: C.inkMid,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: C.orange,
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              Plataforma nº 1 para candidaturas H-2A & H-2B
            </div>

            {/* Title */}
            <h1
              className="hero-title"
              style={{
                fontFamily: font.display,
                fontSize: 72,
                fontWeight: 900,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                maxWidth: 800,
                marginBottom: 28,
              }}
            >
              Automatize suas candidaturas <span style={{ color: C.orange }}>H-2A & H-2B</span>
            </h1>

            {/* Subtitle */}
            <p
              style={{
                fontFamily: font.body,
                fontSize: 18,
                lineHeight: 1.7,
                color: C.inkMid,
                maxWidth: 560,
                marginBottom: 40,
              }}
            >
              Pare de enviar emails um por um. O H2 Linker conecta você a empregadores verificados dos EUA com
              candidaturas personalizadas e rastreamento em tempo real.
            </p>

            {/* CTAs */}
            <div
              className="cta-buttons"
              style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 56, flexWrap: "wrap" }}
            >
              <button className="btn-primary" style={styles.btnPrimary} onClick={goToAuth}>
                Comece Grátis <ArrowRight size={16} />
              </button>
              <button className="btn-secondary" style={styles.btnSecondary} onClick={goToJobs}>
                <Search size={16} /> Explorar Vagas
              </button>
            </div>

            {/* Stats */}
            <div
              className="stats-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 0,
                maxWidth: 480,
                border: `1px solid ${C.border}`,
              }}
            >
              {[
                { value: "500+", label: "Vagas ativas" },
                { value: "24h", label: "Atualização diária" },
                { value: "100%", label: "Grátis para começar" },
              ].map((s, i) => (
                <div
                  key={s.label}
                  style={{
                    padding: "20px 24px",
                    borderLeft: i > 0 ? `1px solid ${C.border}` : "none",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontFamily: font.display,
                      fontSize: 28,
                      fontWeight: 700,
                      color: C.orange,
                      lineHeight: 1,
                      marginBottom: 4,
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    style={{
                      fontFamily: font.body,
                      fontSize: 12,
                      fontWeight: 500,
                      color: C.inkLight,
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
        <section style={{ borderBottom: `1px solid ${C.border}` }}>
          <div style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 24px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 56 }}>
              <h2
                style={{
                  fontFamily: font.display,
                  fontSize: 40,
                  fontWeight: 700,
                  lineHeight: 1.1,
                }}
              >
                Como funciona?
              </h2>
              <p
                style={{
                  fontFamily: font.body,
                  fontSize: 16,
                  color: C.inkMid,
                  maxWidth: 400,
                }}
              >
                6 passos do zero até dezenas de candidaturas personalizadas por dia.
              </p>
            </div>

            <div
              className="steps-grid"
              style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: C.border }}
            >
              {steps.map((step, i) => (
                <div
                  key={step.title}
                  className="step-card"
                  style={{
                    background: C.cream,
                    padding: "32px 28px",
                    border: `1px solid ${C.border}`,
                    transition: "border-color 0.15s",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      fontFamily: font.display,
                      fontSize: 64,
                      fontWeight: 900,
                      color: C.border,
                      lineHeight: 1,
                      marginBottom: 16,
                      userSelect: "none",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <step.icon size={22} color={C.orange} />
                  </div>
                  <h3
                    style={{
                      fontFamily: font.body,
                      fontSize: 16,
                      fontWeight: 600,
                      marginBottom: 8,
                      color: C.ink,
                    }}
                  >
                    {step.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: font.body,
                      fontSize: 14,
                      lineHeight: 1.65,
                      color: C.inkMid,
                    }}
                  >
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ────────────────────────────────────────────────────── */}
        <section style={{ background: C.navy, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 24px" }}>
            <div style={{ marginBottom: 56 }}>
              <div
                style={{
                  display: "inline-block",
                  fontFamily: font.body,
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.orange,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  borderBottom: `2px solid ${C.orange}`,
                  paddingBottom: 4,
                  marginBottom: 20,
                }}
              >
                Recursos
              </div>
              <h2
                style={{
                  fontFamily: font.display,
                  fontSize: 40,
                  fontWeight: 700,
                  lineHeight: 1.1,
                  color: C.white,
                  maxWidth: 560,
                }}
              >
                Ferramentas que fazem a diferença
              </h2>
            </div>

            <div
              className="features-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 1,
                background: "#ffffff18",
              }}
            >
              {features.map((f) => (
                <div
                  key={f.title}
                  className="feature-card"
                  style={{
                    background: C.navy,
                    padding: "32px 28px",
                    borderTop: `3px solid transparent`,
                    transition: "border-color 0.15s",
                    cursor: "default",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderTopColor = C.orange;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderTopColor = "transparent";
                  }}
                >
                  <f.icon
                    className="feature-icon"
                    size={24}
                    style={{ color: "#ffffff44", marginBottom: 16, transition: "color 0.15s" }}
                  />
                  <h3
                    style={{
                      fontFamily: font.body,
                      fontSize: 15,
                      fontWeight: 600,
                      color: C.white,
                      marginBottom: 10,
                    }}
                  >
                    {f.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: font.body,
                      fontSize: 14,
                      lineHeight: 1.65,
                      color: "#ffffff66",
                    }}
                  >
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── REQUIREMENTS ────────────────────────────────────────────────── */}
        <section style={{ borderBottom: `1px solid ${C.border}` }}>
          <div style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 64, alignItems: "start" }}>
              <div style={{ position: "sticky", top: 80 }}>
                <div
                  style={{
                    fontFamily: font.body,
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.orange,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: 20,
                  }}
                >
                  Pré-requisitos
                </div>
                <h2
                  style={{
                    fontFamily: font.display,
                    fontSize: 40,
                    fontWeight: 700,
                    lineHeight: 1.1,
                    marginBottom: 16,
                  }}
                >
                  O que você precisa para começar
                </h2>
                <p
                  style={{
                    fontFamily: font.body,
                    fontSize: 15,
                    color: C.inkMid,
                    lineHeight: 1.7,
                  }}
                >
                  Tenha estes itens em mãos antes de criar sua conta. O processo leva menos de 5 minutos.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {requirements.map((item, i) => (
                  <div
                    key={item.title}
                    style={{
                      display: "flex",
                      gap: 20,
                      padding: "28px 0",
                      borderBottom: i < requirements.length - 1 ? `1px solid ${C.border}` : "none",
                    }}
                  >
                    <CheckCircle2 size={20} style={{ color: C.orange, flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <h4
                        style={{
                          fontFamily: font.body,
                          fontSize: 15,
                          fontWeight: 600,
                          color: C.ink,
                          marginBottom: 6,
                        }}
                      >
                        {item.title}
                      </h4>
                      <p
                        style={{
                          fontFamily: font.body,
                          fontSize: 14,
                          lineHeight: 1.65,
                          color: C.inkMid,
                        }}
                      >
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ───────────────────────────────────────────────────── */}
        <section style={{ background: C.orange }}>
          <div style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 24px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 40,
              }}
            >
              <div>
                <h2
                  style={{
                    fontFamily: font.display,
                    fontSize: 48,
                    fontWeight: 700,
                    lineHeight: 1.05,
                    color: C.white,
                    marginBottom: 12,
                  }}
                >
                  Pronto para começar?
                </h2>
                <p
                  style={{
                    fontFamily: font.body,
                    fontSize: 16,
                    color: "#ffffffcc",
                    lineHeight: 1.6,
                    maxWidth: 440,
                  }}
                >
                  Crie sua conta gratuita em menos de 2 minutos e comece a enviar candidaturas profissionais hoje mesmo.
                </p>
              </div>

              <div className="cta-buttons" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <button
                  onClick={goToAuth}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "14px 28px",
                    background: C.white,
                    color: C.orange,
                    border: "none",
                    fontFamily: font.body,
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: "pointer",
                  }}
                >
                  Criar Conta Grátis <ArrowRight size={16} />
                </button>
                <button
                  onClick={goToJobs}
                  className="btn-secondary-light"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "14px 28px",
                    background: "transparent",
                    color: C.white,
                    border: `1.5px solid ${C.white}`,
                    fontFamily: font.body,
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: "pointer",
                  }}
                >
                  Ver Vagas Disponíveis
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <footer style={{ borderTop: `1px solid ${C.border}`, padding: "28px 24px" }}>
          <div
            style={{
              maxWidth: 1120,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <BrandWordmark height={26} />
            <p
              style={{
                fontFamily: font.body,
                fontSize: 13,
                color: C.inkLight,
              }}
            >
              © {new Date().getFullYear()} H2 Linker. Smart connections. Real opportunities.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
