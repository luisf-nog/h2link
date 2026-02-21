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
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Eye,
  Radar,
  Users,
} from "lucide-react";

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

  const steps = [
    {
      icon: Upload,
      title: "Importe seu currículo",
      desc: "Faça upload do seu currículo em PDF ou Word. Nosso sistema extrai automaticamente seus dados para personalizar cada candidatura.",
      color: "hsl(var(--ring))",
    },
    {
      icon: Mail,
      title: "Configure seu email (SMTP)",
      desc: 'Conecte seu Gmail ou Outlook com uma "Senha de App" segura. Seus emails são enviados direto da sua caixa de saída, sem intermediários.',
      color: "hsl(var(--success))",
    },
    {
      icon: FileText,
      title: "Personalize seus templates",
      desc: "Crie ou use templates de email prontos. Nossa IA gera assuntos e corpos personalizados para cada vaga automaticamente.",
      color: "hsl(var(--plan-diamond))",
    },
    {
      icon: Search,
      title: "Navegue pelas vagas H-2A/H-2B",
      desc: "Acesse centenas de vagas atualizadas diariamente direto do DOL. Filtre por estado, salário, categoria e tipo de visto.",
      color: "hsl(var(--warning))",
    },
    {
      icon: Send,
      title: "Adicione à fila e envie",
      desc: "Selecione as vagas que interessam, adicione à sua fila e envie candidaturas em massa com um clique — tudo automatizado.",
      color: "hsl(var(--destructive))",
    },
    {
      icon: BarChart3,
      title: "Acompanhe seus resultados",
      desc: "Veja quem abriu seu email, quem visualizou seu currículo e quantas vezes. Dados reais para ajustar sua estratégia.",
      color: "hsl(var(--ring))",
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
      desc: "Geração automática de emails únicos para cada vaga, evitando filtros de spam e aumentando respostas.",
    },
    {
      icon: Eye,
      title: "Rastreamento avançado",
      desc: "Spy pixel inteligente que filtra scanners de antivírus e mostra apenas aberturas genuínas do empregador.",
    },
    {
      icon: Radar,
      title: "Radar de vagas",
      desc: "Configure filtros e receba novas vagas automaticamente na sua fila, sem precisar buscar manualmente.",
    },
    {
      icon: Clock,
      title: "Envio com delay anti-spam",
      desc: "Intervalos randomizados entre envios para simular comportamento humano e proteger sua conta.",
    },
    {
      icon: Users,
      title: "Programa de indicações",
      desc: "Indique amigos e ganhe créditos extras de envio. Quanto mais indicações ativas, mais emails por dia.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(215,78%,8%)] via-[hsl(215,60%,12%)] to-[hsl(222,47%,11%)] text-[hsl(var(--primary-foreground))]">
      {/* NAV */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[hsl(215,78%,8%)]/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <BrandWordmark height={36} className="[&_span]:text-white [&_span_.text-primary]:text-[hsl(var(--ring))]" />
          <div className="flex items-center gap-3">
            <LanguageSwitcher
              value={isSupportedLanguage(i18n.language) ? i18n.language : "pt"}
              onChange={handleChangeLanguage}
            />
            {user ? (
              <Button
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="bg-[hsl(var(--ring))] text-white hover:bg-[hsl(var(--ring))]/90"
              >
                Dashboard
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={goToAuth}
                className="bg-[hsl(var(--ring))] text-white hover:bg-[hsl(var(--ring))]/90"
              >
                Entrar / Criar Conta
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden px-4 pb-16 pt-20 sm:px-6 lg:pb-24 lg:pt-28">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-[hsl(var(--ring))]/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-[hsl(var(--plan-diamond))]/8 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-white/70">
            <Zap className="h-4 w-4 text-[hsl(var(--ring))]" />
            Plataforma #1 para candidaturas H-2A e H-2B
          </div>

          <h1 className="font-brand text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Automatize suas candidaturas{" "}
            <span className="bg-gradient-to-r from-[hsl(var(--ring))] to-[hsl(var(--plan-diamond))] bg-clip-text text-transparent">
              H-2A & H-2B
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/60 sm:text-xl">
            Pare de enviar emails um por um. O H2 Linker conecta você a empregadores
            verificados dos EUA com candidaturas personalizadas e rastreamento em tempo real.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              onClick={goToAuth}
              className="bg-[hsl(var(--ring))] px-8 text-base font-semibold text-white hover:bg-[hsl(var(--ring))]/90"
            >
              Comece Grátis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={goToJobs}
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Search className="mr-2 h-5 w-5" />
              Explorar Vagas
            </Button>
          </div>

          <div className="mx-auto mt-12 grid max-w-lg grid-cols-3 gap-6 text-center">
            {[
              { value: "500+", label: "Vagas ativas" },
              { value: "24h", label: "Atualização diária" },
              { value: "100%", label: "Grátis para começar" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-bold text-[hsl(var(--ring))]">{s.value}</div>
                <div className="mt-1 text-xs text-white/50">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative border-t border-white/5 bg-white/[0.02] px-4 py-20 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="font-brand text-3xl font-bold sm:text-4xl">
              Como funciona?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-white/50">
              Em 6 passos simples, você sai do zero para enviar dezenas de candidaturas personalizadas por dia.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((step, i) => (
              <div
                key={step.title}
                className="group relative rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${step.color}20` }}
                  >
                    <step.icon className="h-5 w-5" style={{ color: step.color }} />
                  </div>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/60">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">{step.title}</h3>
                <p className="text-sm leading-relaxed text-white/50">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-4 py-20 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="font-brand text-3xl font-bold sm:text-4xl">
              Recursos que fazem a diferença
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-white/50">
              Ferramentas profissionais para maximizar suas chances de conseguir uma vaga nos EUA.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-white/20 hover:bg-white/[0.06]"
              >
                <f.icon className="mb-3 h-6 w-6 text-[hsl(var(--ring))]" />
                <h3 className="mb-2 font-semibold text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed text-white/50">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHAT YOU'LL NEED */}
      <section className="border-t border-white/5 bg-white/[0.02] px-4 py-20 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <h2 className="font-brand text-3xl font-bold sm:text-4xl">
              O que você precisa para começar
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/50">
              Tudo que você precisa ter em mãos antes de criar sua conta.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                title: "Um currículo em PDF ou Word",
                desc: "Seu currículo atualizado para que o sistema personalize cada candidatura.",
              },
              {
                title: "Uma conta Gmail ou Outlook",
                desc: "Os emails saem da SUA caixa de saída. Você mantém controle total.",
              },
              {
                title: 'A "Senha de App" do seu email',
                desc: "Uma senha especial (não a sua senha normal) que autoriza o envio de emails pelo sistema. Tem tutorial dentro do app.",
              },
              {
                title: "Disposição para revisar e enviar",
                desc: "Você escolhe as vagas, monta a fila e controla quando enviar. Nada é enviado sem seu comando.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--success))]" />
                <div>
                  <h4 className="font-semibold text-white">{item.title}</h4>
                  <p className="mt-1 text-sm text-white/50">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-4 py-20 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-brand text-3xl font-bold sm:text-4xl">
            Pronto para começar?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/50">
            Crie sua conta gratuita em menos de 2 minutos e comece a enviar candidaturas profissionais hoje mesmo.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              onClick={goToAuth}
              className="bg-[hsl(var(--ring))] px-8 text-base font-semibold text-white hover:bg-[hsl(var(--ring))]/90"
            >
              Criar Conta Grátis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={goToJobs}
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              Ver Vagas Disponíveis
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <BrandWordmark height={28} className="[&_span]:text-white/60 [&_span_.text-primary]:text-[hsl(var(--ring))]/60" />
          <p className="text-sm text-white/30">
            © {new Date().getFullYear()} H2 Linker. Smart connections. Real opportunities.
          </p>
        </div>
      </footer>
    </div>
  );
}
