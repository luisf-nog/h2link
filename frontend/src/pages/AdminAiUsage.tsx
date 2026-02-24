import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/number";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { Loader2, ShieldAlert, Brain, FileText, Mail, Sparkles, Users, TrendingUp, DollarSign, Crown } from "lucide-react";

/* ── types ── */
interface DailyUsageRow {
  user_id: string;
  usage_date: string;
  template_generations: number;
  resume_parses: number;
  job_email_generations: number;
  resume_conversions: number;
}

interface ProfileInfo {
  id: string;
  email: string;
  full_name: string | null;
  plan_tier: string;
}

/* ── cost model ── */
const MODEL_COSTS = {
  "flash-lite": { input: 0.000075, output: 0.0003 },
  "flash": { input: 0.00015, output: 0.0006 },
};

const AVG_TOKENS: Record<string, { input: number; output: number; model: keyof typeof MODEL_COSTS }> = {
  template: { input: 800, output: 400, model: "flash-lite" },
  resume: { input: 2000, output: 500, model: "flash-lite" },
  job_email: { input: 3000, output: 800, model: "flash" },
  resume_conversion: { input: 5000, output: 2000, model: "flash" },
};

function costForType(type: string, count: number): number {
  const t = AVG_TOKENS[type];
  if (!t) return 0;
  const m = MODEL_COSTS[t.model];
  return count * ((t.input / 1000) * m.input + (t.output / 1000) * m.output);
}

function totalCost(row: { template_generations: number; resume_parses: number; job_email_generations: number; resume_conversions: number }) {
  return costForType("template", row.template_generations)
    + costForType("resume", row.resume_parses)
    + costForType("job_email", row.job_email_generations)
    + costForType("resume_conversion", row.resume_conversions);
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4, 280 65% 60%))",
];

const PLAN_COLORS: Record<string, string> = {
  free: "secondary",
  gold: "default",
  diamond: "default",
  black: "destructive",
};

