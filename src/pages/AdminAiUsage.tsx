import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/number";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Loader2, ShieldAlert, Brain, FileText, Mail, Sparkles } from "lucide-react";

interface UsageData {
  usage_date: string;
  total_template_generations: number;
  total_resume_parses: number;
  total_job_email_generations: number;
  unique_users: number;
}

interface DailyUsageRow {
  user_id: string;
  usage_date: string;
  template_generations: number;
  resume_parses: number;
  job_email_generations: number;
}

// Model cost estimates per 1000 tokens (in USD)
const MODEL_COSTS = {
  "gemini-2.5-flash-lite": { input: 0.000075, output: 0.0003 },
  "gemini-2.5-flash": { input: 0.00015, output: 0.0006 },
};

// Average tokens per function call (estimated)
const AVG_TOKENS = {
  resume: { input: 2000, output: 500 },
  template: { input: 800, output: 400 },
  job_email: { input: 3000, output: 800 },
};

function estimateCost(resumeParses: number, templateGens: number, jobEmails: number): number {
  // Resume parses use flash-lite
  const resumeCost = resumeParses * (
    (AVG_TOKENS.resume.input / 1000) * MODEL_COSTS["gemini-2.5-flash-lite"].input +
    (AVG_TOKENS.resume.output / 1000) * MODEL_COSTS["gemini-2.5-flash-lite"].output
  );
  
  // Template generations use flash-lite
  const templateCost = templateGens * (
    (AVG_TOKENS.template.input / 1000) * MODEL_COSTS["gemini-2.5-flash-lite"].input +
    (AVG_TOKENS.template.output / 1000) * MODEL_COSTS["gemini-2.5-flash-lite"].output
  );
  
  // Job emails use flash (standard)
  const jobEmailCost = jobEmails * (
    (AVG_TOKENS.job_email.input / 1000) * MODEL_COSTS["gemini-2.5-flash"].input +
    (AVG_TOKENS.job_email.output / 1000) * MODEL_COSTS["gemini-2.5-flash"].output
  );
  
  return resumeCost + templateCost + jobEmailCost;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))"];

