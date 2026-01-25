import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/lib/number";

type MappedJob = {
  job_id: string;
  visa_type: string;
  company: string;
  email: string;
  job_title: string;
  category: string | null;
  city: string;
  state: string;
  openings: number | null;
  salary: number | null;
  overtime_salary: number | null;
  source_url: string | null;
  phone: string | null;
  start_date: string | null;
  end_date: string | null;
  posted_date: string | null;
  experience_months: number | null;
  description: string | null;
  requirements: string | null;
  housing_info: string | null;
  transport_provided: boolean;
  tools_provided: boolean;
  weekly_hours: number | null;
  education_required: string | null;
  worksite_address: string | null;
  worksite_zip: string | null;
  job_duties: string | null;
  job_min_special_req: string | null;
  wage_additional: string | null;
  rec_pay_deductions: string | null;
};

/**
 * Mapeamento de colunas da planilha base para o schema esperado.
 * Atualize aqui conforme a estrutura real de `base_importacao.xlsx`.
 * Aceita múltiplas variantes de nome (em português e inglês).
 */
const COL_MAP: Record<keyof MappedJob, string[]> = {
  job_id: ["job_id", "JOB_ID", "Job ID", "ID"],
  visa_type: ["visa_type", "VISA_TYPE", "Visa", "Visto"],
  company: ["company", "COMPANY", "Empresa"],
  email: ["email", "EMAIL", "E-mail"],
  job_title: ["job_title", "JOB_TITLE", "Cargo", "Titulo", "Título"],
  category: ["category", "CATEGORY", "Categoria"],
  city: ["city", "CITY", "Cidade"],
  state: ["state", "STATE", "Estado", "UF"],
  openings: ["openings", "OPENINGS", "Vagas", "Aberturas"],
  salary: ["salary", "SALARY", "Salário", "Salario"],
  overtime_salary: ["overtime_salary", "OVERTIME_SALARY", "Hora extra", "Overtime"],
  source_url: ["source_url", "SOURCE_URL", "URL", "Fonte"],
  phone: ["phone", "PHONE", "Telefone"],
  // Algumas bases vêm com underscore no início (ex: "_end_date")
  // Também suportamos variações normalizadas (ex: "Start Date" -> "start_date", "Data Início" -> "data_inicio")
  start_date: [
    "start_date",
    "_start_date",
    "start date",
    "Start Date",
    "START_DATE",
    "data_inicio",
    "Data Início",
    "Data Inicio",
    "Início",
    "Inicio",
  ],
  end_date: [
    "end_date",
    "_end_date",
    "end date",
    "End Date",
    "END_DATE",
    "data_fim",
    "Fim",
    "Data Fim",
  ],
  posted_date: ["posted_date", "POSTED_DATE", "Postado", "Data Postagem"],
  experience_months: ["experience_months", "EXPERIENCE_MONTHS", "Experiência", "Experience"],
  description: ["description", "DESCRIPTION", "Descrição", "Descricao"],
  requirements: ["requirements", "REQUIREMENTS", "Requisitos"],
  housing_info: ["housing_info", "HOUSING_INFO", "Moradia", "Housing"],
  transport_provided: ["transport_provided", "TRANSPORT_PROVIDED", "Transporte"],
  tools_provided: ["tools_provided", "TOOLS_PROVIDED", "Ferramentas", "Tools"],
  weekly_hours: ["weekly_hours", "WEEKLY_HOURS", "Horas Semanais", "Horas"],
  education_required: ["education_required", "EDUCATION_REQUIRED", "Educação", "Educacao"],
  worksite_address: ["worksite_address", "WORKSITE_ADDRESS", "Endereço", "Endereco"],
  worksite_zip: ["worksite_zip", "WORKSITE_ZIP", "CEP", "Zip"],
  job_duties: ["job_duties", "JOB_DUTIES", "Tarefas", "Duties", "Funções"],
  job_min_special_req: ["jobMinspecialreq", "job_min_special_req", "JOB_MIN_SPECIAL_REQ", "Requisitos Especiais", "Special Requirements"],
  wage_additional: ["wageAdditional", "wage_additional", "WAGE_ADDITIONAL", "Salário Adicional", "Additional Wage"],
  rec_pay_deductions: ["recPayDeductions", "rec_pay_deductions", "REC_PAY_DEDUCTIONS", "Deduções", "Pay Deductions"],
};

function normalizeHeaderKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '_');
}

function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    // Mantém o original + adiciona versão normalizada para matching mais robusto
    out[k] = v;
    out[normalizeHeaderKey(k)] = v;
  }
  return out;
}

function pickValue(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (k in row) return row[k];
    const nk = normalizeHeaderKey(k);
    if (nk in row) return row[nk];
  }
  return undefined;
}

function parseDate(v: unknown): string | null {
  if (!v) return null;
  // Quando usamos sheet_to_json com { cellDates: true }, o XLSX pode devolver Date.
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  }
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (typeof v === "string" && v.trim()) {
    const s = v.trim();

    // Handles formats like "15/03/2026" and "21/01/2026 21:39"
    const matchBr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+\d{2}:\d{2})?$/);
    if (matchBr) {
      const [, dd, mm, yyyy] = matchBr;
      return `${yyyy}-${mm}-${dd}`;
    }

    const iso = new Date(s);
    if (!Number.isNaN(iso.getTime())) return iso.toISOString().slice(0, 10);
    return s;
  }
  return null;
}

function parseNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    // supports "12,92" and "12.92"
    const normalized = s.replace(/\./g, "").replace(/,/, ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseBool01(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["1", "true", "sim", "yes"].includes(s)) return true;
    if (["0", "false", "nao", "não", "no"].includes(s)) return false;
  }
  return Boolean(v);
}

function mapRow(row: Record<string, unknown>): MappedJob | null {
  const job_id = String(pickValue(row, COL_MAP.job_id) ?? "").trim();
  const company = String(pickValue(row, COL_MAP.company) ?? "").trim();
  const email = String(pickValue(row, COL_MAP.email) ?? "").trim();
  const job_title = String(pickValue(row, COL_MAP.job_title) ?? "").trim();
  const city = String(pickValue(row, COL_MAP.city) ?? "").trim();
  const state = String(pickValue(row, COL_MAP.state) ?? "").trim();

  // Campos obrigatórios
  if (!job_id || !company || !email || !job_title || !city || !state) return null;

  const salaryRaw = pickValue(row, COL_MAP.salary);
  const overtimeRaw = pickValue(row, COL_MAP.overtime_salary);
  const weeklyRaw = pickValue(row, COL_MAP.weekly_hours);
  const openingsRaw = pickValue(row, COL_MAP.openings);
  const expRaw = pickValue(row, COL_MAP.experience_months);

  return {
    job_id,
    visa_type: String(pickValue(row, COL_MAP.visa_type) ?? "H-2B").trim() || "H-2B",
    company,
    email,
    job_title,
    category: String(pickValue(row, COL_MAP.category) ?? "").trim() || null,
    city,
    state,
    openings: parseNumber(openingsRaw),
    salary: parseNumber(salaryRaw),
    overtime_salary: parseNumber(overtimeRaw),
    source_url: String(pickValue(row, COL_MAP.source_url) ?? "").trim() || null,
    phone: String(pickValue(row, COL_MAP.phone) ?? "").trim() || null,
    start_date: parseDate(pickValue(row, COL_MAP.start_date)),
    end_date: parseDate(pickValue(row, COL_MAP.end_date)),
    posted_date: parseDate(pickValue(row, COL_MAP.posted_date)),
    experience_months: parseNumber(expRaw),
    description: String(pickValue(row, COL_MAP.description) ?? "").trim() || null,
    requirements: String(pickValue(row, COL_MAP.requirements) ?? "").trim() || null,
    housing_info: String(pickValue(row, COL_MAP.housing_info) ?? "").trim() || null,
    weekly_hours: weeklyRaw != null ? Math.round(parseNumber(weeklyRaw) ?? 0) || null : null,
    education_required: String(pickValue(row, COL_MAP.education_required) ?? "").trim() || null,
    transport_provided: parseBool01(pickValue(row, COL_MAP.transport_provided)),
    tools_provided: parseBool01(pickValue(row, COL_MAP.tools_provided)),
    worksite_address: String(pickValue(row, COL_MAP.worksite_address) ?? "").trim() || null,
    worksite_zip: String(pickValue(row, COL_MAP.worksite_zip) ?? "").trim() || null,
    job_duties: String(pickValue(row, COL_MAP.job_duties) ?? "").trim() || null,
    job_min_special_req: String(pickValue(row, COL_MAP.job_min_special_req) ?? "").trim() || null,
    wage_additional: String(pickValue(row, COL_MAP.wage_additional) ?? "").trim() || null,
    rec_pay_deductions: String(pickValue(row, COL_MAP.rec_pay_deductions) ?? "").trim() || null,
  };
}

