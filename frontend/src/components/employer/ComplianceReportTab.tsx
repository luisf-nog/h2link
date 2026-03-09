import { useMemo } from "react";
import type { Application, AuditEntry } from "@/pages/employer/JobApplicants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, Shield } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import logoWordmark from "@/assets/h2link-logo-wordmark.png";

function loadImageAsBase64(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });
}

interface JobDetails {
  employer_legal_name: string | null;
  city: string | null;
  state: string | null;
  hourly_wage: number | null;
  start_date: string | null;
  end_date: string | null;
  wage_rate: string | null;
}

interface Props {
  apps: Application[];
  auditLogs: AuditEntry[];
  jobTitle: string;
  dolCaseNumber: string | null;
  jobId: string;
  jobDetails: JobDetails;
}

export function ComplianceReportTab({ apps, auditLogs, jobTitle, dolCaseNumber, jobId, jobDetails }: Props) {
  const stats = useMemo(() => {
    const totalApps = apps.length;
    const usWorkers = apps.filter((a) => a.is_us_worker).length;
    const contacted = apps.filter((a) => ["contacted", "interview_scheduled", "interviewed", "hired", "rejected", "declined_by_worker"].includes(a.application_status)).length;
    const interviewed = apps.filter((a) => ["interviewed", "hired"].includes(a.application_status)).length;
    const hired = apps.filter((a) => a.application_status === "hired").length;
    const rejected = apps.filter((a) => a.application_status === "rejected").length;

    const rejectionBreakdown: Record<string, number> = {};
    apps.filter((a) => a.application_status === "rejected" && a.rejection_reason).forEach((a) => {
      const r = a.rejection_reason!;
      rejectionBreakdown[r] = (rejectionBreakdown[r] || 0) + 1;
    });

    const earliest = apps.length > 0 ? apps.reduce((min, a) => (a.created_at < min ? a.created_at : min), apps[0].created_at) : null;
    const latest = auditLogs.length > 0 ? auditLogs.reduce((max, a) => (a.created_at > max ? a.created_at : max), auditLogs[0].created_at) : null;

    return { totalApps, usWorkers, contacted, interviewed, hired, rejected, rejectionBreakdown, earliest, latest };
  }, [apps, auditLogs]);

  const generateReportId = () => {
    const now = new Date();
    return `DR-${format(now, "yyyy-MM-dd")}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")}`;
  };

  const drawLine = (doc: jsPDF, y: number, width: number) => {
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(14, y, width - 14, y);
  };

  const generatePdf = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const reportId = generateReportId();
    const generatedAt = format(new Date(), "MMMM d, yyyy – hh:mm a");
    let y = 0;

    // ====== PAGE 1: COVER ======
    y = 20;

    // Logo
    try {
      const logoBase64 = await loadImageAsBase64(logoWordmark);
      doc.addImage(logoBase64, "PNG", 14, y - 8, 40, 20);
      y += 18;
    } catch {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(30, 30, 30);
      doc.text("H2 Linker", 14, y + 6);
      y += 14;
    }

    y += 10;
    doc.setFontSize(14);
    doc.setTextColor(80, 80, 80);
    doc.text("Domestic Recruitment Compliance Report", 14, y);

    y += 6;
    drawLine(doc, y, pageWidth);

    y += 14;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");

    const coverFields = [
      ["Report ID", reportId],
      ["Generated on", generatedAt],
      ["Case Reference", dolCaseNumber || "N/A"],
      ["", ""],
      ["Employer Legal Name", jobDetails.employer_legal_name || "N/A"],
      ["Work Location", [jobDetails.city, jobDetails.state].filter(Boolean).join(", ") || "N/A"],
      ["Job Title", jobTitle],
    ];

    coverFields.forEach(([label, value]) => {
      if (!label && !value) { y += 6; return; }
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text(`${label}:`, 14, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text(String(value), 70, y);
      y += 6;
    });

    // Footer on cover
    y = 270;
    drawLine(doc, y, pageWidth);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("Generated via H2 Linker Recruitment Management System", 14, y);
    doc.text("www.h2linker.com", pageWidth - 14, y, { align: "right" });

    // ====== PAGE 2: EXECUTIVE SUMMARY ======
    doc.addPage();
    y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text("Executive Recruitment Summary", 14, y);
    y += 4;
    drawLine(doc, y, pageWidth);
    y += 10;

    doc.setFontSize(9);
    const summaryRows = [
      ["Total Applications", String(stats.totalApps)],
      ["U.S. Worker Applicants", String(stats.usWorkers)],
      ["Applicants Contacted", String(stats.contacted)],
      ["Interviews Conducted", String(stats.interviewed)],
      ["Hires", String(stats.hired)],
      ["Lawful Rejections", String(stats.rejected)],
    ];

    summaryRows.forEach(([label, value], i) => {
      if (i % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(14, y - 4, pageWidth - 28, 7, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(label, 16, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text(value, pageWidth - 30, y, { align: "right" });
      y += 7;
    });

    y += 6;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    const disclaimerLines = doc.splitTextToSize(
      "All recruitment activity occurred within the stated recruitment period and was electronically recorded within the H2 Linker system.",
      pageWidth - 28
    );
    doc.text(disclaimerLines, 14, y);
    y += disclaimerLines.length * 5 + 8;

    // Rejection breakdown
    if (Object.keys(stats.rejectionBreakdown).length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text("Rejection Reasons Breakdown", 14, y);
      y += 4;
      drawLine(doc, y, pageWidth);
      y += 8;
      doc.setFontSize(9);
      Object.entries(stats.rejectionBreakdown).forEach(([reason, count]) => {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        doc.text(`• ${reason.replace(/_/g, " ")}`, 16, y);
        doc.setFont("helvetica", "bold");
        doc.text(String(count), pageWidth - 30, y, { align: "right" });
        y += 6;
      });
      y += 6;
    }

    // ====== EMPLOYER & JOB INFORMATION ======
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text("Employer and Position Details", 14, y);
    y += 4;
    drawLine(doc, y, pageWidth);
    y += 10;

    const wageDisplay = jobDetails.hourly_wage
      ? `$${jobDetails.hourly_wage.toFixed(2)}/hr`
      : jobDetails.wage_rate || "N/A";

    const employerFields = [
      ["Employer Legal Name", jobDetails.employer_legal_name || "N/A"],
      ["Worksite Address", [jobDetails.city, jobDetails.state].filter(Boolean).join(", ") || "N/A"],
      ["Job Title", jobTitle],
      ["Employment Period", jobDetails.start_date && jobDetails.end_date
        ? `${format(new Date(jobDetails.start_date), "PP")} – ${format(new Date(jobDetails.end_date), "PP")}`
        : "N/A"],
      ["Recruitment Period", stats.earliest
        ? `${format(new Date(stats.earliest), "PP")} – ${stats.latest ? format(new Date(stats.latest), "PP") : "Ongoing"}`
        : "N/A"],
      ["Wage Offered", wageDisplay],
    ];

    doc.setFontSize(9);
    employerFields.forEach(([label, value]) => {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text(`${label}:`, 16, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text(String(value), 70, y);
      y += 7;
    });

    // ====== DETAILED APPLICANT ACTIVITY LOG ======
    doc.addPage();
    y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text("Detailed Applicant Activity Log", 14, y);
    y += 4;
    drawLine(doc, y, pageWidth);
    y += 10;

    apps.forEach((app, idx) => {
      // Check if we need a new page
      if (y > 240) { doc.addPage(); y = 20; }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.text(`Applicant #${idx + 1}`, 14, y);
      y += 7;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(`Name: ${app.full_name}`, 16, y); y += 5;
      doc.text(`Email: ${app.email}`, 16, y); y += 5;
      doc.text(`Application Date: ${format(new Date(app.created_at), "MMMM d, yyyy – hh:mm a")}`, 16, y); y += 7;

      // Activity timeline for this applicant
      const appLogs = auditLogs
        .filter((l) => l.application_id === app.id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text("Activity Timeline:", 16, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);

      // First entry: application submitted
      doc.text(`• ${format(new Date(app.created_at), "hh:mm a")} – Application Submitted`, 20, y);
      y += 4;

      appLogs.forEach((log) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const time = format(new Date(log.created_at), "hh:mm a");
        const statusLabel = log.new_status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        let line = `• ${time} – Status Updated: ${statusLabel}`;
        if (log.rejection_reason) line += ` (${log.rejection_reason.replace(/_/g, " ")})`;
        doc.text(line, 20, y);
        y += 4;
      });

      y += 3;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      const finalStatus = app.application_status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      doc.text(`Final Status: ${finalStatus}`, 16, y);

      y += 8;
      drawLine(doc, y, pageWidth);
      y += 8;
    });

    if (apps.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text("No applications received during the recruitment period.", 14, y);
      y += 10;
    }

    // ====== SYSTEM INTEGRITY STATEMENT ======
    if (y > 230) { doc.addPage(); y = 20; }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text("System Audit & Data Integrity Statement", 14, y);
    y += 4;
    drawLine(doc, y, pageWidth);
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(70, 70, 70);

    const integrityTexts = [
      "All applicant activity, status changes, and timestamps are automatically recorded at the time of action within the H2 Linker Recruitment Management System.",
      "",
      "Records are stored electronically and maintained in accordance with federal recruitment documentation requirements.",
      "",
      `Report ID: ${reportId}`,
      `Digital verification reference generated on: ${generatedAt}`,
    ];

    integrityTexts.forEach((text) => {
      if (!text) { y += 3; return; }
      const lines = doc.splitTextToSize(text, pageWidth - 28);
      doc.text(lines, 14, y);
      y += lines.length * 5;
    });

    // Footer on every page
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(170, 170, 170);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, 290, { align: "right" });
      if (i > 1) {
        doc.text(`Report ID: ${reportId}`, 14, 290);
      }
    }

    doc.save(`compliance_report_${dolCaseNumber || jobId}.pdf`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4" />
            Domestic Recruitment Compliance Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Job Title:</span> <span className="font-medium">{jobTitle}</span></div>
            {dolCaseNumber && <div><span className="text-muted-foreground">DOL Case:</span> <span className="font-medium">{dolCaseNumber}</span></div>}
            {jobDetails.employer_legal_name && <div><span className="text-muted-foreground">Employer:</span> <span className="font-medium">{jobDetails.employer_legal_name}</span></div>}
            {stats.earliest && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Period:</span>{" "}
                <span className="font-medium">
                  {format(new Date(stats.earliest), "PP")} – {stats.latest ? format(new Date(stats.latest), "PP") : "Ongoing"}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total Applications", value: stats.totalApps },
              { label: "U.S. Workers", value: stats.usWorkers },
              { label: "Contacted", value: stats.contacted },
              { label: "Interviewed", value: stats.interviewed },
              { label: "Hired", value: stats.hired },
              { label: "Rejected", value: stats.rejected },
            ].map((s) => (
              <div key={s.label} className="text-center p-2 border rounded">
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {Object.keys(stats.rejectionBreakdown).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Rejection Reasons</p>
              <div className="space-y-1">
                {Object.entries(stats.rejectionBreakdown).map(([reason, count]) => (
                  <div key={reason} className="flex justify-between text-sm">
                    <span className="capitalize">{reason.replace(/_/g, " ")}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button onClick={generatePdf} className="w-full">
            <FileDown className="h-4 w-4 mr-2" />
            Download Compliance Report (PDF)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
