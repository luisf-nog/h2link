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
  DollarSign,
  Briefcase,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

// ─── Tokens (Ajustados para o padrão do Sistema) ────────────────────────────
const C = {
  white: "#FFFFFF",
  ghost: "#F8FAFC", // Cinza ultra claro para seções
  ink: "#0F172A", // Navy bem escuro (Padrão SaaS)
  inkMid: "#475569",
  inkLight: "#94A3B8",
  orange: "#D4500A",
  orangeHover: "#B84408",
  navy: "#0A2342", // Cor principal do sistema
  border: "#E2E8F0",
};

const font = {
  display: "'Inter', system-ui, sans-serif", // Troquei para Inter para ser mais "sistema"
  body: "'Inter', system-ui, sans-serif",
};

// ─── Componentes Auxiliares ─────────────────────────────────────────────────
const JobCard = ({ type, title, location, salary }: any) => (
  <div
    style={{
      background: C.white,
      padding: 20,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}
  >
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: type === "H-2A" ? "#16A34A" : C.orange,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {type} • Early Access
    </div>
    <h4 style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>{title}</h4>
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.inkMid }}>
        <MapPin size={14} /> {location}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.inkMid }}>
        <DollarSign size={14} /> {salary}
      </div>
    </div>
  </div>
);

// ─── Data ───────────────────────────────────────────────────────────────────
const steps = [
  {
    icon: Upload,
    title: "Importe seu currículo",
    desc: "Upload em PDF ou Word. O sistema extrai seus dados automaticamente.",
  },
  {
    icon: Mail,
    title: "Conecte seu email",
    desc: "Use uma 'Senha de App' segura. Os emails saem da SUA caixa de saída.",
  },
  { icon: Search, title: "Explore +10k vagas", desc: "Vagas H-2A/H-2B diretas do DOL, atualizadas a cada hora." },
  {
    icon: Radar,
    title: "Early Access Radar",
    desc: "Acesse vagas assim que o NOA é emitido, antes de chegarem ao grande público.",
  },
  { icon: Send, title: "Envio em Massa", desc: "Monte sua fila e dispare dezenas de candidaturas em um clique." },
  {
    icon: BarChart3,
    title: "Analytics Real",
    desc: "Saiba exatamente quando o patrão abriu seu email e viu seu currículo.",
  },
];