/* ── component ── */
export default function AdminAiUsage() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState<DailyUsageRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileInfo>>(new Map());
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("30d");
  const [tab, setTab] = useState<"overview" | "users" | "daily">("overview");

  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate("/dashboard");
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (adminLoading || !isAdmin) return;

    async function fetchData() {
      setLoading(true);

      let query = supabase
        .from("ai_daily_usage")
        .select("*")
        .order("usage_date", { ascending: true });

      if (period === "7d") {
        query = query.gte("usage_date", format(subDays(new Date(), 7), "yyyy-MM-dd"));
      } else if (period === "30d") {
        query = query.gte("usage_date", format(subDays(new Date(), 30), "yyyy-MM-dd"));
      }

      const { data: daily } = await query;
      const rows = (daily as DailyUsageRow[]) || [];
      setDailyData(rows);

      // Fetch profile info for all unique user IDs
      const userIds = [...new Set(rows.map(r => r.user_id))];
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, email, full_name, plan_tier")
          .in("id", userIds);

        const map = new Map<string, ProfileInfo>();
        (profs || []).forEach((p: any) => map.set(p.id, p));
        setProfiles(map);
      }

      setLoading(false);
    }

    fetchData();
  }, [isAdmin, adminLoading, period]);

  /* ── derived data ── */
  const totals = useMemo(() => {
    const t = { templates: 0, resumes: 0, emails: 0, conversions: 0 };
    dailyData.forEach(r => {
      t.templates += r.template_generations || 0;
      t.resumes += r.resume_parses || 0;
      t.emails += r.job_email_generations || 0;
      t.conversions += r.resume_conversions || 0;
    });
    return t;
  }, [dailyData]);

  const totalGenerations = totals.templates + totals.resumes + totals.emails + totals.conversions;
  const estimatedCost = costForType("template", totals.templates) + costForType("resume", totals.resumes) + costForType("job_email", totals.emails) + costForType("resume_conversion", totals.conversions);

  // Per-function cost breakdown
  const costBreakdown = useMemo(() => [
    { name: "Templates", count: totals.templates, cost: costForType("template", totals.templates), model: "flash-lite", icon: "✏️" },
    { name: "Parse Currículo", count: totals.resumes, cost: costForType("resume", totals.resumes), model: "flash-lite", icon: "📄" },
    { name: "E-mails Personalizados", count: totals.emails, cost: costForType("job_email", totals.emails), model: "flash", icon: "📧" },
    { name: "Conversão Currículo", count: totals.conversions, cost: costForType("resume_conversion", totals.conversions), model: "flash", icon: "🔄" },
  ].sort((a, b) => b.cost - a.cost), [totals]);

  // Daily chart data
  const chartData = useMemo(() => {
    const byDate = new Map<string, { date: string; Templates: number; Parse: number; Emails: number; Conversão: number; cost: number }>();
    dailyData.forEach(r => {
      const key = r.usage_date;
      const existing = byDate.get(key) || { date: format(new Date(key), "dd/MM"), Templates: 0, Parse: 0, Emails: 0, Conversão: 0, cost: 0 };
      existing.Templates += r.template_generations || 0;
      existing.Parse += r.resume_parses || 0;
      existing.Emails += r.job_email_generations || 0;
      existing.Conversão += r.resume_conversions || 0;
      existing.cost += totalCost(r);
      byDate.set(key, existing);
    });
    return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  }, [dailyData]);

  // Pie chart data
  const pieData = useMemo(() =>
    [
      { name: "Templates", value: totals.templates },
      { name: "Parse", value: totals.resumes },
      { name: "E-mails", value: totals.emails },
      { name: "Conversão", value: totals.conversions },
    ].filter(d => d.value > 0),
    [totals]
  );

  // Top users aggregated
  const topUsers = useMemo(() => {
    const map = new Map<string, { userId: string; templates: number; resumes: number; emails: number; conversions: number; total: number; cost: number }>();
    dailyData.forEach(r => {
      const existing = map.get(r.user_id) || { userId: r.user_id, templates: 0, resumes: 0, emails: 0, conversions: 0, total: 0, cost: 0 };
      existing.templates += r.template_generations || 0;
      existing.resumes += r.resume_parses || 0;
      existing.emails += r.job_email_generations || 0;
      existing.conversions += r.resume_conversions || 0;
      existing.total += (r.template_generations || 0) + (r.resume_parses || 0) + (r.job_email_generations || 0) + (r.resume_conversions || 0);
      existing.cost += totalCost(r);
      map.set(r.user_id, existing);
    });
    return [...map.values()].sort((a, b) => b.cost - a.cost);
  }, [dailyData]);

  const uniqueUsers = new Set(dailyData.map(r => r.user_id)).size;

  // Cost pie data
  const costPieData = useMemo(() =>
    costBreakdown.filter(c => c.cost > 0).map(c => ({ name: c.name, value: parseFloat(c.cost.toFixed(4)) })),
    [costBreakdown]
  );

  /* ── guards ── */
  if (adminLoading || (!isAdmin && !adminLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        {adminLoading ? <Loader2 className="w-8 h-8 animate-spin text-primary" /> : (
          <div className="text-center space-y-4">
            <ShieldAlert className="w-16 h-16 mx-auto text-destructive" />
            <h2 className="text-xl font-semibold">Acesso Restrito</h2>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6" />
            Dashboard de Uso de IA
          </h1>
          <p className="text-muted-foreground text-sm">
            Custos, volumes e consumo por usuário
          </p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <TabsList>
            <TabsTrigger value="7d">7 dias</TabsTrigger>
            <TabsTrigger value="30d">30 dias</TabsTrigger>
            <TabsTrigger value="all">Tudo</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> Total Gerações</CardDescription>
            <CardTitle className="text-3xl">{formatNumber(totalGenerations)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Users className="w-3 h-3" /> Usuários Ativos</CardDescription>
            <CardTitle className="text-3xl">{formatNumber(uniqueUsers)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Média/Dia</CardDescription>
            <CardTitle className="text-3xl">{chartData.length > 0 ? formatNumber(Math.round(totalGenerations / chartData.length)) : 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> Custo/Geração</CardDescription>
            <CardTitle className="text-3xl">${totalGenerations > 0 ? (estimatedCost / totalGenerations).toFixed(5) : "0"}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> Custo Total Est.</CardDescription>
            <CardTitle className="text-3xl text-primary">${estimatedCost.toFixed(4)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="overview">📊 Visão Geral</TabsTrigger>
          <TabsTrigger value="users">👥 Por Usuário</TabsTrigger>
          <TabsTrigger value="daily">📋 Log Diário</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Cost Breakdown by Function */}
          <Card>
            <CardHeader>
              <CardTitle>💰 Custo por Função (o que gasta mais?)</CardTitle>
              <CardDescription>Ranking de custo estimado por tipo de geração</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {costBreakdown.map((item, i) => {
                  const pct = estimatedCost > 0 ? (item.cost / estimatedCost) * 100 : 0;
                  return (
                    <div key={item.name} className="flex items-center gap-4">
                      <span className="text-2xl w-8">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{item.name}</span>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-muted-foreground">{formatNumber(item.count)} chamadas</span>
                            <Badge variant="outline" className="font-mono text-xs">{item.model}</Badge>
                            <span className="font-bold">${item.cost.toFixed(4)}</span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Gerações por Dia</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }} />
                      <Legend />
                      <Bar dataKey="Templates" stackId="a" fill={COLORS[0]} />
                      <Bar dataKey="Parse" stackId="a" fill={COLORS[1]} />
                      <Bar dataKey="Emails" stackId="a" fill={COLORS[2]} />
                      <Bar dataKey="Conversão" stackId="a" fill={COLORS[3]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Custo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={costPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {costPieData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: number) => `$${val.toFixed(4)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cost over time */}
          <Card>
            <CardHeader>
              <CardTitle>📈 Custo Estimado por Dia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `$${v.toFixed(3)}`} />
                    <Tooltip formatter={(val: number) => `$${val.toFixed(4)}`} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }} />
                    <Area type="monotone" dataKey="cost" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} name="Custo ($)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* USERS TAB */}
        <TabsContent value="users" className="space-y-6 mt-4">
          {/* Top 3 highlight */}
          {topUsers.length >= 3 && (
            <div className="grid gap-4 md:grid-cols-3">
              {topUsers.slice(0, 3).map((u, i) => {
                const p = profiles.get(u.userId);
                const medals = ["🥇", "🥈", "🥉"];
                return (
                  <Card key={u.userId} className={i === 0 ? "border-primary/30 bg-primary/5" : ""}>
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2">
                        <span className="text-xl">{medals[i]}</span>
                        <Badge variant={PLAN_COLORS[p?.plan_tier || "free"] as any} className="text-xs uppercase">{p?.plan_tier || "?"}</Badge>
                      </CardDescription>
                      <CardTitle className="text-lg truncate">{p?.full_name || "Sem nome"}</CardTitle>
                      <p className="text-xs text-muted-foreground truncate">{p?.email || u.userId.slice(0, 16)}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold">{formatNumber(u.total)}</span>
                        <span className="text-sm font-mono text-primary">${u.cost.toFixed(4)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {u.templates > 0 && <Badge variant="outline" className="text-xs">✏️ {u.templates}</Badge>}
                        {u.resumes > 0 && <Badge variant="outline" className="text-xs">📄 {u.resumes}</Badge>}
                        {u.emails > 0 && <Badge variant="outline" className="text-xs">📧 {u.emails}</Badge>}
                        {u.conversions > 0 && <Badge variant="outline" className="text-xs">🔄 {u.conversions}</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Full ranking table */}
          <Card>
            <CardHeader>
              <CardTitle>👥 Ranking Completo de Usuários</CardTitle>
              <CardDescription>{topUsers.length} usuários com uso no período</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead className="text-right">✏️ Templates</TableHead>
                    <TableHead className="text-right">📄 Parse</TableHead>
                    <TableHead className="text-right">📧 E-mails</TableHead>
                    <TableHead className="text-right">🔄 Conversão</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Custo Est.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum dado.</TableCell>
                    </TableRow>
                  ) : (
                    topUsers.map((u, i) => {
                      const p = profiles.get(u.userId);
                      return (
                        <TableRow key={u.userId}>
                          <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="font-medium truncate max-w-[200px]">{p?.full_name || "—"}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{p?.email || u.userId.slice(0, 16)}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={PLAN_COLORS[p?.plan_tier || "free"] as any} className="text-xs uppercase">{p?.plan_tier || "?"}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{u.templates || "—"}</TableCell>
                          <TableCell className="text-right">{u.resumes || "—"}</TableCell>
                          <TableCell className="text-right">{u.emails || "—"}</TableCell>
                          <TableCell className="text-right">{u.conversions || "—"}</TableCell>
                          <TableCell className="text-right font-bold">{formatNumber(u.total)}</TableCell>
                          <TableCell className="text-right font-mono text-primary">${u.cost.toFixed(4)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DAILY LOG TAB */}
        <TabsContent value="daily" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>📋 Log Detalhado por Dia</CardTitle>
              <CardDescription>Cada linha = 1 usuário em 1 dia</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead className="text-right">✏️</TableHead>
                    <TableHead className="text-right">📄</TableHead>
                    <TableHead className="text-right">📧</TableHead>
                    <TableHead className="text-right">🔄</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum dado no período.</TableCell>
                    </TableRow>
                  ) : (
                    [...dailyData].sort((a, b) => b.usage_date.localeCompare(a.usage_date)).map((row, i) => {
                      const p = profiles.get(row.user_id);
                      const rowTotal = (row.template_generations || 0) + (row.resume_parses || 0) + (row.job_email_generations || 0) + (row.resume_conversions || 0);
                      const rowCost = totalCost(row);
                      return (
                        <TableRow key={`${row.user_id}-${row.usage_date}-${i}`}>
                          <TableCell className="whitespace-nowrap">{format(new Date(row.usage_date), "dd/MM/yyyy")}</TableCell>
                          <TableCell>
                            <p className="text-sm font-medium truncate max-w-[160px]">{p?.full_name || "—"}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[160px]">{p?.email || row.user_id.slice(0, 12)}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant={PLAN_COLORS[p?.plan_tier || "free"] as any} className="text-xs uppercase">{p?.plan_tier || "?"}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{row.template_generations || "—"}</TableCell>
                          <TableCell className="text-right">{row.resume_parses || "—"}</TableCell>
                          <TableCell className="text-right">{row.job_email_generations || "—"}</TableCell>
                          <TableCell className="text-right">{row.resume_conversions || "—"}</TableCell>
                          <TableCell className="text-right font-bold">{rowTotal}</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">${rowCost.toFixed(4)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
