import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, RefreshCw, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { formatNumber } from "@/lib/number";

interface ImportRecord {
  id: string;
  source: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export function ImportHistory() {
  const [records, setRecords] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("import_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setRecords((data as ImportRecord[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-600 hover:bg-green-700 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Sucesso
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" /> Erro
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Processando
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const sourceLabel = (source: string) => {
    switch (source.toLowerCase()) {
      case "jo": return "JO / Seasonal";
      case "h2a": return "H-2A";
      case "h2b": return "H-2B";
      default: return source.toUpperCase();
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit",
      timeZone: "America/New_York",
    });
  };

  const getDuration = (created: string, updated: string) => {
    const diff = Math.round((new Date(updated).getTime() - new Date(created).getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Histórico de Importações
            </CardTitle>
            <CardDescription>Últimas 50 importações (manuais e automáticas)</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchHistory} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && records.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : records.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma importação registrada.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Vagas</TableHead>
                  <TableHead className="text-right">
                    <Clock className="h-3.5 w-3.5 inline mr-1" />
                    Duração
                  </TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-mono whitespace-nowrap">
                      {formatDate(r.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-semibold">
                        {sourceLabel(r.source)}
                      </Badge>
                    </TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {r.status === "processing"
                        ? `${formatNumber(r.processed_rows)} / ${formatNumber(r.total_rows)}`
                        : formatNumber(r.processed_rows)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      {r.status !== "processing" ? getDuration(r.created_at, r.updated_at) : "—"}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {r.error_message ? (
                        <span className="text-xs text-destructive truncate block" title={r.error_message}>
                          {r.error_message.length > 80
                            ? r.error_message.slice(0, 80) + "…"
                            : r.error_message}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
