import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  AlertCircle,
  Users,
  FileText,
  Globe,
} from "lucide-react";
import { format } from "date-fns";
import type { Application } from "@/pages/employer/JobApplicants";
import { ApplicantDetailDialog } from "./ApplicantDetailDialog";

// ─── helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// Professional neutral avatars - alternating between 2 neutral tones
function avatarColor(name: string) {
  const colors = ["bg-muted", "bg-primary/10"];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % colors.length;
  return colors[h];
}

// Simplified work auth - focus on what matters to employers
function getWorkAuthBadge(status: string, isInUs: boolean): { label: string; icon: "check" | "globe" | "alert" } | null {
  const usWorkerStatuses = ["us_citizen", "permanent_resident", "authorized"];
  if (usWorkerStatuses.includes(status)) {
    return { label: "US Worker", icon: "check" };
  }
  if (!isInUs) {
    return { label: "Outside US", icon: "globe" };
  }
  if (status === "h2_visa_holder") {
    return { label: "H-2 Returner", icon: "check" };
  }
  return { label: "Requires H-2 Visa", icon: "alert" };
}

// Match score color - simple 3-tier system (90+, 70-89, <70)
function getMatchScoreStyle(score: number | null): string {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 90) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400";
  if (score >= 70) return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

const STATUS_OPTIONS = [
  { value: "received", label: "New", color: "bg-amber-500" },
  { value: "shortlisted", label: "Shortlisted", color: "bg-primary" },
  { value: "contacted", label: "Contacted", color: "bg-primary" },
  { value: "hired", label: "Hired", color: "bg-emerald-500" },
  { value: "rejected", label: "Rejected", color: "bg-destructive" },
];

function getStatusColor(status: string): string {
  return STATUS_OPTIONS.find(s => s.value === status)?.color ?? "bg-muted";
}

// Format experience
function formatExperience(months: number): string {
  if (months < 12) return `${months}mo exp`;
  const years = Math.floor(months / 12);
  return `${years}yr exp`;
}

// ─── Reject Dialog ─────────────────────────────────────────────────────────────

function RejectDialog({
  app,
  open,
  onClose,
  onConfirm,
}: {
  app: Application;
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {app.full_name}?</DialogTitle>
          <DialogDescription>
            This action will be recorded in the recruitment log for DOL documentation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <label className="text-sm font-medium">Reason (required for compliance)</label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g., Insufficient experience for the role"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={() => { onConfirm(reason); setReason(""); }}>
            Confirm rejection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Compact Candidate Row ─────────────────────────────────────────────────────

function CandidateRow({
  app,
  onStatusChange,
  onOpenDetail,
}: {
  app: Application;
  onStatusChange: (app: Application, status: string, reason?: string) => void;
  onOpenDetail: (app: Application) => void;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const workAuthBadge = getWorkAuthBadge(app.work_authorization_status, app.is_in_us);

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "rejected") {
      setRejectOpen(true);
    } else {
      onStatusChange(app, newStatus);
    }
  };

  return (
    <>
      <RejectDialog
        app={app}
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={(reason) => { onStatusChange(app, "rejected", reason); setRejectOpen(false); }}
      />

      <div className="flex items-center gap-3 p-3 bg-card border rounded-lg hover:shadow-sm transition-shadow">
        {/* Avatar - neutral professional colors */}
        <div className={`${avatarColor(app.full_name)} w-9 h-9 rounded-full flex items-center justify-center text-foreground font-semibold text-xs shrink-0`}>
          {initials(app.full_name)}
        </div>

        {/* Name + Match Score + Quick Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-foreground truncate">{app.full_name}</span>
            {app.application_match_score !== null && (
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${getMatchScoreStyle(app.application_match_score)}`}>
                {app.application_match_score}%
              </span>
            )}
          </div>
          {/* Quick info row */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{format(new Date(app.created_at), "MMM d")}</span>
            <span>•</span>
            <span className="capitalize">{app.english_level || "—"} English</span>
            <span>•</span>
            <span>{formatExperience(app.months_experience)}</span>
          </div>
        </div>

        {/* Single work auth badge - simplified */}
        <div className="hidden sm:flex items-center gap-2">
          {workAuthBadge && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border bg-muted text-muted-foreground border-border">
              {workAuthBadge.icon === "check" && <CheckCircle2 size={12} className="text-emerald-600" />}
              {workAuthBadge.icon === "globe" && <Globe size={12} />}
              {workAuthBadge.icon === "alert" && <AlertCircle size={12} className="text-amber-600" />}
              {workAuthBadge.label}
            </span>
          )}
        </div>

        {/* Status Dropdown with color indicator */}
        <Select
          value={app.application_status}
          onValueChange={handleStatusChange}
        >
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${getStatusColor(app.application_status)}`} />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                  {opt.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View Details Button */}
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5"
          onClick={() => onOpenDetail(app)}
        >
          <FileText size={14} />
          <span className="hidden sm:inline">Details</span>
        </Button>
      </div>
    </>
  );
}

// ─── Filter bar ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: "all",         label: "All"         },
  { value: "received",    label: "New"         },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "contacted",   label: "Contacted"   },
  { value: "hired",       label: "Hired"       },
  { value: "rejected",    label: "Rejected"    },
];

// ─── Main component ────────────────────────────────────────────────────────────

export function ApplicantsTab({
  apps,
  loading,
  onStatusChange,
}: {
  apps: Application[];
  loading: boolean;
  onStatusChange: (app: Application, status: string, reason?: string) => void | Promise<void>;
  jobId: string;
}) {
  const [filter, setFilter] = useState("all");
  const [detailApp, setDetailApp] = useState<Application | null>(null);

  const filtered = filter === "all" ? apps : apps.filter((a) => a.application_status === filter);

  // counts per status for badge
  const counts = apps.reduce<Record<string, number>>((acc, a) => {
    acc[a.application_status] = (acc[a.application_status] ?? 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="space-y-2 pt-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Users size={36} className="mx-auto mb-3 opacity-30" />
        <p className="font-medium">No applicants yet</p>
        <p className="text-sm mt-1">Workers who apply to this job will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      {/* Summary stats - neutral + primary only */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-foreground">{apps.length}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-foreground">
            {apps.filter(a => ["us_citizen", "permanent_resident", "authorized"].includes(a.work_authorization_status)).length}
          </div>
          <div className="text-xs text-muted-foreground">US Workers</div>
        </div>
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-primary">
            {apps.filter(a => (a.application_match_score ?? 0) >= 80).length}
          </div>
          <div className="text-xs text-primary/70">80%+ Match</div>
        </div>
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-primary">
            {counts["hired"] ?? 0}
          </div>
          <div className="text-xs text-primary/70">Hired</div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const count = f.value === "all" ? apps.length : (counts[f.value] ?? 0);
          if (f.value !== "all" && count === 0) return null;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filter === f.value
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:border-muted-foreground/40"
              }`}
            >
              {f.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filter === f.value ? "bg-primary-foreground/20" : "bg-muted"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.slice(0, 50).map((app) => (
          <CandidateRow
            key={app.id}
            app={app}
            onStatusChange={onStatusChange}
            onOpenDetail={setDetailApp}
          />
        ))}
      </div>

      {filtered.length > 50 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          Showing 50 of {filtered.length} applicants. Use filters to narrow results.
        </p>
      )}

      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">No applicants in this category.</p>
      )}

      {/* Detail Dialog */}
      <ApplicantDetailDialog
        app={detailApp}
        open={!!detailApp}
        onClose={() => setDetailApp(null)}
      />
    </div>
  );
}
