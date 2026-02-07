import { Helmet } from "react-helmet-async";

interface JobMetaTagsProps {
  job: {
    id: string;
    job_title: string;
    company: string;
    city: string;
    state: string;
    visa_type: string | null;
    salary: number | null;
    wage_unit?: string | null;
  } | null;
}

export function JobMetaTags({ job }: JobMetaTagsProps) {
  // Se não tiver vaga carregada, não renderiza nada (deixa o padrão do index.html)
  if (!job) return null;

  const title = `Vaga: ${job.job_title}`;

  // Descrição Otimizada para WhatsApp (Curta e Direta)
  const salaryText = job.salary ? `$${job.salary.toFixed(2)}/${job.wage_unit || "h"}` : "Salário a combinar";
  const location = `${job.city}, ${job.state}`;
  const visa = job.visa_type || "H-2B";

  // O WhatsApp mostra cerca de 2 linhas de descrição. Vamos priorizar o que importa.
  const description = `${job.company} • ${location}\n💰 ${salaryText} • 🛂 ${visa}`;

  // URL da Imagem (Use uma imagem fixa e confiável para garantir que apareça)
  // Se você tiver uma imagem dinâmica por vaga, coloque aqui. Se não, use a logo.
  const imageUrl = "https://h2linker.com/og-share-job.png";

  // URL canônica (importante ser a URL real da página)
  const url = window.location.href;

  return (
    <Helmet>
      {/* Título: O que aparece em negrito */}
      <title>{title}</title>
      <meta property="og:title" content={title} />
      <meta name="twitter:title" content={title} />

      {/* Descrição: O texto pequeno embaixo */}
      <meta name="description" content={description} />
      <meta property="og:description" content={description} />
      <meta name="twitter:description" content={description} />

      {/* Imagem: O quadrado ao lado */}
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:card" content="summary_large_image" />

      {/* URL Base */}
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
    </Helmet>
  );
}
