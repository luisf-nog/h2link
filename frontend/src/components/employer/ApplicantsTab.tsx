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
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  Clock,
  Star,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  Globe,
  Briefcase,
  Car,
  Languages,
  ShieldCheck,
  AlertCircle,
  UserCheck,
  Info,
} from "lucide-react";
import { format } from "date-fns";
import type { Application } from "@/pages/employer/JobApplicants";

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
  if (months < 12) return `${months}mo experience`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y}yr ${m}mo experience` : `${y}yr experience`;
}

function fmtEnglish(level: string) {
  return { none: "No English", basic: "Basic English", intermediate: "Intermediate English", advanced: "Advanced English" }[level] ?? level;
}

function fmtLicense(type: string) {
  if (!type || type === "none") return null;
  if (type === "foreign") return "Foreign license";
  return `License: ${type}`;
}

function fmtWorkAuth(status: string) {
  const map: Record<string, { label: string; ok: boolean }> = {
    inside_us:    { label: "Currently in US",   ok: true  },
    outside_us:   { label: "Outside US",         ok: false },
    authorized:   { label: "Work authorized",    ok: true  },
    unauthorized: { label: "Not authorized",     ok: false },
  };
  return map[status] ?? { label: status, ok: false };
}

function statusMeta(status: string) {
  const map: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    new:                { label: "New",              color: "bg-sky-50 text-sky-700 border-sky-200",       icon: Clock       },
    reviewed:           { label: "Reviewed",         color: "bg-slate-50 text-slate-600 border-slate-200", icon: UserCheck   },
    shortlisted:        { label: "Shortlisted",      color: "bg-amber-50 text-amber-700 border-amber-200", icon: Star        },
    contacted:          { label: "Contacted",        color: "bg-violet-50 text-violet-700 border-violet-200", icon: Mail     },
    hired:              { label: "Hired",            color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
    rejected:           { label: "Rejected",         color: "bg-red-50 text-red-600 border-red-200",       icon: XCircle     },
    declined_by_worker: { label: "Withdrew",         color: "bg-slate-50 text-slate-500 border-slate-200", icon: X           },
  };
  return map[status] ?? { label: status, color: "bg-slate-50 text-slate-500 border-slate-200", icon: Info };
}

function matchLabel(score: number | null) {
  if (score === null) return null;
  if (score >= 80) return { label: "Strong match",  color: "text-emerald-600 bg-emerald-50 border-emerald-200" };
  if (score >= 50) return { label: "Partial match", color: "text-amber-600 bg-amber-50 border-amber-200"       };
  return                  { label: "Low match",     color: "text-red-500 bg-red-50 border-red-200"             };
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

// ─── Candidate Card ────────────────────────────────────────────────────────────

function CandidateCard({
  app,
  onStatusChange,
}: {
  app: Application;
  onStatusChange: (app: Application, status: string, reason?: string) => void;
}) {
  const [expanded, setExpanded]       = useState(false);
  const [rejectOpen, setRejectOpen]   = useState(false);
  const [copied, setCopied]           = useState<"email" | "phone" | null>(null);

  const { label: statusLabel, color: statusColor, icon: StatusIcon } = statusMeta(app.application_status);
  const auth  = fmtWorkAuth(app.work_authorization_status);
  const match = matchLabel(app.application_match_score);
  const licenseStr = fmtLicense(app.drivers_license_type);
  const isWithdrawn = app.application_status === "declined_by_worker";
  const isTerminal  = ["hired", "rejected", "declined_by_worker"].includes(app.application_status);

  function copy(text: string, field: "email" | "phone") {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 1800);
  }

  return (
    <>
      <RejectDialog
        app={app}
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={(reason) => { onStatusChange(app, "rejected", reason); setRejectOpen(false); }}
      />

      <div className={`bg-card border rounded-xl overflow-hidden transition-shadow hover:shadow-md ${isWithdrawn ? "opacity-60" : ""}`}>

        {/* ── Card header ── */}
        <div className="p-5">
          <div className="flex items-start gap-4">

            {/* Avatar */}
            <div className={`${avatarColor(app.full_name)} w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0`}>
              {initials(app.full_name)}
            </div>

            {/* Name + badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground text-base">{app.full_name}</span>

                {/* Status badge */}
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColor}`}>
                  <StatusIcon size={11} />
                  {statusLabel}
                </span>

                {/* Match score */}
                {match && app.application_match_score !== null && (
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${match.color}`}
                    title={`Match score: ${app.application_match_score}% — based on experience, visa type, English level and location`}
                  >
                    <Star size={10} />
                    {app.application_match_score}% · {match.label}
                  </span>
                )}
              </div>

              {/* Applied date */}
              <p className="text-xs text-muted-foreground mt-0.5">
                Applied {format(new Date(app.created_at), "MMM d, yyyy")}
              </p>
            </div>

            {/* Expand toggle */}
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>

          {/* ── Qualification pills ── */}
          <div className="mt-3 flex flex-wrap gap-1.5">

            {/* Work auth */}
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${auth.ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
              <Globe size={10} />
              {auth.label}
            </span>

            {/* Experience */}
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border bg-slate-50 text-slate-600 border-slate-200">
              <Briefcase size={10} />
              {fmtExperience(app.months_experience)}
            </span>

            {/* English */}
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${app.has_english ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
              <Languages size={10} />
              {fmtEnglish(app.english_level)}
            </span>

            {/* License */}
            {licenseStr && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border bg-slate-50 text-slate-600 border-slate-200">
                <Car size={10} />
                {licenseStr}
              </span>
            )}

            {/* H-2 seasons */}
            {app.h2b_visa_count > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200">
                <ShieldCheck size={10} />
                {app.h2b_visa_count} H-2 season{app.h2b_visa_count > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* ── Withdrew notice ── */}
          {isWithdrawn && (
            <div className="mt-3 flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <AlertCircle size={14} className="text-slate-400 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-500 leading-snug">
                This candidate withdrew their application. No action needed — this is automatically recorded in your recruitment log.
              </p>
            </div>
          )}

          {/* ── Rejection reason ── */}
          {app.application_status === "rejected" && app.rejection_reason && (
            <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <span className="font-semibold">Reason:</span> {app.rejection_reason}
            </div>
          )}
        </div>

        {/* ── Expanded contact + actions ── */}
        {expanded && (
          <div className="border-t bg-muted/30 px-5 py-4 space-y-4">

            {/* Contact info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between gap-2 bg-background border rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail size={14} className="text-muted-foreground shrink-0" />
                  <span className="text-sm truncate font-medium">{app.email}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => copy(app.email, "email")}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy email"
                  >
                    <Copy size={13} />
                  </button>
                  <a
                    href={`mailto:${app.email}`}
                    className="p-1.5 rounded-md hover:bg-sky-100 text-muted-foreground hover:text-sky-600 transition-colors"
                    title="Send email"
                  >
                    <Mail size={13} />
                  </a>
                </div>
              </div>

              {app.phone && (
                <div className="flex items-center justify-between gap-2 bg-background border rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Phone size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-sm truncate font-medium">{app.phone}</span>
                  </div>
                  <button
                    onClick={() => copy(app.phone!, "phone")}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title="Copy phone"
                  >
                    {copied === "phone" ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  </button>
                </div>
              )}
            </div>

            {/* Raw details */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
              <div><span className="font-medium text-foreground">Citizenship:</span> {app.citizenship_status}</div>
              <div><span className="font-medium text-foreground">US Worker:</span> {app.is_us_worker ? "Yes" : "No"}</div>
              <div><span className="font-medium text-foreground">H-2 seasons:</span> {app.h2b_visa_count}</div>
            </div>

            {/* Action buttons */}
            {!isTerminal && (
              <div className="flex flex-wrap gap-2 pt-1">
                {app.application_status !== "shortlisted" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
                    onClick={() => onStatusChange(app, "shortlisted")}
                  >
                    <Star size={13} /> Shortlist
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-sky-300 text-sky-700 hover:bg-sky-50"
                  onClick={() => onStatusChange(app, "contacted")}
                >
                  <Mail size={13} /> Mark as contacted
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => onStatusChange(app, "hired")}
                >
                  <CheckCircle2 size={13} /> Mark as hired
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 ml-auto"
                  onClick={() => setRejectOpen(true)}
                >
                  <XCircle size={13} /> Reject
                </Button>
              </div>
            )}

            {/* Copied toast */}
            {copied === "email" && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={12} /> Email copied
              </p>
            )}
          </div>
        )}
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
          <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
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
                  : "bg-background text-muted-foreground border-border hover:border-muted-foreground/40"
              }`}
            >
              {f.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filter === f.value ? "bg-background/20" : "bg-muted"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {filtered.map((app) => (
          <CandidateCard key={app.id} app={app} onStatusChange={onStatusChange} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">No applicants in this category.</p>
      )}
    </div>
  );
}

// missing import used in empty state
function Users(props: { size: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size} height={props.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
