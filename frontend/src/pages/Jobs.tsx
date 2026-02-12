import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PLANS_CONFIG } from "@/config/plans.config";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { JobDetailsDialog, type JobDetails } from "@/components/jobs/JobDetailsDialog";
import { MobileJobCard } from "@/components/jobs/MobileJobCard";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsMobile } from "@/hooks/use-mobile";
import { Search, Plus, Check, Lock, ArrowUpDown, Loader2, Database, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/lib/number";
import { getVisaBadgeConfig, VISA_TYPE_OPTIONS, type VisaTypeFilter } from "@/lib/visaTypes";

export default function Jobs() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  const [jobs, setJobs] = useState<JobDetails[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queuedJobIds, setQueuedJobIds] = useState<Set<string>>(new Set());
  const [selectedJob, setSelectedJob] = useState<JobDetails | null>(null);

  const [visaType, setVisaType] = useState<VisaTypeFilter>(() => (searchParams.get("visa") as VisaTypeFilter) || "all");
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("q") ?? "");
  const [stateFilter, setStateFilter] = useState(() => searchParams.get("state") ?? "");
  const [cityFilter, setCityFilter] = useState(() => searchParams.get("city") ?? "");
  const [minSalary, setMinSalary] = useState(() => searchParams.get("min_salary") ?? "");
  const [groupFilter, setGroupFilter] = useState(() => searchParams.get("group") ?? "");
  const [page, setPage] = useState(() => Number(searchParams.get("page") || "1"));
  const [sortKey, setSortKey] = useState(searchParams.get("sort") || "posted_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">((searchParams.get("dir") as any) || "desc");

  const planTier = profile?.plan_tier || "free";
  const planSettings = PLANS_CONFIG[planTier].settings;
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const fetchJobs = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase.from("public_jobs").select("*", { count: "exact" }).eq("is_banned", false);

    query = query.order(sortKey, { ascending: sortDir === "asc" });
    if (visaType !== "all") query = query.eq("visa_type", visaType);
    if (searchTerm.trim()) query = query.or(`job_title.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%`);
    if (stateFilter.trim()) query = query.ilike("state", `%${stateFilter.trim()}%`);
    if (cityFilter.trim()) query = query.ilike("city", `%${cityFilter.trim()}%`);
    if (groupFilter) query = query.eq("randomization_group", groupFilter);
    if (minSalary) query = query.gte("salary", Number(minSalary));

    query = query.range(from, to);
    const { data, error, count } = await query;
    if (!error && data) {
      setJobs(data as JobDetails[]);
      setTotalCount(count ?? 0);
      if (profile?.id) {
        const { data: qData } = await supabase
          .from("my_queue")
          .select("job_id")
          .eq("user_id", profile.id)
          .in(
            "job_id",
            data.map((j) => j.id),
          );
        setQueuedJobIds(new Set((qData ?? []).map((q) => q.job_id)));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
  }, [visaType, searchTerm, stateFilter, cityFilter, groupFilter, minSalary, sortKey, sortDir, page]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString(i18n.language, { timeZone: "UTC" });
  };

  const addToQueue = async (job: JobDetails) => {
    if (!profile) {
      navigate("/auth");
      return;
    }
    const { error } = await supabase
      .from("my_queue")
      .insert({ user_id: profile.id, job_id: job.id, status: "pending" });
    if (!error) {
      setQueuedJobIds(new Set([...Array.from(queuedJobIds), job.id]));
      toast({ title: t("jobs.toasts.added") });
    }
  };

  return (
    <div className="space-y-4 px-4 py-2">
      <h1 className="text-xl font-bold text-slate-900">Jobs Hub</h1>

      {/* FILTROS COMPACTOS (IMAGEM 1) */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={visaType}
          onValueChange={(v: any) => {
            setVisaType(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px] h-8 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VISA_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative w-[280px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
          <Input
            placeholder="Search by role, company, city..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-8 h-8 text-[11px]"
          />
        </div>
        <Input
          placeholder="State (e.g., FL)"
          value={stateFilter}
          onChange={(e) => {
            setStateFilter(e.target.value);
            setPage(1);
          }}
          className="w-[140px] h-8 text-[11px]"
        />
        <Input
          placeholder="City"
          value={cityFilter}
          onChange={(e) => {
            setCityFilter(e.target.value);
            setPage(1);
          }}
          className="w-[140px] h-8 text-[11px]"
        />
        <Select
          value={groupFilter}
          onValueChange={(v) => {
            setGroupFilter(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[140px] h-8 text-[11px]">
            <SelectValue placeholder="Group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Groups</SelectItem>
            {["A", "B", "C", "D", "E", "F", "G"].map((g) => (
              <SelectItem key={g} value={g}>
                Group {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* TABELA DENSE (IMAGEM 1) */}
      {isMobile ? (
        <div className="space-y-3">
          {jobs.map((j) => (
            <MobileJobCard
              key={j.id}
              job={j as any}
              isBlurred={planSettings.job_db_blur}
              isQueued={queuedJobIds.has(j.id)}
              onAddToQueue={() => addToQueue(j)}
              onClick={() => setSelectedJob(j)}
              formatDate={formatDate}
            />
          ))}
        </div>
      ) : (
        <Card className="border-slate-100 shadow-none">
          <Table className="text-[11px]">
            <TableHeader className="bg-slate-50/50">
              <TableRow className="h-8">
                <TableHead
                  className="font-bold text-[9px] uppercase cursor-pointer"
                  onClick={() => toggleSort("job_title")}
                >
                  Role <ArrowUpDown className="inline h-2 w-2 ml-1" />
                </TableHead>
                <TableHead className="font-bold text-[9px] uppercase">Company</TableHead>
                <TableHead className="font-bold text-[9px] uppercase text-center">Openings</TableHead>
                <TableHead className="font-bold text-[9px] uppercase text-center">Salary</TableHead>
                <TableHead className="font-bold text-[9px] uppercase text-center">Start</TableHead>
                <TableHead className="font-bold text-[9px] uppercase text-center">End</TableHead>
                <TableHead className="font-bold text-[9px] uppercase text-center">Group</TableHead>
                <TableHead className="font-bold text-[9px] uppercase text-center">Exp.</TableHead>
                <TableHead className="font-bold text-[9px] uppercase text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((j) => (
                  <TableRow
                    key={j.id}
                    onClick={() => setSelectedJob(j)}
                    className="h-10 cursor-pointer hover:bg-slate-50 border-slate-50"
                  >
                    <TableCell className="font-semibold text-slate-700">{j.job_title}</TableCell>
                    <TableCell className={cn("text-slate-500", planSettings.job_db_blur && "blur-sm")}>
                      {j.company}
                    </TableCell>
                    <TableCell className="text-center">{j.openings}</TableCell>
                    <TableCell className="text-center font-bold text-emerald-600">
                      {j.salary ? `$${j.salary.toFixed(2)}/h` : "-"}
                    </TableCell>
                    <TableCell className="text-center text-slate-500">{formatDate(j.start_date)}</TableCell>
                    <TableCell className="text-center text-slate-500">{formatDate(j.end_date)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[9px] font-bold py-0 h-4">
                        G-{j.randomization_group || "?"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-slate-500">
                      {j.experience_months ? `${j.experience_months}m` : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToQueue(j);
                        }}
                      >
                        {queuedJobIds.has(j.id) ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <p>
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px]"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px]"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <JobDetailsDialog
        open={!!selectedJob}
        onOpenChange={(o: boolean) => !o && setSelectedJob(null)}
        job={selectedJob}
        planSettings={profile}
        formatSalary={(s: any) => `$${Number(s).toFixed(2)}/h`}
        onAddToQueue={addToQueue}
        isInQueue={selectedJob ? queuedJobIds.has(selectedJob.id) : false}
      />
    </div>
  );
}
