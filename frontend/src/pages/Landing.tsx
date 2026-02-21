import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { isSupportedLanguage, type SupportedLanguage } from "@/i18n";
import {
  Upload,
  Mail,
  Send,
  BarChart3,
  Shield,
  Zap,
  ArrowRight,
  MapPin,
  DollarSign,
  ChevronDown,
  Sparkles,
  Search,
} from "lucide-react";
import { useState } from "react";

// ─── Design System (SaaS Minimalista) ───────────────────────────────────────
const Theme = {
  white: "#FFFFFF",
  bg: "#FFFFFF",
  navy: "#020617", // Quase preto (Slate 950)
  slate: "#64748B", // Texto de suporte
  border: "#E2E8F0", // Borda fina e elegante
  orange: "#D4500A", // Laranja da marca (uso cirúrgico)
  h2a: "#059669",
  h2b: "#2563EB",
  early: "#7C3AED",
};

// ─── Componentes Refinados ──────────────────────────────────────────────────
const JobCard = ({ type, title, location, salary, isEarly }: any) => {
  // Regra: Early Access somente para H-2A
  const showEarly = isEarly && type === "H-2A";

  return (
    <div
      style={{
        padding: "20px",
        border: `1px solid ${Theme.border}`,
        borderRadius: "4px", // Cantos menos arredondados = mais profissional
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        transition: "border-color 0.2s",
      }}
      className="job-card"
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 800,
            color: type === "H-2A" ? Theme.h2a : Theme.h2b,
            letterSpacing: "0.05em",
          }}
        >
          {type}
        </span>
        {showEarly && (
          <div
            style={{
              color: Theme.early,
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            <Sparkles size={12} /> EARLY ACCESS
          </div>
        )}
      </div>
      <div>
        <h4 style={{ fontSize: "15px", fontWeight: 600, color: Theme.navy, marginBottom: "4px" }}>{title}</h4>
        <div style={{ display: "flex", gap: "12px", fontSize: "13px", color: Theme.slate }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <MapPin size={13} /> {location}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <DollarSign size={13} /> {salary}
          </span>
        </div>
      </div>
    </div>
  );
};

export default function Landing() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: ${Theme.white}; color: ${Theme.navy}; -webkit-font-smoothing: antialiased; }
        .job-card:hover { border-color: ${Theme.navy}; }
        .btn-main:hover { opacity: 0.9; transform: translateY(-1px); }
        .faq-trigger:hover { color: ${Theme.orange}; }
      `}</style>

      {/* NAV */}
      <nav style={{ borderBottom: `1px solid ${Theme.border}`, height: 72, display: "flex", alignItems: "center" }}>
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
          <BrandWordmark height={28} />
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            <LanguageSwitcher value={i18n.language as SupportedLanguage} onChange={(l) => i18n.changeLanguage(l)} />
            <button
              onClick={() => navigate("/auth")}
              style={{
                background: Theme.navy,
                color: Theme.white,
                border: "none",
                padding: "10px 18px",
                borderRadius: "4px",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              Entrar no Sistema
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding: "100px 24px 80px", textAlign: "center" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h1
            style={{
              fontSize: "clamp(40px, 5vw, 60px)",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
              marginBottom: "24px",
            }}
          >
            Conectando trabalhadores <br /> à próxima temporada nos EUA.
          </h1>
          <p
            style={{
              fontSize: "18px",
              color: Theme.slate,
              marginBottom: "40px",
              lineHeight: 1.6,
              maxWidth: 600,
              margin: "0 auto 40px",
            }}
          >
            A plataforma inteligente para gestão de candidaturas H-2A e H-2B. Acesse mais de 10.000 vagas processadas
            diretamente do banco de dados oficial.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
            <button
              className="btn-main"
              onClick={() => navigate("/auth")}
              style={{
                background: Theme.orange,
                color: Theme.white,
                border: "none",
                padding: "14px 28px",
                borderRadius: "4px",
                fontSize: "15px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s",
              }}
            >
              Criar conta gratuita <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* VITRINE DE VAGAS */}
      <section style={{ padding: "60px 24px", borderTop: `1px solid ${Theme.border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ marginBottom: "40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 700 }}>Oportunidades recentes</h2>
            <div style={{ fontSize: "13px", color: Theme.slate }}>Base de dados atualizada em tempo real</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
            {/* H-2B: Sem badge Early Access por regra do negócio */}
            <JobCard type="H-2B" title="Concrete Finisher" location="Morgantown, WV" salary="$24.50/h" isEarly={true} />
            <JobCard type="H-2B" title="Landscape Laborer" location="Austin, TX" salary="$18.00/h" isEarly={true} />
            <JobCard type="H-2B" title="Housekeeper" location="Mackinaw City, MI" salary="$15.50/h" />

            {/* H-2A: Pode ter badge Early Access */}
            <JobCard type="H-2A" title="Farmworker (Berries)" location="Salinas, CA" salary="$16.00/h" isEarly={true} />
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

      {/* FEATURES (GRID MAIS "SOFTWARE") */}
      <section style={{ padding: "80px 24px", background: "#fcfcfc", borderTop: `1px solid ${Theme.border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "40px" }}>
            {[
              {
                icon: Zap,
                title: "Radar de Vagas",
                desc: "Monitoramento constante do DOL para identificar novas aberturas no minuto que são aprovadas.",
              },
              {
                icon: Mail,
                title: "Envios Inteligentes",
                desc: "Automação de e-mails via Senha de App, garantindo que a mensagem saia da sua própria conta.",
              },
              {
                icon: BarChart3,
                title: "Rastreamento",
                desc: "Tecnologia de pixel blindado que mostra quando seu currículo foi realmente visualizado.",
              },
              {
                icon: Shield,
                title: "Segurança",
                desc: "Proteção contra spam e algoritmos que simulam o comportamento humano nos envios.",
              },
            ].map((f, i) => (
              <div key={i}>
                <f.icon size={20} color={Theme.orange} style={{ marginBottom: "16px" }} />
                <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px" }}>{f.title}</h3>
                <p style={{ fontSize: "14px", color: Theme.slate, lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "80px 24px", borderTop: `1px solid ${Theme.border}` }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "40px", textAlign: "center" }}>
            Perguntas Frequentes
          </h2>
          {/* FAQ ITEMS */}
          {[
            {
              q: "O que é o 'Early Access' nas vagas H-2A?",
              a: "É o acesso imediato às vagas que acabaram de receber o NOA (Notice of Acceptance). Como o processo H-2A é muito ágil, ser o primeiro a aplicar é crucial.",
            },
            {
              q: "Como o sistema acessa meu e-mail?",
              a: "Não acessamos sua senha. Você gera uma 'Senha de App' no Google ou Outlook que permite apenas o envio de mensagens. Você mantém o controle total.",
            },
            {
              q: "As vagas são reais?",
              a: "Sim, todos os dados são extraídos e processados diretamente dos arquivos oficiais do Department of Labor (DOL) dos EUA.",
            },
          ].map((item, i) => (
            <div key={i} style={{ borderBottom: `1px solid ${Theme.border}`, padding: "20px 0" }}>
              <div
                className="faq-trigger"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "15px",
                }}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                {item.q}{" "}
                <ChevronDown
                  size={18}
                  style={{ transform: openFaq === i ? "rotate(180deg)" : "none", transition: "0.2s" }}
                />
              </div>
              {openFaq === i && (
                <div style={{ marginTop: "12px", fontSize: "14px", color: Theme.slate, lineHeight: 1.6 }}>{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER LIMPO */}
      <footer style={{ padding: "60px 24px", borderTop: `1px solid ${Theme.border}`, textAlign: "center" }}>
        <BrandWordmark height={24} />
        <p style={{ marginTop: "20px", fontSize: "13px", color: Theme.slate, fontWeight: 500 }}>
          © 2025 H2 Linker. Smart connections. Real opportunities.
        </p>
      </footer>
    </>
  );
}
