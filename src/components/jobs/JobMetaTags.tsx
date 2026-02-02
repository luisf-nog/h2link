import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';

interface JobMetaTagsProps {
  job: {
    id: string;
    job_title: string;
    company: string;
    city: string;
    state: string;
    visa_type: string | null;
    salary: number | null;
    start_date: string | null;
    end_date?: string | null;
    openings?: number | null;
    weekly_hours?: number | null;
    experience_months?: number | null;
    category?: string | null;
    housing_info?: string | null;
    transport_provided?: boolean | null;
    tools_provided?: boolean | null;
  };
}

export function JobMetaTags({ job }: JobMetaTagsProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language;
  
  // Build structured title and description
  const visaType = job.visa_type || 'H-2B';
  const title = `${visaType}: ${job.job_title} - ${job.company}`;
  
  // Build rich description with more details
  const salaryText = job.salary 
    ? locale === 'en' 
      ? `$${job.salary.toFixed(2)}/hr` 
      : locale === 'es'
      ? `$${job.salary.toFixed(2)}/hora`
      : `$${job.salary.toFixed(2)}/hora`
    : '';
  
  const locationText = `${job.city}, ${job.state}`;
  
  const descriptionParts = [];
  
  // Opening line with category if available
  if (job.category) {
    descriptionParts.push(
      locale === 'en' 
        ? `${job.category} position` 
        : locale === 'es'
        ? `Puesto de ${job.category}`
        : `Vaga de ${job.category}`
    );
  } else {
    descriptionParts.push(
      locale === 'en' ? 'Job opportunity' : locale === 'es' ? 'Oportunidad de empleo' : 'Oportunidade de trabalho'
    );
  }
  
  // Add visa type
  descriptionParts.push(visaType);
  
  // Location
  descriptionParts.push(locationText);
  
  // Openings
  if (job.openings && job.openings > 1) {
    descriptionParts.push(
      locale === 'en' 
        ? `${job.openings} openings` 
        : locale === 'es'
        ? `${job.openings} vacantes`
        : `${job.openings} vagas`
    );
  }
  
  // Salary
  if (salaryText) {
    descriptionParts.push(salaryText);
  }
  
  // Weekly hours
  if (job.weekly_hours) {
    descriptionParts.push(
      locale === 'en' 
        ? `${job.weekly_hours}h/week` 
        : locale === 'es'
        ? `${job.weekly_hours}h/semana`
        : `${job.weekly_hours}h/semana`
    );
  }
  
  // Start date
  if (job.start_date) {
    const startDate = new Date(job.start_date);
    const formattedDate = startDate.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
    descriptionParts.push(
      locale === 'en' 
        ? `Start: ${formattedDate}` 
        : locale === 'es'
        ? `Inicio: ${formattedDate}`
        : `Início: ${formattedDate}`
    );
  }
  
  // Duration (if end date available)
  if (job.start_date && job.end_date) {
    const start = new Date(job.start_date);
    const end = new Date(job.end_date);
    const months = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (months > 0) {
      descriptionParts.push(
        locale === 'en' 
          ? `${months} months` 
          : locale === 'es'
          ? `${months} meses`
          : `${months} meses`
      );
    }
  }
  
  // Benefits
  const benefits = [];
  if (job.housing_info) benefits.push(locale === 'en' ? 'Housing' : locale === 'es' ? 'Vivienda' : 'Moradia');
  if (job.transport_provided) benefits.push(locale === 'en' ? 'Transport' : locale === 'es' ? 'Transporte' : 'Transporte');
  if (job.tools_provided) benefits.push(locale === 'en' ? 'Tools' : locale === 'es' ? 'Herramientas' : 'Ferramentas');
  
  if (benefits.length > 0) {
    descriptionParts.push(benefits.join(', '));
  }
  
  // Experience
  if (job.experience_months) {
    const expText = job.experience_months === 1 
      ? (locale === 'en' ? '1 month exp' : locale === 'es' ? '1 mes exp' : '1 mês exp')
      : locale === 'en' 
        ? `${job.experience_months} months exp` 
        : locale === 'es'
        ? `${job.experience_months} meses exp`
        : `${job.experience_months} meses exp`;
    descriptionParts.push(expText);
  }
  
  const description = descriptionParts.join(' • ');
  
  // URL for sharing
  const shareUrl = `${window.location.origin}/job/${job.id}`;
  
  // Logo URL - using the H2 Linker logo
  const logoUrl = 'https://storage.googleapis.com/gpt-engineer-file-uploads/qLZbvqI1JJV7s7qLCqiN2u0iNM93/uploads/1769111120896-Gemini_Generated_Image_yeubloyeubloyeub.png';
  
  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title} | H2 Linker</title>
      <meta name="description" content={description} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content="article" />
      <meta property="og:url" content={shareUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={logoUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="H2 Linker" />
      <meta property="og:locale" content={locale === 'pt' ? 'pt_BR' : locale === 'es' ? 'es_ES' : 'en_US'} />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={shareUrl} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={logoUrl} />
      
      {/* WhatsApp specific (uses Open Graph) */}
      <meta property="og:image:alt" content={`${job.job_title} at ${job.company}`} />
      
      {/* Additional SEO */}
      <meta name="keywords" content={`${visaType}, H2 visa, ${job.job_title}, ${job.company}, ${job.city}, ${job.state}, work visa, employment`} />
      <link rel="canonical" content={shareUrl} />
    </Helmet>
  );
}