export function JobImportDialog() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<MappedJob[]>([]);
  const [skipped, setSkipped] = useState(0);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array", cellDates: true });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
    const rows = rawRows.map(normalizeRowKeys);

    const mapped: MappedJob[] = [];
    let skip = 0;
    for (const r of rows) {
      const m = mapRow(r);
      if (m) mapped.push(m);
      else skip++;
    }

    setPreview(mapped);
    setSkipped(skip);
  };

  const handleImport = async () => {
    if (preview.length === 0) {
      toast({ title: t("job_import.toasts.no_valid_title"), variant: "destructive" });
      return;
    }

    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
      toast({ title: t("job_import.toasts.need_login_title"), variant: "destructive" });
      setLoading(false);
      return;
    }

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ jobs: preview }),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast({
        title: t("job_import.toasts.import_error_title"),
        description: json?.error || t("job_import.toasts.import_error_fallback"),
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t("job_import.toasts.import_success_title", {
        count: formatNumber(Number(json?.imported ?? preview.length)),
      } as any) as string,
    });
    setPreview([]);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          {t("job_import.trigger")}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("job_import.title")}</DialogTitle>
          <DialogDescription>
            {t("job_import.description")}
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFile}
          className="hidden"
        />

        <div className="space-y-4">
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            {t("job_import.actions.select_file")}
          </Button>

          {preview.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">
                {String(t("job_import.summary.valid_for_import", { count: formatNumber(preview.length) } as any))}
                {skipped > 0 && ` ${String(t("job_import.summary.skipped", { count: formatNumber(skipped) } as any))}`}
              </p>

              <ScrollArea className="max-h-64 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("job_import.table.headers.job_id")}</TableHead>
                      <TableHead>{t("job_import.table.headers.visa")}</TableHead>
                      <TableHead>{t("job_import.table.headers.role")}</TableHead>
                      <TableHead>{t("job_import.table.headers.company")}</TableHead>
                      <TableHead>{t("job_import.table.headers.location")}</TableHead>
                      <TableHead>{t("job_import.table.headers.openings")}</TableHead>
                      <TableHead>{t("job_import.table.headers.salary")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 50).map((j, i) => (
                      <TableRow key={`${j.job_id}-${i}`}>
                        <TableCell className="font-mono text-xs">{j.job_id}</TableCell>
                        <TableCell>{j.visa_type}</TableCell>
                        <TableCell>{j.job_title}</TableCell>
                        <TableCell>{j.company}</TableCell>
                        <TableCell>
                          {j.city}, {j.state}
                        </TableCell>
                        <TableCell>{typeof j.openings === "number" ? formatNumber(j.openings) : "-"}</TableCell>
                        <TableCell>{j.salary ? `$${j.salary}/h` : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleImport} disabled={loading || preview.length === 0}>
            {loading ? t("job_import.actions.importing") : t("job_import.actions.import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
