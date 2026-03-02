import { useMemo } from "react";
import type { Application, AuditEntry } from "@/pages/employer/JobApplicants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, Shield } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";

interface Props {
  apps: Application[];
  auditLogs: AuditEntry[];
  jobTitle: string;
  dolCaseNumber: string | null;
  jobId: string;
}

export function ComplianceReportTab({ apps, auditLogs, jobTitle, dolCaseNumber, jobId }: Props) {
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

  const generatePdf = () => {
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(16);
    doc.text("Domestic Recruitment Compliance Log", 14, y);
    y += 10;

    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), "PPP 'at' HH:mm")}`, 14, y);
    y += 8;

    doc.setFontSize(12);
    doc.text(`Job Title: ${jobTitle}`, 14, y);
    y += 6;
    if (dolCaseNumber) {
      doc.text(`DOL Case Number: ${dolCaseNumber}`, 14, y);
      y += 6;
    }

    if (stats.earliest) {
      doc.text(`Recruitment Period: ${format(new Date(stats.earliest), "PP")} – ${stats.latest ? format(new Date(stats.latest), "PP") : "Ongoing"}`, 14, y);
      y += 10;
    }

    doc.setFontSize(11);
    doc.text("Summary", 14, y);
    y += 6;
    doc.setFontSize(10);
    const summaryLines = [
      `Total Applications Received: ${stats.totalApps}`,
      `Total U.S. Workers: ${stats.usWorkers}`,
      `Total Contacted: ${stats.contacted}`,
      `Total Interviewed: ${stats.interviewed}`,
      `Total Hired: ${stats.hired}`,
      `Total Rejected: ${stats.rejected}`,
    ];
    summaryLines.forEach((line) => {
      doc.text(line, 14, y);
      y += 5;
    });

    y += 5;
    if (Object.keys(stats.rejectionBreakdown).length > 0) {
      doc.setFontSize(11);
      doc.text("Rejection Reasons Breakdown", 14, y);
      y += 6;
      doc.setFontSize(10);
      Object.entries(stats.rejectionBreakdown).forEach(([reason, count]) => {
        doc.text(`• ${reason.replace(/_/g, " ")}: ${count}`, 14, y);
        y += 5;
      });
      y += 5;
    }

    // Audit timeline
    if (auditLogs.length > 0) {
      doc.setFontSize(11);
      doc.text("Status Change Timeline", 14, y);
      y += 6;
      doc.setFontSize(9);

      auditLogs.forEach((log) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const appName = apps.find((a) => a.id === log.application_id)?.full_name ?? "Unknown";
        const line = `${format(new Date(log.created_at), "PP HH:mm")} | ${appName} | ${log.previous_status} → ${log.new_status}${log.rejection_reason ? ` (${log.rejection_reason})` : ""}`;
        doc.text(line, 14, y);
        y += 4;
      });
    }

    doc.save(`domestic_recruitment_log_${jobId}.pdf`);
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
