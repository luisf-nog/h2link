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
  MapPin,
  DollarSign,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

// ─── Design System Refinado ────────────────────────────────────────────────
const Theme = {
  white: "#FFFFFF",
  bg: "#F8FAFC", // Ghost Grey suave para contraste
  navy: "#0F172A", // Navy Profissional (Tailwind Slate 900)
  slate: "#475569", // Texto secundário
  border: "#E2E8F0", // Bordas finas
  orange: "#EA580C", // Laranja vibrante (apenas para ação principal)
  h2a: "#059669", // Verde Esmeralda (Agricultura)
  h2b: "#2563EB", // Azul Royal (Serviços/Construção)
  early: "#7C3AED", // Violeta (Early Access / Radar)
};

// ─── Componentes de Interface ──────────────────────────────────────────────
const Badge = ({ children, color }: any) => (
  <span
    style={{
      padding: "4px 10px",
      borderRadius: "6px",
      fontSize: "11px",
      fontWeight: 700,
      background: `${color}15`,
      color: color,
      textTransform: "uppercase",
      letterSpacing: "0.02em",
      border: `1px solid ${color}30`,
    }}
  >
    {children}
  </span>
);

const JobCard = ({ type, title, location, salary, isEarly }: any) => (
  <div
    style={{
      background: Theme.white,
      padding: "24px",
      borderRadius: "12px",
      border: `1px solid ${Theme.border}`,
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      transition: "transform 0.2s, box-shadow 0.2s",
      cursor: "default",
    }}
    className="job-card"
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Badge color={type === "H-2A" ? Theme.h2a : Theme.h2b}>{type}</Badge>
      {isEarly && (
        <div
          style={{ color: Theme.early, display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600 }}
        >
          <Sparkles size={14} /> Early Access
        </div>
      )}
    </div>
    <div>
      <h4 style={{ fontSize: "17px", fontWeight: 700, color: Theme.navy, marginBottom: "4px" }}>{title}</h4>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "14px", color: Theme.slate }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <MapPin size={14} /> {location}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <DollarSign size={14} /> {salary}
        </span>
      </div>
    </div>
  </div>
);

