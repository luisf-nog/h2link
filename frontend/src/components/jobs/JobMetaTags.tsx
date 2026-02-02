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
  };
}

export function JobMetaTags({ job }: JobMetaTagsProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language;
  
  // Build structured title and description
  const visaType = job.visa_type || 'H-2B';
  const title = `${visaType}: ${job.job_title} - ${job.company}`;
  
  // Build rich description
  const salaryText = job.salary 
    ? locale === 'en' 
      ? `$${job.salary.toFixed(2)}/hr` 
      : `$${job.salary.toFixed(2)}/hora`
    : '';
  
  const locationText = `${job.city}, ${job.state}`;
  
  const descriptionParts = [
    locale === 'en' ? 'Job opportunity' : 'Oportunidade de trabalho',
    visaType,
    locationText
  ];
  
  if (salaryText) {
    descriptionParts.push(salaryText);
  }
  
  if (job.start_date) {
    const startDate = new Date(job.start_date);
    const formattedDate = startDate.toLocaleDateString(locale);
    descriptionParts.push(
      locale === 'en' 
        ? `Starts: ${formattedDate}` 
        : `Início: ${formattedDate}`
    );
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