import { useState } from "react";
import type { Application } from "@/pages/employer/JobApplicants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Phone, ChevronDown, Eye } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ApplicantDetailDialog } from "./ApplicantDetailDialog";

const STATUS_OPTIONS = [
  { value: "received", label: "Received" },
  { value: "contacted", label: "Contacted" },
  { value: "interview_scheduled", label: "Interview Scheduled" },
  { value: "interviewed", label: "Interviewed" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
  { value: "declined_by_worker", label: "Declined by Worker" },
];

const REJECTION_REASONS = [
  "insufficient_experience",
  "failed_requirements",
  "no_show",
  "unavailable_dates",
  "declined_offer",
  "withdrew_application",
  "other",
];

const REJECTION_LABELS: Record<string, string> = {
  insufficient_experience: "Insufficient Experience",
  failed_requirements: "Failed Requirements",
  no_show: "No Show",
  unavailable_dates: "Unavailable Dates",
  declined_offer: "Declined Offer",
  withdrew_application: "Withdrew Application",
  other: "Other",
};

const MATCH_COLORS: Record<string, string> = {
  green: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  yellow: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  red: "bg-red-500/15 text-red-700 border-red-500/30",
};

const STATUS_VARIANT: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  received: "secondary",
  contacted: "outline",
  interview_scheduled: "outline",
  interviewed: "outline",
  hired: "default",
  rejected: "destructive",
  declined_by_worker: "destructive",
};

interface Props {
  apps: Application[];
  loading: boolean;
  onStatusChange: (app: Application, newStatus: string, rejectionReason?: string) => Promise<void>;
  jobId: string;
}

export function ApplicantsTab({ apps, loading, onStatusChange, jobId }: Props) {
  const { toast } = useToast();
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; app: Application | null; reason: string }>({
    open: false, app: null, reason: "",
  });
  const [detailApp, setDetailApp] = useState<Application | null>(null);

  const handleStatusSelect = async (app: Application, status: string) => {
    if (status === "rejected") {
      setRejectDialog({ open: true, app, reason: "" });
      return;
    }
    await onStatusChange(app, status);
    toast({ title: `Status updated to "${status}"` });
  };

  const handleReject = async () => {
    if (!rejectDialog.app || !rejectDialog.reason) return;
    await onStatusChange(rejectDialog.app, "rejected", rejectDialog.reason);
    toast({ title: "Applicant rejected" });
    setRejectDialog({ open: false, app: null, reason: "" });
  };

  // Sort: green first, then yellow, then red; within each by score desc
  const sorted = [...apps].sort((a, b) => {
    const order = { green: 0, yellow: 1, red: 2 };
    const sa = order[(a.match_status as keyof typeof order) ?? "yellow"] ?? 1;
    const sb = order[(b.match_status as keyof typeof order) ?? "yellow"] ?? 1;
    if (sa !== sb) return sa - sb;
    return (b.application_match_score ?? 0) - (a.application_match_score ?? 0);
  });

  if (loading) return <p className="text-muted-foreground animate-pulse p-4">Loading...</p>;
  if (apps.length === 0) return <p className="text-muted-foreground text-center py-8">No applications yet.</p>;

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Score</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>English</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Authorization</TableHead>
                  <TableHead>US Worker</TableHead>
                  <TableHead>Visa Hx</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="flex flex-col items-center gap-0.5">
                        <Badge variant="outline" className={MATCH_COLORS[app.match_status ?? "yellow"]}>
                          {app.application_match_score ?? "—"}%
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{app.full_name}</TableCell>
                    <TableCell className="text-sm">{app.months_experience}mo</TableCell>
                    <TableCell className="text-sm capitalize">{app.english_level}</TableCell>
                    <TableCell className="text-sm capitalize">{app.drivers_license_type}</TableCell>
                    <TableCell className="text-xs capitalize">{app.work_authorization_status.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm">{app.is_us_worker ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-sm">{app.h2b_visa_count}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[app.application_status] ?? "secondary"}>
                        {app.application_status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(app.created_at), "MMM d")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDetailApp(app)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.location.href = `mailto:${app.email}`}>
                          <Mail className="h-3.5 w-3.5" />
                        </Button>
                        {app.phone && (
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.location.href = `tel:${app.phone}`}>
                            <Phone className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {STATUS_OPTIONS.filter((s) => s.value !== app.application_status).map((s) => (
                              <DropdownMenuItem key={s.value} onClick={() => handleStatusSelect(app, s.value)}>
                                {s.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog((p) => ({ ...p, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejectDialog.app?.full_name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">A rejection reason is required for compliance.</p>
          <Select value={rejectDialog.reason} onValueChange={(v) => setRejectDialog((p) => ({ ...p, reason: v }))}>
            <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
            <SelectContent>
              {REJECTION_REASONS.map((r) => (
                <SelectItem key={r} value={r}>{REJECTION_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, app: null, reason: "" })}>Cancel</Button>
            <Button variant="destructive" disabled={!rejectDialog.reason} onClick={handleReject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <ApplicantDetailDialog app={detailApp} open={!!detailApp} onClose={() => setDetailApp(null)} />
    </>
  );
}
