import { useState, useMemo } from "react";
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
  Passport,
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
              <Passport size={12} />
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
  jobId,
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
  // Sort by created_at descending
  return apps.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

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

function fmtExperience(months: number) {
  if (!months) return "No experience";
  if (months < 12) return `${months}mo`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y}yr ${m}mo` : `${y}yr`;
}

function fmtEnglish(level: string) {
  return { none: "None", basic: "Basic", intermediate: "Intermediate", advanced: "Advanced" }[level] ?? level;
}

function fmtLicense(type: string) {
  if (!type || type === "none") return "None";
  if (type === "foreign") return "Foreign";
  return type;
}

// Work Authorization with hierarchy colors
function getWorkAuthDisplay(status: string): { label: string; color: "green" | "yellow" | "red"; detail: string } {
  const map: Record<string, { label: string; color: "green" | "yellow" | "red"; detail: string }> = {
    us_citizen:          { label: "US Citizen",          color: "green",  detail: "No sponsorship needed" },
    permanent_resident:  { label: "Permanent Resident",  color: "green",  detail: "No sponsorship needed" },
    authorized:          { label: "Work Authorized",     color: "green",  detail: "No sponsorship needed" },
    h2_visa_holder:      { label: "H-2 Visa Holder",     color: "yellow", detail: "Has prior H-2 visa" },
    inside_us:           { label: "In US",               color: "yellow", detail: "May need sponsorship" },
    needs_sponsorship:   { label: "Needs Sponsorship",   color: "red",    detail: "Requires H-2 visa" },
    outside_us:          { label: "Outside US",          color: "red",    detail: "Requires H-2 visa" },
    unauthorized:        { label: "Not Authorized",      color: "red",    detail: "Requires sponsorship" },
  };
  return map[status] ?? { label: status, color: "red", detail: "Unknown status" };
}

function statusMeta(status: string) {
  const map: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    new:                { label: "New",          color: "bg-sky-100 text-sky-700",       icon: Clock       },
    reviewed:           { label: "Reviewed",     color: "bg-slate-100 text-slate-600",   icon: UserCheck   },
    shortlisted:        { label: "Shortlisted",  color: "bg-amber-100 text-amber-700",   icon: Star        },
    contacted:          { label: "Contacted",    color: "bg-violet-100 text-violet-700", icon: Mail        },
    hired:              { label: "Hired",        color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
    rejected:           { label: "Rejected",     color: "bg-red-100 text-red-600",       icon: XCircle     },
    declined_by_worker: { label: "Withdrew",     color: "bg-slate-100 text-slate-500",   icon: X           },
  };
  return map[status] ?? { label: status, color: "bg-slate-100 text-slate-500", icon: Info };
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
          <label className="text-sm font-medium">Reason (optional)</label>
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

// ─── Candidate Card (New Hierarchy) ────────────────────────────────────────────

function CandidateCard({
  app,
  onStatusChange,
}: {
  app: Application;
  onStatusChange: (app: Application, status: string, reason?: string) => void;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [copied, setCopied] = useState<"email" | "phone" | null>(null);

  const { label: statusLabel, color: statusColor, icon: StatusIcon } = statusMeta(app.application_status);
  const workAuth = getWorkAuthDisplay(app.work_authorization_status);
  const isWithdrawn = app.application_status === "declined_by_worker";
  const isTerminal = ["hired", "rejected", "declined_by_worker"].includes(app.application_status);

  function copy(text: string, field: "email" | "phone") {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 1800);
  }

  const authColorClasses = {
    green: "bg-emerald-500 border-emerald-600",
    yellow: "bg-amber-400 border-amber-500",
    red: "bg-red-500 border-red-600",
  };

  return (
    <>
      <RejectDialog
        app={app}
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={(reason) => { onStatusChange(app, "rejected", reason); setRejectOpen(false); }}
      />

      <div className={`bg-card border rounded-lg overflow-hidden transition-shadow hover:shadow-md ${isWithdrawn ? "opacity-60" : ""}`}>
        <div className="flex">
          
          {/* ═══ 1. WORK AUTHORIZATION STRIPE ═══ */}
          <div 
            className={`w-2 shrink-0 ${authColorClasses[workAuth.color]}`}
            title={`${workAuth.label}: ${workAuth.detail}`}
          />

          <div className="flex-1 p-4">
            {/* Top row: Avatar, Name, Status, Match Score */}
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className={`${avatarColor(app.full_name)} w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                {initials(app.full_name)}
              </div>

              {/* Name + Work Auth + Status */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">{app.full_name}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColor}`}>
                    {statusLabel}
                  </span>
                </div>
                
                {/* PROMINENT Work Authorization */}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-md ${
                    workAuth.color === "green" ? "bg-emerald-100 text-emerald-800" :
                    workAuth.color === "yellow" ? "bg-amber-100 text-amber-800" :
                    "bg-red-100 text-red-800"
                  }`}>
                    {workAuth.color === "green" && <CheckCircle2 size={14} />}
                    {workAuth.color === "yellow" && <AlertCircle size={14} />}
                    {workAuth.color === "red" && <XCircle size={14} />}
                    {workAuth.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{workAuth.detail}</span>
                </div>
              </div>

              {/* Match Score */}
              {app.application_match_score !== null && (
                <div className={`text-center px-3 py-1.5 rounded-lg shrink-0 ${
                  app.application_match_score >= 80 ? "bg-emerald-100 text-emerald-800" :
                  app.application_match_score >= 50 ? "bg-amber-100 text-amber-800" :
                  "bg-red-100 text-red-800"
                }`}>
                  <div className="text-lg font-bold">{app.application_match_score}%</div>
                  <div className="text-[10px] uppercase tracking-wide font-medium">Match</div>
                </div>
              )}
            </div>

            {/* ═══ 2. CONTACT INFO ═══ */}
            <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-border/50">
              {/* Email */}
              <div className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2.5 py-1.5">
                <Mail size={14} className="text-muted-foreground" />
                <span className="text-sm font-medium">{app.email}</span>
                <button
                  onClick={() => copy(app.email, "email")}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-1"
                  title="Copy email"
                >
                  {copied === "email" ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
                </button>
                <a
                  href={`mailto:${app.email}`}
                  className="p-1 rounded hover:bg-sky-100 text-muted-foreground hover:text-sky-600 transition-colors"
                  title="Send email"
                >
                  <Mail size={12} />
                </a>
              </div>

              {/* Phone */}
              {app.phone && (
                <div className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2.5 py-1.5">
                  <Phone size={14} className="text-muted-foreground" />
                  <span className="text-sm font-medium">{app.phone}</span>
                  <button
                    onClick={() => copy(app.phone!, "phone")}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-1"
                    title="Copy phone"
                  >
                    {copied === "phone" ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  </button>
                </div>
              )}

              {/* Applied date */}
              <span className="text-xs text-muted-foreground ml-auto">
                Applied {format(new Date(app.created_at), "MMM d, yyyy")}
              </span>
            </div>

            {/* ═══ 3. CAN DO THE JOB ═══ */}
            <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-border/50">
              {/* Experience */}
              <div className="flex items-center gap-2">
                <Briefcase size={14} className="text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-medium">{fmtExperience(app.months_experience)}</span>
                  <span className="text-muted-foreground ml-1">experience</span>
                </span>
              </div>

              {/* English */}
              <div className="flex items-center gap-2">
                <Languages size={14} className="text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-medium">{fmtEnglish(app.english_level)}</span>
                  <span className="text-muted-foreground ml-1">English</span>
                </span>
              </div>

              {/* License */}
              <div className="flex items-center gap-2">
                <Car size={14} className="text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-medium">{fmtLicense(app.drivers_license_type)}</span>
                  <span className="text-muted-foreground ml-1">license</span>
                </span>
              </div>
            </div>

            {/* ═══ 4. WILL COMPLETE CONTRACT ═══ */}
            {app.h2b_visa_count > 0 && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                <ShieldCheck size={14} className="text-violet-600" />
                <span className="text-sm font-medium text-violet-700">
                  {app.h2b_visa_count} prior H-2 season{app.h2b_visa_count > 1 ? "s" : ""}
                </span>
                <span className="text-xs text-muted-foreground">— proven contract completion</span>
              </div>
            )}

            {/* Withdrew notice */}
            {isWithdrawn && (
              <div className="mt-3 flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                <AlertCircle size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-500">
                  This candidate withdrew. Automatically recorded in recruitment log.
                </p>
              </div>
            )}

            {/* Rejection reason */}
            {app.application_status === "rejected" && app.rejection_reason && (
              <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                <span className="font-semibold">Rejection reason:</span> {app.rejection_reason}
              </div>
            )}

            {/* Action buttons */}
            {!isTerminal && (
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
                {app.application_status !== "shortlisted" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8 text-xs"
                    onClick={() => onStatusChange(app, "shortlisted")}
                  >
                    <Star size={12} /> Shortlist
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8 text-xs"
                  onClick={() => onStatusChange(app, "contacted")}
                >
                  <Mail size={12} /> Contacted
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => onStatusChange(app, "hired")}
                >
                  <CheckCircle2 size={12} /> Hired
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8 text-xs border-red-300 text-red-600 hover:bg-red-50 ml-auto"
                  onClick={() => setRejectOpen(true)}
                >
                  <XCircle size={12} /> Reject
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Filter bar ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: "all",         label: "All"         },
  { value: "new",         label: "New"         },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "contacted",   label: "Contacted"   },
  { value: "hired",       label: "Hired"       },
  { value: "rejected",    label: "Rejected"    },
];

// ─── Main component ────────────────────────────────────────────────────────────

export function ApplicantsTab({
  apps: realApps,
  loading,
  onStatusChange,
  jobId,
}: {
  apps: Application[];
  loading: boolean;
  onStatusChange: (app: Application, status: string, reason?: string) => void | Promise<void>;
  jobId: string;
}) {
  const [filter, setFilter] = useState("all");
  
  // Generate mock data if no real applicants
  const mockApps = useMemo(() => generateMockApplicants(150), []);
  const apps = realApps.length > 0 ? realApps : mockApps;

  const filtered = filter === "all" ? apps : apps.filter((a) => a.application_status === filter);

  // counts per status for badge
  const counts = apps.reduce<Record<string, number>>((acc, a) => {
    acc[a.application_status] = (acc[a.application_status] ?? 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="space-y-3 pt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
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
          <div className="text-xs text-muted-foreground">Total Applicants</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-700">
            {apps.filter(a => ["us_citizen", "permanent_resident", "authorized"].includes(a.work_authorization_status)).length}
          </div>
          <div className="text-xs text-emerald-600">Work Authorized</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-amber-700">
            {apps.filter(a => (a.application_match_score ?? 0) >= 80).length}
          </div>
          <div className="text-xs text-amber-600">Strong Matches (80%+)</div>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-violet-700">
            {apps.filter(a => a.h2b_visa_count > 0).length}
          </div>
          <div className="text-xs text-violet-600">Prior H-2 Experience</div>
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

      {/* Cards */}
      <div className="space-y-2">
        {filtered.slice(0, 50).map((app) => (
          <CandidateCard key={app.id} app={app} onStatusChange={onStatusChange} />
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
    </div>
  );
}
