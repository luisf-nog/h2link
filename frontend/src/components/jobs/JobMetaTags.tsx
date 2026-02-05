import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { getJobShareUrl } from '@/lib/shareUtils';

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
  };
}

export function JobMetaTags({ job }: JobMetaTagsProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language;
  
  // Build structured title and description
  const visaType = job.visa_type || 'H-2B';
  const title = `${job.job_title} - ${job.company} | ${visaType}`;
  
  // Build rich description with key information
  const descriptionParts: string[] = [];
  
  // Line 1: Company and Location
  descriptionParts.push(`🏢 ${job.company} | 📍 ${job.city}, ${job.state}`);
  
  // Line 2: Openings and Salary
  const line2Parts: string[] = [];
  if (job.openings) {
    line2Parts.push(`💼 ${job.openings} ${locale === 'pt' ? 'vagas' : locale === 'es' ? 'vacantes' : 'openings'}`);
  }
  if (job.salary) {
    const salaryText = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(job.salary);
    line2Parts.push(`💰 ${salaryText}/h`);
  }
  if (line2Parts.length > 0) {
    descriptionParts.push(line2Parts.join(' | '));
  }
  
  // Line 3: Dates
  if (job.start_date && job.end_date) {
    try {
      const startDate = new Date(job.start_date);
      const endDate = new Date(job.end_date);
      const startFormatted = startDate.toLocaleDateString(locale, { month: '2-digit', day: '2-digit' });
      const endFormatted = endDate.toLocaleDateString(locale, { month: '2-digit', day: '2-digit', year: 'numeric' });
      descriptionParts.push(`📅 ${startFormatted} - ${endFormatted}`);
    } catch {
      // Skip if dates are invalid
    }
  }
  
  // Line 4: Job title and visa type
  descriptionParts.push(`${job.job_title} - ${visaType}`);
  
  const description = descriptionParts.join('\n');
  
  // URL for sharing - always use production domain
  const shareUrl = getJobShareUrl(job.id);
  
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