const faqs = [
  {
    q: "O H2 Linker garante o meu visto?",
    a: "Não. Somos uma plataforma de automação e conexão. O visto depende do patrocínio do empregador e da aprovação do consulado americano. Nossa ferramenta aumenta suas chances ao te colocar na frente de milhares de vagas antes da concorrência.",
  },
  {
    q: "O que é o 'Early Access'?",
    a: "É o nosso maior diferencial. Nosso radar monitora o banco de dados do governo (DOL) e identifica vagas no momento em que o 'Notice of Acceptance' (NOA) é emitido. Isso permite que você aplique enquanto a vaga ainda está 'quente', muitas vezes antes mesmo de ser publicada em sites comuns.",
  },
  {
    q: "É seguro conectar meu e-mail?",
    a: "Totalmente. O sistema utiliza a tecnologia de 'Senha de App', o que significa que nunca temos acesso à sua senha real. Você pode revogar o acesso a qualquer momento nas configurações da sua conta Google ou Outlook.",
  },
  {
    q: "Como funciona o limite de envios?",
    a: "Para proteger a reputação do seu e-mail, o sistema utiliza um 'Aquecimento Inteligente'. Começamos com um limite menor e aumentamos gradualmente. Você também ganha mais envios diários ao indicar amigos para a plataforma.",
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: ${font.body}; background: ${C.white}; color: ${C.ink}; }
        .btn-primary:hover { background: ${C.orangeHover} !important; }
        .btn-secondary:hover { background: ${C.navy} !important; color: ${C.white} !important; }
        .faq-item:hover { background: ${C.ghost} !important; }
      `}</style>

      <div style={{ minHeight: "100vh" }}>
        {/* NAV */}
        <nav style={{ sticky: "top", borderBottom: `1px solid ${C.border}`, background: C.white, zIndex: 100 }}>
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              padding: "0 24px",
              height: 72,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <BrandWordmark height={34} />
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <LanguageSwitcher value={i18n.language as SupportedLanguage} onChange={(l) => i18n.changeLanguage(l)} />
              <button
                onClick={() => navigate("/auth")}
                style={{
                  background: C.navy,
                  color: C.white,
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Entrar
              </button>
            </div>
          </div>
        </nav>

        {/* HERO SECTION */}
        <section
          style={{
            padding: "100px 24px",
            textAlign: "center",
            background: `linear-gradient(180deg, ${C.ghost} 0%, ${C.white} 100%)`,
          }}
        >
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div
              style={{
                background: "#D4500A15",
                color: C.orange,
                padding: "6px 16px",
                borderRadius: 100,
                display: "inline-block",
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 24,
                letterSpacing: "0.05em",
              }}
            >
              AGORA COM +10.000 VAGAS ATIVAS
            </div>
            <h1
              style={{
                fontSize: "clamp(40px, 8vw, 64px)",
                fontWeight: 800,
                lineHeight: 1.1,
                marginBottom: 24,
                color: C.navy,
              }}
            >
              Sua jornada para os EUA <br /> <span style={{ color: C.orange }}>automatizada e inteligente.</span>
            </h1>
            <p style={{ fontSize: 19, color: C.inkMid, marginBottom: 40, maxWidth: 650, margin: "0 auto 40px" }}>
              Acesse vagas H-2A e H-2B no momento em que são aprovadas. Envie centenas de candidaturas personalizadas
              com rastreamento real.
            </p>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                className="btn-primary"
                onClick={() => navigate("/auth")}
                style={{
                  background: C.orange,
                  color: C.white,
                  border: "none",
                  padding: "16px 32px",
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                Começar agora <ArrowRight size={20} />
              </button>
              <button
                className="btn-secondary"
                style={{
                  background: "transparent",
                  border: `2px solid ${C.navy}`,
                  padding: "16px 32px",
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Ver Vitrine de Vagas
              </button>
            </div>
          </div>
        </section>

        {/* VITRINE DE VAGAS */}
        <section style={{ padding: "80px 24px", background: C.white }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <h2 style={{ fontSize: 32, fontWeight: 800, color: C.navy, marginBottom: 12 }}>Vagas de Hoje no Hub</h2>
              <p style={{ color: C.inkMid }}>Exemplos reais de oportunidades disponíveis agora para candidatura.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
              <JobCard type="H-2B" title="Concrete Finisher" location="Morgantown, WV" salary="$24.50/h" />
              <JobCard type="H-2B" title="Landscape Laborer" location="Austin, TX" salary="$18.00/h" />
              <JobCard type="H-2B" title="Resort Housekeeper" location="Mackinaw City, MI" salary="$15.50/h" />
              <JobCard type="H-2A" title="Farmworker (Berries)" location="Salinas, CA" salary="$16.00/h" />
              <JobCard type="H-2A" title="Equipment Operator" location="Des Moines, IA" salary="$19.50/h" />
              <JobCard type="H-2A" title="Apple Harvester" location="Yakima, WA" salary="$17.20/h" />
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section style={{ padding: "100px 24px", background: C.ghost }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <h2 style={{ textAlign: "center", fontSize: 36, fontWeight: 800, marginBottom: 60 }}>
              O Sistema H2 Linker
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 40 }}>
              {steps.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 20 }}>
                  <div
                    style={{
                      background: C.white,
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      border: `1px solid ${C.border}`,
                    }}
                  >
                    <s.icon size={24} color={C.orange} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{s.title}</h3>
                    <p style={{ color: C.inkMid, fontSize: 15, lineHeight: 1.6 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section style={{ padding: "100px 24px" }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <h2 style={{ textAlign: "center", fontSize: 36, fontWeight: 800, marginBottom: 48 }}>Dúvidas Frequentes</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {faqs.map((f, i) => (
                <div
                  key={i}
                  className="faq-item"
                  style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", cursor: "pointer" }}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <div
                    style={{
                      padding: "20px 24px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontWeight: 600,
                    }}
                  >
                    {f.q}{" "}
                    <ChevronDown
                      size={20}
                      style={{ transform: openFaq === i ? "rotate(180deg)" : "none", transition: "0.2s" }}
                    />
                  </div>
                  {openFaq === i && (
                    <div style={{ padding: "0 24px 20px", color: C.inkMid, fontSize: 15, lineHeight: 1.6 }}>{f.a}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TESTIMONIALS (PREVISTO) */}
        {/* <section style={{ padding: "100px 24px", background: C.navy, color: C.white }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", textAlign: 'center' }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 48 }}>Quem já usa o H2 Linker</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
               Cards de depoimentos aqui no futuro 
            </div>
          </div>
        </section> 
        */}

        {/* FOOTER */}
        <footer style={{ borderTop: `1px solid ${C.border}`, padding: "48px 24px", textAlign: "center" }}>
          <BrandWordmark height={30} />
          <p style={{ marginTop: 16, color: C.inkLight, fontSize: 14 }}>
            © 2026 H2 Linker. Smart Seasonal Connections.
          </p>
        </footer>
      </div>
    </>
  );
}