export default function Landing() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: ${Theme.white}; color: ${Theme.navy}; -webkit-font-smoothing: antialiased; }
        .job-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px -10px rgba(0,0,0,0.05); border-color: ${Theme.slate}40; }
        .btn-cta:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .faq-item:hover { border-color: ${Theme.orange}50 !important; }
      `}</style>

      {/* NAV */}
      <nav
        style={{
          borderBottom: `1px solid ${Theme.border}`,
          background: Theme.white,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 24px",
            height: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <BrandWordmark height={32} />
          <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
            <div style={{ display: "flex", gap: "24px", fontSize: "14px", fontWeight: 500, color: Theme.slate }}>
              <a href="#jobs" style={{ textDecoration: "none", color: "inherit" }}>
                Vagas
              </a>
              <a href="#how" style={{ textDecoration: "none", color: "inherit" }}>
                Como Funciona
              </a>
              <a href="#faq" style={{ textDecoration: "none", color: "inherit" }}>
                Dúvidas
              </a>
            </div>
            <LanguageSwitcher value={i18n.language as SupportedLanguage} onChange={(l) => i18n.changeLanguage(l)} />
            <button
              onClick={() => navigate("/auth")}
              style={{
                background: Theme.navy,
                color: Theme.white,
                border: "none",
                padding: "12px 24px",
                borderRadius: "8px",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "14px",
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
          padding: "120px 24px 80px",
          textAlign: "center",
          background: `radial-gradient(circle at top, ${Theme.bg} 0%, ${Theme.white} 100%)`,
        }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: Theme.white,
              border: `1px solid ${Theme.border}`,
              padding: "8px 16px",
              borderRadius: "100px",
              fontSize: "13px",
              fontWeight: 600,
              marginBottom: "32px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
            }}
          >
            <span style={{ color: Theme.orange }}>●</span> Agora com +10.000 vagas processadas
          </div>
          <h1
            style={{
              fontSize: "clamp(48px, 6vw, 72px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              marginBottom: "24px",
              color: Theme.navy,
            }}
          >
            Candidaturas inteligentes para <br />{" "}
            <span style={{ color: Theme.navy, opacity: 0.6 }}>trabalho sazonal nos EUA.</span>
          </h1>
          <p
            style={{
              fontSize: "20px",
              color: Theme.slate,
              marginBottom: "48px",
              maxWidth: "680px",
              margin: "0 auto 48px",
              lineHeight: 1.6,
            }}
          >
            Pare de perder tempo com envios manuais. O H2 Linker conecta você a empregadores H-2A e H-2B através de
            tecnologia de radar e automação.
          </p>
          <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
            <button
              className="btn-cta"
              onClick={() => navigate("/auth")}
              style={{
                background: Theme.orange,
                color: Theme.white,
                border: "none",
                padding: "18px 36px",
                borderRadius: "10px",
                fontSize: "16px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                transition: "all 0.2s",
              }}
            >
              Criar Conta Grátis <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </section>

      {/* VITRINE DE VAGAS */}
      <section id="jobs" style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "48px" }}
          >
            <div>
              <h2 style={{ fontSize: "32px", fontWeight: 800, color: Theme.navy, marginBottom: "8px" }}>
                Vitrine de Vagas
              </h2>
              <p style={{ color: Theme.slate }}>Oportunidades reais extraídas diretamente do banco de dados do DOL.</p>
            </div>
            <button
              style={{
                color: Theme.navy,
                fontWeight: 600,
                background: "none",
                border: "none",
                cursor: "pointer",
                borderBottom: `2px solid ${Theme.navy}`,
              }}
            >
              Ver todas as 10k vagas
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "24px" }}>
            <JobCard type="H-2B" title="Concrete Finisher" location="Morgantown, WV" salary="$24.50/h" />
            <JobCard type="H-2B" title="Landscape Laborer" location="Austin, TX" salary="$18.00/h" />
            <JobCard
              type="H-2B"
              title="Resort Housekeeper"
              location="Mackinaw City, MI"
              salary="$15.50/h"
              isEarly={true}
            />
            <JobCard type="H-2A" title="Farmworker (Berries)" location="Salinas, CA" salary="$16.00/h" />
            <JobCard
              type="H-2A"
              title="Equipment Operator"
              location="Des Moines, IA"
              salary="$19.50/h"
              isEarly={true}
            />
            <JobCard type="H-2A" title="Apple Harvester" location="Yakima, WA" salary="$17.20/h" />
          </div>
        </div>
      </section>

      {/* EARLY ACCESS HIGHLIGHT */}
      <section style={{ padding: "80px 24px", background: Theme.navy, color: Theme.white }}>
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "80px",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                color: Theme.early,
                fontWeight: 700,
                fontSize: "14px",
                textTransform: "uppercase",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Radar size={20} /> Exclusivo: Early Access
            </div>
            <h2 style={{ fontSize: "40px", fontWeight: 800, marginBottom: "24px", lineHeight: 1.1 }}>
              Chegue antes de <br /> todo mundo.
            </h2>
            <p style={{ fontSize: "18px", color: "#94A3B8", lineHeight: 1.6, marginBottom: "32px" }}>
              Nosso sistema monitora os pedidos de visto em tempo real. Quando um empregador recebe o "Notice of
              Acceptance", o radar te avisa. Isso permite que você aplique semanas antes da vaga ser postada em sites
              comuns.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              <div>
                <h4 style={{ color: Theme.white, marginBottom: "8px" }}>Monitoramento 24/7</h4>
                <p style={{ fontSize: "14px", color: "#64748B" }}>Varredura constante no banco de dados do DOL.</p>
              </div>
              <div>
                <h4 style={{ color: Theme.white, marginBottom: "8px" }}>Fila Inteligente</h4>
                <p style={{ fontSize: "14px", color: "#64748B" }}>Vagas Early Access entram no topo da sua lista.</p>
              </div>
            </div>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              borderRadius: "24px",
              padding: "40px",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {/* Aqui iria um gráfico ou print do radar simplificado */}
            <div style={{ textAlign: "center", color: "#94A3B8" }}>[ Preview do Radar de Vagas ]</div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{ padding: "100px 24px", background: Theme.bg }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "36px", fontWeight: 800, marginBottom: "64px" }}>
            Como o H2 Linker funciona
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "48px" }}>
            {[
              {
                icon: Upload,
                title: "Perfil e Currículo",
                desc: "Seu currículo é processado pela nossa IA para garantir que cada aplicação seja única.",
              },
              {
                icon: Mail,
                title: "Conexão de E-mail",
                desc: "Integração segura via 'Senha de App'. Você mantém 100% do controle dos envios.",
              },
              {
                icon: Zap,
                title: "Automação",
                desc: "O sistema gera o assunto e o corpo do e-mail ideal para cada tipo de vaga.",
              },
              {
                icon: Eye,
                title: "Rastreamento",
                desc: "Saiba no minuto exato quando o recrutador abriu seu e-mail ou viu seu currículo.",
              },
              {
                icon: Shield,
                title: "Proteção Anti-Spam",
                desc: "Envios randomizados e aquecimento de conta para garantir que sua mensagem chegue na caixa de entrada.",
              },
              {
                icon: BarChart3,
                title: "Dashboard",
                desc: "Gerencie milhares de candidaturas em uma única tela organizada.",
              },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    background: Theme.white,
                    borderRadius: "16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 20px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                    border: `1px solid ${Theme.border}`,
                  }}
                >
                  <s.icon size={24} color={Theme.navy} />
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "12px" }}>{s.title}</h3>
                <p style={{ color: Theme.slate, fontSize: "15px", lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "36px", fontWeight: 800, marginBottom: "48px" }}>
            Perguntas Frequentes
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              {
                q: "O H2 Linker garante meu visto?",
                a: "Não. O visto é uma decisão consular. Nós somos a ferramenta de conexão que garante que você seja visto pelos patrões certos, no momento certo, com a melhor apresentação possível.",
              },
              {
                q: "Preciso ter experiência nos EUA?",
                a: "Não. Nossos templates são otimizados para quem está aplicando pela primeira vez, focando em atitude, aprendizado rápido e transparência sobre a localização.",
              },
              {
                q: "Qual a diferença entre H-2A e H-2B?",
                a: "H-2A é destinado ao setor agrícola (fazendas, colheitas). H-2B é para setores não-agrícolas (construção, hotéis, resorts, paisagismo).",
              },
              {
                q: "Como o sistema protege meu e-mail?",
                a: "Usamos intervalos humanos entre os envios (não disparamos tudo de uma vez) e técnica de 'pixel blindado' que ignora robôs de antivírus, protegendo sua reputação de remetente.",
              },
            ].map((f, i) => (
              <div
                key={i}
                className="faq-item"
                style={{
                  border: `1px solid ${Theme.border}`,
                  borderRadius: "12px",
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div
                  style={{
                    padding: "24px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontWeight: 700,
                    fontSize: "16px",
                  }}
                >
                  {f.q}{" "}
                  <ChevronDown
                    size={20}
                    style={{
                      transform: openFaq === i ? "rotate(180deg)" : "none",
                      transition: "0.2s",
                      color: Theme.slate,
                    }}
                  />
                </div>
                {openFaq === i && (
                  <div style={{ padding: "0 24px 24px", color: Theme.slate, fontSize: "15px", lineHeight: 1.6 }}>
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          borderTop: `1px solid ${Theme.border}`,
          padding: "64px 24px",
          textAlign: "center",
          background: Theme.bg,
        }}
      >
        <BrandWordmark height={28} />
        <div
          style={{
            marginTop: "24px",
            display: "flex",
            justifyContent: "center",
            gap: "24px",
            fontSize: "14px",
            color: Theme.slate,
          }}
        >
          <a href="#">Termos</a>
          <a href="#">Privacidade</a>
          <a href="#">Suporte</a>
        </div>
        <p style={{ marginTop: "32px", color: Theme.slate, fontSize: "13px" }}>
          © 2026 H2 Linker. Smart Seasonal Connections.
        </p>
      </footer>
    </>
  );
}