export default function AdminAiUsage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<UsageData[]>([]);
  const [dailyData, setDailyData] = useState<DailyUsageRow[]>([]);
  const [period, setPeriod] = useState<"7d" | "30d" | "month">("7d");

  useEffect(() => {
    if (isAdmin === false) {
      navigate("/dashboard");
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    
    async function fetchData() {
      setLoading(true);
      
      let startDate: string;
      let endDate: string = format(new Date(), "yyyy-MM-dd");
      
      if (period === "7d") {
        startDate = format(subDays(new Date(), 7), "yyyy-MM-dd");
      } else if (period === "30d") {
        startDate = format(subDays(new Date(), 30), "yyyy-MM-dd");
      } else {
        startDate = format(startOfMonth(new Date()), "yyyy-MM-dd");
        endDate = format(endOfMonth(new Date()), "yyyy-MM-dd");
      }

      // Fetch aggregated data from view
      const { data: summary } = await supabase
        .from("ai_usage_summary")
        .select("*")
        .gte("usage_date", startDate)
        .lte("usage_date", endDate)
        .order("usage_date", { ascending: true });

      // Fetch detailed daily data
      const { data: daily } = await supabase
        .from("ai_daily_usage")
        .select("*")
        .gte("usage_date", startDate)
        .lte("usage_date", endDate)
        .order("usage_date", { ascending: false });

      setSummaryData((summary as UsageData[]) || []);
      setDailyData((daily as DailyUsageRow[]) || []);
      setLoading(false);
    }

    fetchData();
  }, [isAdmin, period]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <ShieldAlert className="w-16 h-16 mx-auto text-destructive" />
          <h2 className="text-xl font-semibold">Acesso Restrito</h2>
          <p className="text-muted-foreground">Esta página é exclusiva para administradores.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Calculate totals
  const totals = summaryData.reduce(
    (acc, row) => ({
      templates: acc.templates + Number(row.total_template_generations || 0),
      resumes: acc.resumes + Number(row.total_resume_parses || 0),
      emails: acc.emails + Number(row.total_job_email_generations || 0),
      users: Math.max(acc.users, Number(row.unique_users || 0)),
    }),
    { templates: 0, resumes: 0, emails: 0, users: 0 }
  );

  const totalGenerations = totals.templates + totals.resumes + totals.emails;
  const estimatedCost = estimateCost(totals.resumes, totals.templates, totals.emails);

  // Chart data
  const chartData = summaryData.map((row) => ({
    date: format(new Date(row.usage_date), "dd/MM"),
    Templates: Number(row.total_template_generations || 0),
    Currículos: Number(row.total_resume_parses || 0),
    "E-mails": Number(row.total_job_email_generations || 0),
  }));

  const pieData = [
    { name: "Templates", value: totals.templates },
    { name: "Currículos", value: totals.resumes },
    { name: "E-mails", value: totals.emails },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6" />
            Dashboard de Uso de IA
          </h1>
          <p className="text-muted-foreground">
            Monitoramento de custos e gerações por função
          </p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <TabsList>
            <TabsTrigger value="7d">7 dias</TabsTrigger>
            <TabsTrigger value="30d">30 dias</TabsTrigger>
            <TabsTrigger value="month">Este mês</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de Gerações</CardDescription>
            <CardTitle className="text-3xl">{formatNumber(totalGenerations)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              <Sparkles className="w-3 h-3 inline mr-1" />
              Todas as funções
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Currículos Analisados</CardDescription>
            <CardTitle className="text-3xl">{formatNumber(totals.resumes)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              <FileText className="w-3 h-3 inline mr-1" />
              gemini-2.5-flash-lite
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Templates Gerados</CardDescription>
            <CardTitle className="text-3xl">{formatNumber(totals.templates)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              <FileText className="w-3 h-3 inline mr-1" />
              gemini-2.5-flash-lite
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>E-mails Personalizados</CardDescription>
            <CardTitle className="text-3xl">{formatNumber(totals.emails)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              <Mail className="w-3 h-3 inline mr-1" />
              gemini-2.5-flash
            </p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription>Custo Estimado</CardDescription>
            <CardTitle className="text-3xl text-primary">
              ${estimatedCost.toFixed(4)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Baseado em tokens médios
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Gerações por Dia</CardTitle>
            <CardDescription>Volume de uso de cada função de IA</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="Templates" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Currículos" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="E-mails" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição</CardTitle>
            <CardDescription>Por tipo de função</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes por Usuário</CardTitle>
          <CardDescription>Uso individual de cada função de IA</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead className="text-right">Templates</TableHead>
                <TableHead className="text-right">Currículos</TableHead>
                <TableHead className="text-right">E-mails</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Custo Est.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum dado de uso encontrado para o período selecionado.
                  </TableCell>
                </TableRow>
              ) : (
                dailyData.map((row, i) => {
                  const rowTotal = (row.template_generations || 0) + (row.resume_parses || 0) + (row.job_email_generations || 0);
                  const rowCost = estimateCost(row.resume_parses || 0, row.template_generations || 0, row.job_email_generations || 0);
                  return (
                    <TableRow key={`${row.user_id}-${row.usage_date}-${i}`}>
                      <TableCell>{format(new Date(row.usage_date), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="font-mono text-xs">{row.user_id.slice(0, 8)}...</TableCell>
                      <TableCell className="text-right">{row.template_generations || 0}</TableCell>
                      <TableCell className="text-right">{row.resume_parses || 0}</TableCell>
                      <TableCell className="text-right">{row.job_email_generations || 0}</TableCell>
                      <TableCell className="text-right font-medium">{rowTotal}</TableCell>
                      <TableCell className="text-right text-muted-foreground">${rowCost.toFixed(4)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Model Info */}
      <Card>
        <CardHeader>
          <CardTitle>Modelos de IA em Uso</CardTitle>
          <CardDescription>Configuração atual do Lovable AI Gateway</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg border bg-muted/50">
              <h4 className="font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                parse-resume
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                google/gemini-2.5-flash-lite
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Extração de JSON estruturado de currículos
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-muted/50">
              <h4 className="font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                generate-template
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                google/gemini-2.5-flash-lite
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Geração de templates genéricos de e-mail
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-muted/50">
              <h4 className="font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" />
                generate-job-email
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                google/gemini-2.5-flash
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Escrita criativa de e-mails personalizados (Black plan)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
