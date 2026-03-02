import type { Application, AuditEntry } from "@/pages/employer/JobApplicants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Users, PhoneCall, CalendarCheck, UserCheck, UserX } from "lucide-react";

interface Props {
  apps: Application[];
  auditLogs: AuditEntry[];
}

export function RecruitmentLogTab({ apps, auditLogs }: Props) {
  const totalApps = apps.length;
  const usWorkers = apps.filter((a) => a.is_us_worker).length;
  const contacted = apps.filter((a) => ["contacted", "interview_scheduled", "interviewed", "hired", "rejected", "declined_by_worker"].includes(a.application_status)).length;
  const interviewed = apps.filter((a) => ["interviewed", "hired"].includes(a.application_status)).length;
  const hired = apps.filter((a) => a.application_status === "hired").length;
  const rejected = apps.filter((a) => a.application_status === "rejected").length;

  // Rejection breakdown
  const rejectionBreakdown: Record<string, number> = {};
  apps.filter((a) => a.application_status === "rejected" && a.rejection_reason).forEach((a) => {
    const r = a.rejection_reason!;
    rejectionBreakdown[r] = (rejectionBreakdown[r] || 0) + 1;
  });

  const stats = [
    { icon: Users, label: "Total Applications", value: totalApps },
    { icon: Users, label: "U.S. Workers", value: usWorkers },
    { icon: PhoneCall, label: "Contacted", value: contacted },
    { icon: CalendarCheck, label: "Interviewed", value: interviewed },
    { icon: UserCheck, label: "Hired", value: hired },
    { icon: UserX, label: "Rejected", value: rejected },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <s.icon className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rejection Breakdown */}
      {Object.keys(rejectionBreakdown).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rejection Reasons Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(rejectionBreakdown).map(([reason, count]) => (
                <Badge key={reason} variant="outline" className="text-xs">
                  {reason.replace(/_/g, " ")} ({count})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Status Change Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No status changes recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => {
                    const app = apps.find((a) => a.id === log.application_id);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm font-medium">{app?.full_name ?? "Unknown"}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{log.previous_status.replace(/_/g, " ")}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{log.new_status.replace(/_/g, " ")}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{log.rejection_reason?.replace(/_/g, " ") ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(log.created_at), "MMM d, HH:mm")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
