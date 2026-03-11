import { useState, useMemo } from "react";
import { getCountry } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Mail,
  MessageSquare,
  Phone,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
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

// Work auth badge - uses is_us_worker boolean for accuracy
function getWorkAuthBadge(_status: string, _isInUs: boolean, isUsWorker: boolean): { label: string; icon: "check" | "globe" | "alert" } | null {
  if (isUsWorker) {
    return { label: "US Worker", icon: "check" };
  }
  return { label: "Outside US", icon: "globe" };
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

const REJECTION_REASONS = [
  "Insufficient experience for the role",
  "Physical job requirements not met",
  "Unavailable for contract dates",
  "English proficiency insufficient for job duties",
  "Qualified U.S. worker selected",
  "Unsatisfactory work history or references",
  "Incomplete or inconsistent documentation",
  "Candidate did not respond to contact attempts",
  "Other (please specify)",
] as const;

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
  const [selected, setSelected] = useState("");
  const [customReason, setCustomReason] = useState("");
  const isOther = selected === "Other (please specify)";
  const finalReason = isOther ? customReason.trim() : selected;

  const handleClose = () => { setSelected(""); setCustomReason(""); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {app.full_name}?</DialogTitle>
          <DialogDescription>
            This action will be recorded in the recruitment log for DOL documentation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <label className="text-sm font-medium">Reason (required for compliance)</label>
          <Select value={selected} onValueChange={(v) => { setSelected(v); if (v !== "Other (please specify)") setCustomReason(""); }}>
            <SelectTrigger>
              <SelectValue placeholder="Select a reason…" />
            </SelectTrigger>
            <SelectContent>
              {REJECTION_REASONS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isOther && (
            <div className="space-y-1">
              <Textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value.slice(0, 150))}
                rows={3}
                placeholder="Describe the reason…"
                maxLength={150}
              />
              <p className="text-xs text-muted-foreground text-right">{customReason.length}/150</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!finalReason}
            onClick={() => { onConfirm(finalReason); setSelected(""); setCustomReason(""); }}
          >
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
  const workAuthBadge = getWorkAuthBadge(app.work_authorization_status, app.is_in_us, app.is_us_worker);

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

      {/* Desktop row */}
      <div className="hidden sm:flex items-center gap-3 p-3 bg-card border rounded-lg hover:shadow-sm transition-shadow">
        <div className={`${avatarColor(app.full_name)} w-9 h-9 rounded-full flex items-center justify-center text-foreground font-semibold text-xs shrink-0`}>
          {initials(app.full_name)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-foreground truncate flex items-center gap-1.5">
              {app.country_code && (() => {
                const c = getCountry(app.country_code);
                if (!c) return null;
                return c.code !== "OTHER" ? (
                  <img src={`https://flagcdn.com/w40/${c.code.toLowerCase()}.png`} alt={c.name} title={c.name} className="w-5 h-auto rounded-sm" />
                ) : (
                  <span className="text-base" title={c.name}>🌍</span>
                );
              })()}
              {app.full_name}
            </span>
            {app.application_match_score !== null && (
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${getMatchScoreStyle(app.application_match_score)}`}>
                {app.application_match_score}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span title={format(new Date(app.created_at), "PPpp")}>{format(new Date(app.created_at), "MMM d, h:mm a")}</span>
            <span>•</span>
            <span className="capitalize">{app.english_level ? `${app.english_level.charAt(0).toUpperCase() + app.english_level.slice(1)} English` : "—"}</span>
            <span>•</span>
            <span>{formatExperience(app.months_experience)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {workAuthBadge && (
            workAuthBadge.icon === "check" ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border-2 border-emerald-500 bg-background text-foreground whitespace-nowrap">
                <svg width="14" height="10" viewBox="0 0 14 10" className="shrink-0 rounded-[1px]" aria-label="US Flag">
                  <rect width="14" height="10" fill="#B22234" />
                  <rect y="0.77" width="14" height="0.77" fill="white" />
                  <rect y="2.31" width="14" height="0.77" fill="white" />
                  <rect y="3.85" width="14" height="0.77" fill="white" />
                  <rect y="5.38" width="14" height="0.77" fill="white" />
                  <rect y="6.92" width="14" height="0.77" fill="white" />
                  <rect y="8.46" width="14" height="0.77" fill="white" />
                  <rect width="5.6" height="4.62" fill="#3C3B6E" />
                </svg>
                US Worker
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border bg-muted text-muted-foreground border-border">
                {workAuthBadge.icon === "globe" && <Globe size={12} />}
                {workAuthBadge.icon === "alert" && <AlertCircle size={12} className="text-amber-600" />}
                {workAuthBadge.label}
              </span>
            )
          )}
        </div>

        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <a href={`mailto:${app.email}`} onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent transition-colors">
                  <Mail size={14} />
                </a>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p className="text-xs">Email</p></TooltipContent>
            </Tooltip>
            {app.phone && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a href={`sms:${app.phone}`} onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent transition-colors">
                      <MessageSquare size={14} />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p className="text-xs">Message</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a href={`tel:${app.phone}`} onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent transition-colors">
                      <Phone size={14} />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p className="text-xs">Call</p></TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </TooltipProvider>

        <Select value={app.application_status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
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

        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => onOpenDetail(app)}>
          <FileText size={14} />
          <span>Details</span>
        </Button>
      </div>

      {/* Mobile card */}
      <div className="sm:hidden bg-card border rounded-lg p-3 space-y-3">
        {/* Row 1: Avatar + Name + Match + Badge */}
        <div className="flex items-start gap-2.5">
          <div className={`${avatarColor(app.full_name)} w-9 h-9 rounded-full flex items-center justify-center text-foreground font-semibold text-xs shrink-0`}>
            {initials(app.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-sm text-foreground flex items-center gap-1">
                {app.country_code && (() => {
                  const c = getCountry(app.country_code);
                  if (!c) return null;
                  return c.code !== "OTHER" ? (
                    <img src={`https://flagcdn.com/w40/${c.code.toLowerCase()}.png`} alt={c.name} title={c.name} className="w-4 h-auto rounded-sm" />
                  ) : (
                    <span className="text-sm" title={c.name}>🌍</span>
                  );
                })()}
                {app.full_name}
              </span>
              {app.application_match_score !== null && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getMatchScoreStyle(app.application_match_score)}`}>
                  {app.application_match_score}%
                </span>
              )}
              {workAuthBadge && (
                workAuthBadge.icon === "check" ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border-2 border-emerald-500 bg-background text-foreground whitespace-nowrap">
                    <svg width="12" height="8" viewBox="0 0 14 10" className="shrink-0 rounded-[1px]" aria-label="US Flag">
                      <rect width="14" height="10" fill="#B22234" />
                      <rect y="0.77" width="14" height="0.77" fill="white" />
                      <rect y="2.31" width="14" height="0.77" fill="white" />
                      <rect y="3.85" width="14" height="0.77" fill="white" />
                      <rect y="5.38" width="14" height="0.77" fill="white" />
                      <rect y="6.92" width="14" height="0.77" fill="white" />
                      <rect y="8.46" width="14" height="0.77" fill="white" />
                      <rect width="5.6" height="4.62" fill="#3C3B6E" />
                    </svg>
                    US
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-muted text-muted-foreground border-border">
                    <Globe size={10} />
                    {workAuthBadge.label}
                  </span>
                )
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
              <span>{format(new Date(app.created_at), "MMM d, h:mm a")}</span>
              <span>•</span>
              <span className="capitalize">{app.english_level ? `${app.english_level.charAt(0).toUpperCase() + app.english_level.slice(1)} Eng` : "—"}</span>
              <span>•</span>
              <span>{formatExperience(app.months_experience)}</span>
            </div>
          </div>
        </div>

        {/* Row 2: Status + Contact actions + Details */}
        <div className="flex items-center gap-2">
          <Select value={app.application_status} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-8 text-xs flex-1 max-w-[130px]">
              <SelectValue />
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

          <div className="flex items-center gap-0.5 ml-auto">
            <a
              href={`mailto:${app.email}`}
              onClick={(e) => { e.stopPropagation(); window.location.href = `mailto:${app.email}`; }}
              className="p-2 rounded-md text-muted-foreground active:bg-accent transition-colors"
            >
              <Mail size={16} />
            </a>
            {app.phone && (
              <>
                <a
                  href={`sms:${app.phone}`}
                  onClick={(e) => { e.stopPropagation(); window.location.href = `sms:${app.phone}`; }}
                  className="p-2 rounded-md text-muted-foreground active:bg-accent transition-colors"
                >
                  <MessageSquare size={16} />
                </a>
                <a
                  href={`tel:${app.phone}`}
                  onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${app.phone}`; }}
                  className="p-2 rounded-md text-muted-foreground active:bg-accent transition-colors"
                >
                  <Phone size={16} />
                </a>
              </>
            )}
          </div>

          <Button size="sm" variant="outline" className="h-8 text-xs px-2.5" onClick={() => onOpenDetail(app)}>
            <FileText size={14} />
          </Button>
        </div>
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
  const [page, setPage] = useState(1);
  const [locationFilter, setLocationFilter] = useState<"all" | "us" | "outside">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "match_desc" | "match_asc" | "exp_desc">("newest");
  const PAGE_SIZE = 50;

  const filtered = useMemo(() => {
    let result = filter === "all" ? apps : apps.filter((a) => a.application_status === filter);
    
    if (locationFilter === "us") {
      result = result.filter(a => a.work_authorization_status !== "outside_us");
    } else if (locationFilter === "outside") {
      result = result.filter(a => a.work_authorization_status === "outside_us");
    }
    
    switch (sortBy) {
      case "oldest":
        // Keep current order (oldest first - ascending created_at)
        break;
      case "match_desc":
        result = [...result].sort((a, b) => (b.application_match_score ?? 0) - (a.application_match_score ?? 0));
        break;
      case "match_asc":
        result = [...result].sort((a, b) => (a.application_match_score ?? 0) - (b.application_match_score ?? 0));
        break;
      case "exp_desc":
        result = [...result].sort((a, b) => b.months_experience - a.months_experience);
        break;
      default: // newest - reverse chronological
        result = [...result].reverse();
        break;
    }
    return result;
  }, [apps, filter, locationFilter, sortBy]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
        {(() => {
          const usWorkers = apps.filter(a => a.work_authorization_status !== "outside_us");
          const usTotal = usWorkers.length;
          const usNew = usWorkers.filter(a => a.application_status === "received").length;
          const usContacted = usWorkers.filter(a => a.application_status === "contacted" || a.application_status === "shortlisted").length;
          const usFinalized = usWorkers.filter(a => a.application_status === "hired" || a.application_status === "rejected").length;
          const progressPct = usTotal > 0 ? Math.round(((usContacted + usFinalized) / usTotal) * 100) : 0;
          const newPct = usTotal > 0 ? Math.round((usNew / usTotal) * 100) : 0;
          const finalizedPct = usTotal > 0 ? Math.round((usFinalized / usTotal) * 100) : 0;
          const inProgressPct = usTotal > 0 ? Math.round((usContacted / usTotal) * 100) : 0;
          return (
            <div className="bg-card border rounded-lg p-3 text-center space-y-2">
              <div className="text-2xl font-bold text-foreground">{usTotal}</div>
              <div className="text-xs text-muted-foreground">US Workers</div>
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${finalizedPct}%` }}
                />
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${inProgressPct}%` }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight">
                <span className="font-semibold text-amber-600 dark:text-amber-400">{newPct}%</span> pending
                {" · "}
                <span className="font-semibold text-primary">{inProgressPct}%</span> in progress
                {" · "}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{finalizedPct}%</span> finalized
              </div>
            </div>
          );
        })()}
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

      {/* Filter pills - desktop: chips, mobile: dropdown */}
      <div className="hidden sm:flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const count = f.value === "all" ? apps.length : (counts[f.value] ?? 0);
          if (f.value !== "all" && count === 0) return null;
          return (
            <button
              key={f.value}
              onClick={() => { setFilter(f.value); setPage(1); }}
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
      <div className="sm:hidden">
        <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(1); }}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => {
              const count = f.value === "all" ? apps.length : (counts[f.value] ?? 0);
              if (f.value !== "all" && count === 0) return null;
              return (
                <SelectItem key={f.value} value={f.value} className="text-xs">
                  {f.label} ({count})
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Filter & Sort controls */}
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter
              {locationFilter !== "all" && (
                <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full">1</span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Location</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={locationFilter === "all"}
              onCheckedChange={() => { setLocationFilter("all"); setPage(1); }}
            >
              All locations
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={locationFilter === "us"}
              onCheckedChange={() => { setLocationFilter("us"); setPage(1); }}
            >
              US Workers only
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={locationFilter === "outside"}
              onCheckedChange={() => { setLocationFilter("outside"); setPage(1); }}
            >
              Outside US only
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuCheckboxItem
              checked={sortBy === "newest"}
              onCheckedChange={() => { setSortBy("newest"); setPage(1); }}
            >
              Newest first
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={sortBy === "oldest"}
              onCheckedChange={() => { setSortBy("oldest"); setPage(1); }}
            >
              Oldest first
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={sortBy === "match_desc"}
              onCheckedChange={() => { setSortBy("match_desc"); setPage(1); }}
            >
              <ArrowDown className="h-3 w-3 mr-1" /> Match score (high → low)
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={sortBy === "match_asc"}
              onCheckedChange={() => { setSortBy("match_asc"); setPage(1); }}
            >
              <ArrowUp className="h-3 w-3 mr-1" /> Match score (low → high)
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={sortBy === "exp_desc"}
              onCheckedChange={() => { setSortBy("exp_desc"); setPage(1); }}
            >
              Most experience first
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="text-xs text-muted-foreground ml-1">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-2">
        {paged.map((app) => (
          <CandidateRow
            key={app.id}
            app={app}
            onStatusChange={onStatusChange}
            onOpenDetail={setDetailApp}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({filtered.length} applicants)
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
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
