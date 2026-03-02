import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Mail, Phone, UserX } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Application {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  citizenship_status: string;
  has_english: boolean;
  has_experience: boolean;
  has_license: boolean;
  is_in_us: boolean;
  score_color: string | null;
  employer_status: string;
  rejection_reason: string | null;
  created_at: string;
}

const SCORE_COLORS: Record<string, string> = {
  green: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  yellow: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  red: "bg-red-500/15 text-red-700 border-red-500/30",
};

const REJECTION_REASONS = [
  "Position filled",
  "Does not meet requirements",
  "No response from applicant",
  "Applicant withdrew",
  "Other",
];

export default function JobApplicants() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { toast } = useToast();
  const [apps, setApps] = useState<Application[]>([]);
  const [jobTitle, setJobTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; app: Application | null; reason: string }>({
    open: false,
    app: null,
    reason: "",
  });

  useEffect(() => {
    if (!jobId) return;
    const load = async () => {
      const [jobRes, appsRes] = await Promise.all([
        supabase.from("sponsored_jobs").select("title").eq("id", jobId).maybeSingle(),
        supabase
          .from("job_applications")
          .select("*")
          .eq("job_id", jobId)
          .order("created_at", { ascending: false }),
      ]);
      setJobTitle(jobRes.data?.title ?? "");
      setApps((appsRes.data as Application[]) ?? []);
      setLoading(false);
    };
    load();
  }, [jobId]);

  const handleContact = async (app: Application, method: "email" | "phone") => {
    // Log to audit_logs via RPC
    if (session) {
      await supabase.rpc("insert_audit_log", {
        p_job_id: jobId!,
        p_application_id: app.id,
        p_employer_id: app.id, // We need employer_id, but it's handled server-side
        p_action: "contacted",
        p_reason: method,
      });
    }
    if (method === "email") window.location.href = `mailto:${app.email}`;
    else if (method === "phone" && app.phone) window.location.href = `tel:${app.phone}`;
  };

  const handleReject = async () => {
    if (!rejectDialog.app || !rejectDialog.reason) return;
    const { error } = await supabase
      .from("job_applications")
      .update({ employer_status: "rejected", rejection_reason: rejectDialog.reason })
      .eq("id", rejectDialog.app.id);

    if (!error) {
      setApps((prev) =>
        prev.map((a) =>
          a.id === rejectDialog.app!.id
            ? { ...a, employer_status: "rejected", rejection_reason: rejectDialog.reason }
            : a,
        ),
      );
      toast({ title: "Applicant rejected" });
    }
    setRejectDialog({ open: false, app: null, reason: "" });
  };

  // Sort: green first, then yellow, then red; within each, newest first
  const sorted = [...apps].sort((a, b) => {
    const order = { green: 0, yellow: 1, red: 2 };
    const sa = order[(a.score_color as keyof typeof order) ?? "yellow"] ?? 1;
    const sb = order[(b.score_color as keyof typeof order) ?? "yellow"] ?? 1;
    if (sa !== sb) return sa - sb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/employer/jobs")}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Jobs
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>
            Applicants — {jobTitle}
            <Badge variant="outline" className="ml-2">
              {apps.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground animate-pulse">Loading...</p>
          ) : apps.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No applications yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Score</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={SCORE_COLORS[app.score_color ?? "yellow"]}
                        >
                          {app.score_color ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{app.full_name}</TableCell>
                      <TableCell className="text-sm">{app.email}</TableCell>
                      <TableCell className="text-sm">{app.phone ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            app.employer_status === "rejected"
                              ? "destructive"
                              : app.employer_status === "contacted"
                                ? "default"
                                : "secondary"
                          }
                        >
                          {app.employer_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(app.created_at), "MMM d")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleContact(app, "email")}
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </Button>
                          {app.phone && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleContact(app, "phone")}
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {app.employer_status !== "rejected" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setRejectDialog({ open: true, app, reason: "" })}
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={rejectDialog.open}
        onOpenChange={(open) => setRejectDialog((p) => ({ ...p, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejectDialog.app?.full_name}?</DialogTitle>
          </DialogHeader>
          <Select
            value={rejectDialog.reason}
            onValueChange={(v) => setRejectDialog((p) => ({ ...p, reason: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select reason..." />
            </SelectTrigger>
            <SelectContent>
              {REJECTION_REASONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, app: null, reason: "" })}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={!rejectDialog.reason} onClick={handleReject}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
