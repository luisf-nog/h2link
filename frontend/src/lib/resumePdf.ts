import jsPDF from "jspdf";

export interface ResumeData {
  personal_info: {
    full_name: string;
    city_state_country: string;
    email: string;
    phone: string;
  };
  summary: string;
  skills: string[];
  experience: {
    title: string;
    company: string;
    location: string;
    dates: string;
    points: string[];
  }[];
  education: {
    degree: string;
    school: string;
    year: string;
  }[];
  languages: string[];
  work_authorization?: {
    visa_type?: string;
    current_location?: string;
    passport_status?: string;
    previous_h2_experience?: string;
    availability?: string;
    visa_denial_history?: string;
  };
}

export function generateResumePDF(data: ResumeData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginL = 54;
  const marginR = 54;
  const usable = pageW - marginL - marginR;
  let y = 54;

  const checkPage = (need: number) => {
    if (y + need > doc.internal.pageSize.getHeight() - 54) {
      doc.addPage();
      y = 54;
    }
  };

  // Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(data.personal_info.full_name || "Your Name", pageW / 2, y, { align: "center" });
  y += 22;

  // Contact line
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const contact = [data.personal_info.city_state_country, data.personal_info.email, data.personal_info.phone]
    .filter(Boolean)
    .join("  |  ");
  doc.text(contact, pageW / 2, y, { align: "center" });
  y += 20;

  // Divider
  const drawDivider = () => {
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(marginL, y, pageW - marginR, y);
    y += 12;
  };

  // Section header
  const sectionHeader = (title: string) => {
    checkPage(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title.toUpperCase(), marginL, y);
    y += 4;
    drawDivider();
  };

  // SUMMARY
  if (data.summary) {
    sectionHeader("Professional Summary");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(data.summary, usable);
    checkPage(lines.length * 14);
    doc.text(lines, marginL, y);
    y += lines.length * 14 + 8;
  }

  // SKILLS
  if (data.skills?.length) {
    sectionHeader("Skills");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const skillsText = data.skills.join("  •  ");
    const lines = doc.splitTextToSize(skillsText, usable);
    checkPage(lines.length * 14);
    doc.text(lines, marginL, y);
    y += lines.length * 14 + 8;
  }

  // EXPERIENCE
  if (data.experience?.length) {
    sectionHeader("Professional Experience");
    data.experience.forEach((exp) => {
      checkPage(50);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(exp.title || "", marginL, y);
      doc.setFont("helvetica", "normal");
      doc.text(exp.dates || "", pageW - marginR, y, { align: "right" });
      y += 14;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text([exp.company, exp.location].filter(Boolean).join(" — "), marginL, y);
      y += 14;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      (exp.points || []).forEach((pt) => {
        const bulletLines = doc.splitTextToSize(`•  ${pt}`, usable - 10);
        checkPage(bulletLines.length * 13);
        doc.text(bulletLines, marginL + 10, y);
        y += bulletLines.length * 13;
      });
      y += 6;
    });
  }

  // EDUCATION
  if (data.education?.length) {
    sectionHeader("Education");
    data.education.forEach((edu) => {
      checkPage(28);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(edu.degree || "", marginL, y);
      doc.setFont("helvetica", "normal");
      doc.text(edu.year || "", pageW - marginR, y, { align: "right" });
      y += 14;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text(edu.school || "", marginL, y);
      y += 16;
    });
  }

  // WORK AUTHORIZATION & AVAILABILITY
  if (data.work_authorization) {
    sectionHeader("Work Authorization & Availability");
    doc.setFontSize(10);
    const wa = data.work_authorization;
    const items: { label: string; value: string }[] = [];
    if (wa.visa_type) items.push({ label: "Visa Status", value: wa.visa_type });
    if (wa.current_location) items.push({ label: "Current Location", value: wa.current_location });
    if (wa.passport_status) items.push({ label: "Passport", value: wa.passport_status });
    if (wa.previous_h2_experience) items.push({ label: "H-2 Experience", value: wa.previous_h2_experience });
    if (wa.availability) items.push({ label: "Availability", value: wa.availability });
    if (wa.visa_denial_history) items.push({ label: "Visa Denials", value: wa.visa_denial_history });

    items.forEach((item) => {
      checkPage(16);
      doc.setFont("helvetica", "bold");
      doc.text(`${item.label}:  `, marginL, y);
      const labelW = doc.getTextWidth(`${item.label}:  `);
      doc.setFont("helvetica", "normal");
      doc.text(item.value, marginL + labelW, y);
      y += 15;
    });
    y += 4;
  }

  // LANGUAGES
  if (data.languages?.length) {
    sectionHeader("Languages");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(data.languages.join("  •  "), marginL, y);
  }

  return doc;
}
