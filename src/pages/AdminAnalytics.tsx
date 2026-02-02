import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNumber } from "@/lib/number";
import { format, subDays, formatDistanceToNow } from "date-fns";
import { ptBR, es } from "date-fns/locale";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart 
} from "recharts";
import { 
  Loader2, Users, DollarSign, Mail, TrendingUp, Download, 
  Filter, ArrowUpDown, Calendar, Crown, Zap 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface UserAnalytics {
  id: string;
  email: string;
  full_name: string | null;
  plan_tier: string;
  created_at: string;
  last_viewed_at: string | null;
  credits_used_today: number;
  total_ai_cost: number;
  total_emails_sent: number;
  queue_count: number;
  is_active: boolean;
}

interface DashboardStats {
  total_users: number;
  active_users_7d: number;
  active_users_30d: number;
  total_ai_cost: number;
  monthly_ai_cost: number;
  emails_sent_today: number;
  emails_sent_month: number;
  total_queue_items: number;
}

interface PlanDistribution {
  plan: string;
  count: number;
  percentage: number;
}

interface UserGrowth {
  date: string;
  users: number;
  cumulative: number;
}

const COLORS = {
  free: "hsl(var(--muted-foreground))",
  gold: "hsl(var(--chart-1))",
  diamond: "hsl(var(--chart-2))",
  black: "hsl(var(--chart-3))",
};

// Model cost estimates (same as AdminAiUsage)
const MODEL_COSTS = {
  "gemini-2.5-flash-lite": { input: 0.000075, output: 0.0003 },
  "gemini-2.5-flash": { input: 0.00015, output: 0.0006 },
};

const AVG_TOKENS = {
  resume: { input: 2000, output: 500 },
  template: { input: 800, output: 400 },
  job_email: { input: 3000, output: 800 },
};

export default function AdminAnalytics() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserAnalytics[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [planDistribution, setPlanDistribution] = useState<PlanDistribution[]>([]);
  const [userGrowth, setUserGrowth] = useState<UserGrowth[]>([]);
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("30d");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"created" | "active" | "cost" | "emails">("cost");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const locale = i18n.language === "pt" ? ptBR : i18n.language === "es" ? es : undefined;

  useEffect(() => {
    if (!adminLoading && isAdmin === false) {
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (adminLoading || !isAdmin) return;
    fetchAnalytics();
  }, [isAdmin, adminLoading, period, planFilter, sortBy, sortDir]);

  async function fetchAnalytics() {
    setLoading(true);
    try {
      // Fetch all users with their data
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch AI usage data
      const { data: aiUsage, error: aiError } = await supabase
        .from('ai_daily_usage')
        .select('*');

      if (aiError) throw aiError;

      // Fetch queue data
      const { data: queueData, error: queueError } = await supabase
        .from('my_queue')
        .select('user_id, status, sent_at');

      if (queueError) throw queueError;

      // Process data
      const now = new Date();
      const sevenDaysAgo = subDays(now, 7);
      const thirtyDaysAgo = subDays(now, 30);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Calculate AI costs per user
      const aiCostsByUser = new Map<string, number>();
      aiUsage?.forEach(usage => {
        const cost = estimateAICost(
          usage.resume_parses,
          usage.template_generations,
          usage.job_email_generations
        );
        aiCostsByUser.set(
          usage.user_id, 
          (aiCostsByUser.get(usage.user_id) || 0) + cost
        );
      });

      // Calculate emails sent per user
      const emailsByUser = new Map<string, number>();
      queueData?.forEach(item => {
        if (item.sent_at) {
          emailsByUser.set(
            item.user_id,
            (emailsByUser.get(item.user_id) || 0) + 1
          );
        }
      });

      // Queue count per user
      const queueCountByUser = new Map<string, number>();
      queueData?.forEach(item => {
        queueCountByUser.set(
          item.user_id,
          (queueCountByUser.get(item.user_id) || 0) + 1
        );
      });

      // Build user analytics
      let userAnalytics: UserAnalytics[] = profiles?.map(profile => {
        const lastViewed = profile.last_viewed_at ? new Date(profile.last_viewed_at) : null;
        const isActive7d = lastViewed ? lastViewed >= sevenDaysAgo : false;
        const isActive30d = lastViewed ? lastViewed >= thirtyDaysAgo : false;

        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          plan_tier: profile.plan_tier,
          created_at: profile.created_at,
          last_viewed_at: profile.last_viewed_at,
          credits_used_today: profile.credits_used_today,
          total_ai_cost: aiCostsByUser.get(profile.id) || 0,
          total_emails_sent: emailsByUser.get(profile.id) || 0,
          queue_count: queueCountByUser.get(profile.id) || 0,
          is_active: isActive30d,
        };
      }) || [];

      // Apply filters
      if (planFilter !== "all") {
        userAnalytics = userAnalytics.filter(u => u.plan_tier === planFilter);
      }

      if (period === "7d") {
        userAnalytics = userAnalytics.filter(u => {
          const lastViewed = u.last_viewed_at ? new Date(u.last_viewed_at) : null;
          return lastViewed && lastViewed >= sevenDaysAgo;
        });
      } else if (period === "30d") {
        userAnalytics = userAnalytics.filter(u => {
          const lastViewed = u.last_viewed_at ? new Date(u.last_viewed_at) : null;
          return lastViewed && lastViewed >= thirtyDaysAgo;
        });
      }

      // Sort
      userAnalytics.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case "created":
            comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            break;
          case "active":
            const aTime = a.last_viewed_at ? new Date(a.last_viewed_at).getTime() : 0;
            const bTime = b.last_viewed_at ? new Date(b.last_viewed_at).getTime() : 0;
            comparison = aTime - bTime;
            break;
          case "cost":
            comparison = a.total_ai_cost - b.total_ai_cost;
            break;
          case "emails":
            comparison = a.total_emails_sent - b.total_emails_sent;
            break;
        }
        return sortDir === "desc" ? -comparison : comparison;
      });

      setUsers(userAnalytics);

      // Calculate dashboard stats
      const allUsers = profiles || [];
      const activeUsers7d = allUsers.filter(p => {
        const lastViewed = p.last_viewed_at ? new Date(p.last_viewed_at) : null;
        return lastViewed && lastViewed >= sevenDaysAgo;
      }).length;

      const activeUsers30d = allUsers.filter(p => {
        const lastViewed = p.last_viewed_at ? new Date(p.last_viewed_at) : null;
        return lastViewed && lastViewed >= thirtyDaysAgo;
      }).length;

      const totalAICost = Array.from(aiCostsByUser.values()).reduce((sum, cost) => sum + cost, 0);
      
      const monthlyAICost = aiUsage
        ?.filter(u => new Date(u.usage_date) >= startOfMonth)
        .reduce((sum, u) => {
          return sum + estimateAICost(u.resume_parses, u.template_generations, u.job_email_generations);
        }, 0) || 0;

      const emailsToday = queueData?.filter(q => {
        if (!q.sent_at) return false;
        const sentDate = new Date(q.sent_at);
        return sentDate.toDateString() === now.toDateString();
      }).length || 0;

      const emailsMonth = queueData?.filter(q => {
        if (!q.sent_at) return false;
        const sentDate = new Date(q.sent_at);
        return sentDate >= startOfMonth;
      }).length || 0;

      setStats({
        total_users: allUsers.length,
        active_users_7d: activeUsers7d,
        active_users_30d: activeUsers30d,
        total_ai_cost: totalAICost,
        monthly_ai_cost: monthlyAICost,
        emails_sent_today: emailsToday,
        emails_sent_month: emailsMonth,
        total_queue_items: queueData?.length || 0,
      });

      // Plan distribution
      const planCounts = new Map<string, number>();
      allUsers.forEach(u => {
        planCounts.set(u.plan_tier, (planCounts.get(u.plan_tier) || 0) + 1);
      });

      const planDist: PlanDistribution[] = Array.from(planCounts.entries()).map(([plan, count]) => ({
        plan,
        count,
        percentage: (count / allUsers.length) * 100,
      }));

      setPlanDistribution(planDist);

      // User growth over time
      const usersByDate = new Map<string, number>();
      allUsers.forEach(u => {
        const date = format(new Date(u.created_at), "yyyy-MM-dd");
        usersByDate.set(date, (usersByDate.get(date) || 0) + 1);
      });

      const sortedDates = Array.from(usersByDate.keys()).sort();
      let cumulative = 0;
      const growth: UserGrowth[] = sortedDates.map(date => {
        cumulative += usersByDate.get(date) || 0;
        return {
          date,
          users: usersByDate.get(date) || 0,
          cumulative,
        };
      });

      setUserGrowth(growth.slice(-30)); // Last 30 days

    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  }

  function estimateAICost(resumeParses: number, templateGens: number, jobEmails: number): number {
    const resumeCost = resumeParses * (
      (AVG_TOKENS.resume.input / 1000) * MODEL_COSTS["gemini-2.5-flash-lite"].input +
      (AVG_TOKENS.resume.output / 1000) * MODEL_COSTS["gemini-2.5-flash-lite"].output
    );
    
    const templateCost = templateGens * (
      (AVG_TOKENS.template.input / 1000) * MODEL_COSTS["gemini-2.5-flash-lite"].input +
      (AVG_TOKENS.template.output / 1000) * MODEL_COSTS["gemini-2.5-flash-lite"].output
    );
    
    const jobEmailCost = jobEmails * (
      (AVG_TOKENS.job_email.input / 1000) * MODEL_COSTS["gemini-2.5-flash"].input +
      (AVG_TOKENS.job_email.output / 1000) * MODEL_COSTS["gemini-2.5-flash"].output
    );
    
    return resumeCost + templateCost + jobEmailCost;
  }

  function exportToCSV() {
    const headers = ["Email", "Nome", "Plano", "Cadastro", "Último Acesso", "Custo IA (USD)", "Emails Enviados", "Itens na Fila"];
    const rows = users.map(u => [
      u.email,
      u.full_name || "-",
      u.plan_tier,
      format(new Date(u.created_at), "dd/MM/yyyy"),
      u.last_viewed_at ? format(new Date(u.last_viewed_at), "dd/MM/yyyy HH:mm") : "Nunca",
      `$${u.total_ai_cost.toFixed(4)}`,
      u.total_emails_sent.toString(),
      u.queue_count.toString(),
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `analytics_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Visão geral completa da plataforma</p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.total_users)}</div>
              <p className="text-xs text-muted-foreground">
                {stats.active_users_7d} ativos (7d)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Custo com IA</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.monthly_ai_cost.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                ${stats.total_ai_cost.toFixed(2)} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Emails Enviados</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.emails_sent_today)}</div>
              <p className="text-xs text-muted-foreground">
                {formatNumber(stats.emails_sent_month)} este mês
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Itens na Fila</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.total_queue_items)}</div>
              <p className="text-xs text-muted-foreground">
                Total na fila de envio
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Plan Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Plano</CardTitle>
                <CardDescription>Usuários em cada tier</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planDistribution}
                      dataKey="count"
                      nameKey="plan"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ plan, percentage }) => `${plan}: ${percentage.toFixed(1)}%`}
                    >
                      {planDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.plan as keyof typeof COLORS] || COLORS.free} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* User Growth */}
            <Card>
              <CardHeader>
                <CardTitle>Crescimento de Usuários</CardTitle>
                <CardDescription>Últimos 30 dias</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={userGrowth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => format(new Date(val), "dd/MM")}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(val) => format(new Date(val), "dd/MM/yyyy")}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="cumulative" 
                      stroke="hsl(var(--primary))" 
                      fill="hsl(var(--primary))"
                      fillOpacity={0.3}
                      name="Total de Usuários"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                  <CardTitle>Tabela de Usuários</CardTitle>
                  <CardDescription>{users.length} usuários listados</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
                    <SelectTrigger className="w-[140px]">
                      <Calendar className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">Últimos 7 dias</SelectItem>
                      <SelectItem value="30d">Últimos 30 dias</SelectItem>
                      <SelectItem value="all">Todo período</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={planFilter} onValueChange={setPlanFilter}>
                    <SelectTrigger className="w-[140px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos planos</SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="gold">Gold</SelectItem>
                      <SelectItem value="diamond">Diamond</SelectItem>
                      <SelectItem value="black">Black</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                    <SelectTrigger className="w-[160px]">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cost">Custo com IA</SelectItem>
                      <SelectItem value="emails">Emails enviados</SelectItem>
                      <SelectItem value="active">Último acesso</SelectItem>
                      <SelectItem value="created">Data cadastro</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
                  >
                    {sortDir === "desc" ? "↓" : "↑"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead>Último Acesso</TableHead>
                      <TableHead className="text-right">Custo IA</TableHead>
                      <TableHead className="text-right">Emails</TableHead>
                      <TableHead className="text-right">Fila</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhum usuário encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{user.full_name || "Sem nome"}</span>
                              <span className="text-sm text-muted-foreground">{user.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={user.plan_tier === "free" ? "outline" : "default"}
                              className={
                                user.plan_tier === "gold" ? "bg-yellow-500/10 text-yellow-700 border-yellow-500/30" :
                                user.plan_tier === "diamond" ? "bg-blue-500/10 text-blue-700 border-blue-500/30" :
                                user.plan_tier === "black" ? "bg-gray-900 text-white" : ""
                              }
                            >
                              {user.plan_tier === "gold" && <Crown className="h-3 w-3 mr-1" />}
                              {user.plan_tier === "diamond" && <Zap className="h-3 w-3 mr-1" />}
                              {user.plan_tier.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {format(new Date(user.created_at), "dd/MM/yyyy")}
                            </span>
                          </TableCell>
                          <TableCell>
                            {user.last_viewed_at ? (
                              <div className="flex flex-col">
                                <span className="text-sm">
                                  {formatDistanceToNow(new Date(user.last_viewed_at), { 
                                    addSuffix: true, 
                                    locale 
                                  })}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(user.last_viewed_at), "dd/MM HH:mm")}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Nunca</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono text-sm">
                              ${user.total_ai_cost.toFixed(4)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-medium">{formatNumber(user.total_emails_sent)}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-muted-foreground">{user.queue_count}</span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
