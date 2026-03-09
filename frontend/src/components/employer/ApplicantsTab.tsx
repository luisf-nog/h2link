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
  XCircle,
  AlertCircle,
  Users,
  FileText,
  MapPin,
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

function avatarColor(name: string) {
  const colors = [
    "bg-sky-500", "bg-violet-500", "bg-emerald-500",
    "bg-amber-500", "bg-rose-500", "bg-indigo-500",
  ];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % colors.length;
  return colors[h];
}

// Work Authorization display
function getWorkAuthDisplay(status: string): { label: string; color: "green" | "yellow" | "red"; requiresVisa: boolean } {
  const map: Record<string, { label: string; color: "green" | "yellow" | "red"; requiresVisa: boolean }> = {
    us_citizen:          { label: "US Citizen",          color: "green",  requiresVisa: false },
    permanent_resident:  { label: "Permanent Resident",  color: "green",  requiresVisa: false },
    authorized:          { label: "Work Authorized",     color: "green",  requiresVisa: false },
    inside_us:           { label: "In US",               color: "yellow", requiresVisa: true },
    h2_visa_holder:      { label: "H-2 Returner",        color: "yellow", requiresVisa: true },
    needs_sponsorship:   { label: "Needs Visa",          color: "red",    requiresVisa: true },
    outside_us:          { label: "Outside US",          color: "red",    requiresVisa: true },
    unauthorized:        { label: "Not Authorized",      color: "red",    requiresVisa: true },
  };
  return map[status] ?? { label: status, color: "red", requiresVisa: true };
}

const STATUS_OPTIONS = [
  { value: "received", label: "New" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "contacted", label: "Contacted" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
];

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
  const workAuth = getWorkAuthDisplay(app.work_authorization_status);

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "rejected") {
      setRejectOpen(true);
    } else {
      onStatusChange(app, newStatus);
    }
  };

  const authBadgeClasses = {
    green: "bg-emerald-100 text-emerald-700 border-emerald-200",
    yellow: "bg-amber-100 text-amber-700 border-amber-200",
    red: "bg-red-100 text-red-700 border-red-200",
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
        {/* Avatar */}
        <div className={`${avatarColor(app.full_name)} w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0`}>
          {initials(app.full_name)}
        </div>

        {/* Name + Match Score */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-foreground truncate">{app.full_name}</span>
            {app.application_match_score !== null && (
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                app.application_match_score >= 80 ? "bg-emerald-100 text-emerald-700" :
                app.application_match_score >= 50 ? "bg-amber-100 text-amber-700" :
                "bg-red-100 text-red-700"
              }`}>
                {app.application_match_score}%
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {format(new Date(app.created_at), "MMM d")}
          </div>
        </div>

        {/* Work Auth Badge (key info) */}
        <div className="hidden sm:flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border ${authBadgeClasses[workAuth.color]}`}>
            {workAuth.color === "green" && <CheckCircle2 size={12} />}
            {workAuth.color === "yellow" && <AlertCircle size={12} />}
            {workAuth.color === "red" && <XCircle size={12} />}
            {workAuth.label}
          </span>
          
          {workAuth.requiresVisa && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border bg-violet-100 text-violet-700 border-violet-200">
              <Globe size={12} />
              Requires Visa
            </span>
          )}
          
          {!app.is_in_us && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={12} />
              Outside US
            </span>
          )}
        </div>

        {/* Status Dropdown */}
        <Select
          value={app.application_status}
          onValueChange={handleStatusChange}
        >
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
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
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-foreground">{apps.length}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-700">
            {apps.filter(a => ["us_citizen", "permanent_resident", "authorized"].includes(a.work_authorization_status)).length}
          </div>
          <div className="text-xs text-emerald-600">US Workers</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-amber-700">
            {apps.filter(a => (a.application_match_score ?? 0) >= 80).length}
          </div>
          <div className="text-xs text-amber-600">80%+ Match</div>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-violet-700">
            {counts["hired"] ?? 0}
          </div>
          <div className="text-xs text-violet-600">Hired</div>
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
