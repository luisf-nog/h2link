import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Bus, Calendar, Home, Mail, MapPin, Plus, Wrench } from "lucide-react";

export type JobDetails = {
  id: string;
  job_id: string;
  visa_type: "H-2B" | "H-2A" | string | null;
  company: string;
  email: string;
  job_title: string;
  category: string | null;
  city: string;
  state: string;
  salary: number | null;
  start_date: string | null;
  posted_date: string;
  housing_info: string | null;
  transport_provided: boolean | null;
  tools_provided: boolean | null;
  weekly_hours: number | null;
};

type PlanSettings = {
  job_db_access: string;
  show_housing_icons: boolean;
};

export function JobDetailsDialog({
  open,
  onOpenChange,
  job,
  planSettings,
  formatSalary,
  onAddToQueue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobDetails | null;
  planSettings: PlanSettings;
  formatSalary: (salary: number | null) => string;
  onAddToQueue: (job: JobDetails) => void;
}) {
  const isH2A = job?.visa_type === "H-2A";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="mr-2">{job?.job_title}</DialogTitle>
              {job?.visa_type && (
                <Badge variant={isH2A ? "secondary" : "outline"}>{job.visa_type}</Badge>
              )}
              {job?.category && <Badge variant="outline">{job.category}</Badge>}
            </div>
            <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium text-foreground/90">{job?.company}</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {job?.city}, {job?.state}
              </span>
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="max-h-[70vh] overflow-y-auto pr-2">
          <div className="space-y-5">
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Salário</p>
                <p className="font-medium">{formatSalary(job?.salary ?? null)}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Horas semanais</p>
                <p className="font-medium">{job?.weekly_hours ? `${job.weekly_hours}h` : "-"}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Data de postagem</p>
                <p className="font-medium inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {job?.posted_date ? new Date(job.posted_date).toLocaleDateString("pt-BR") : "-"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Início</p>
                <p className="font-medium inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {job?.start_date ? new Date(job.start_date).toLocaleDateString("pt-BR") : "-"}
                </p>
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Contato</h3>
              <div className="rounded-md border p-3">
                <div className="flex flex-col gap-2">
                  <div className="inline-flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{job?.email}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Job ID: <span className="font-mono">{job?.job_id}</span>
                  </p>
                </div>
              </div>
            </section>

            {(planSettings.job_db_access === "text_only" ||
              planSettings.job_db_access === "visual_premium") && (
              <>
                <Separator />
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Benefícios</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-md border p-3">
                      <div className="flex items-start gap-2">
                        {planSettings.show_housing_icons && (
                          <Home
                            className={cn(
                              "h-4 w-4 mt-0.5",
                              isH2A ? "text-secondary-foreground" : "text-muted-foreground",
                            )}
                          />
                        )}
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Moradia</p>
                          <p className="text-sm text-muted-foreground">
                            {isH2A
                              ? job?.housing_info || "Obrigatória (detalhes não informados)."
                              : job?.housing_info || "Não informado."}
                          </p>
                          {isH2A && (
                            <p className="text-xs text-muted-foreground">
                              Argumento de venda: H-2A (agricultura) não tem cap anual.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border p-3">
                      <div className="flex items-start gap-2">
                        {planSettings.show_housing_icons && <Bus className="h-4 w-4 mt-0.5 text-muted-foreground" />}
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Transporte</p>
                          <p className="text-sm text-muted-foreground">
                            {job?.transport_provided ? "Sim" : "Não"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border p-3 sm:col-span-2">
                      <div className="flex items-start gap-2">
                        {planSettings.show_housing_icons && (
                          <Wrench className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        )}
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Ferramentas</p>
                          <p className="text-sm text-muted-foreground">{job?.tools_provided ? "Sim" : "Não"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>

        <div className="pt-2">
          <Button className="w-full" onClick={() => job && onAddToQueue(job)}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar à Fila
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
