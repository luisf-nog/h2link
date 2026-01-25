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
import { Bus, Calendar, Home, Mail, MapPin, Phone, Plus, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";

export type JobDetails = {
  id: string;
  job_id: string;
  visa_type: "H-2B" | "H-2A" | string | null;
  company: string;
  email: string;
  phone?: string | null;
  job_title: string;
  category: string | null;
  city: string;
  state: string;
  worksite_address?: string | null;
  worksite_zip?: string | null;
  openings?: number | null;
  salary: number | null;
  overtime_salary?: number | null;
  start_date: string | null;
  end_date?: string | null;
  posted_date: string;
  source_url?: string | null;
  experience_months?: number | null;
  description?: string | null;
  requirements?: string | null;
  education_required?: string | null;
  housing_info: string | null;
  transport_provided: boolean | null;
  tools_provided: boolean | null;
  weekly_hours: number | null;
  job_duties?: string | null;
  job_min_special_req?: string | null;
  wage_additional?: string | null;
  rec_pay_deductions?: string | null;
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
  const { t, i18n } = useTranslation();
  const isH2A = job?.visa_type === "H-2A";

  const formatDate = (v: string | null | undefined) => {
    if (!v) return "-";
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? "-"
      : d.toLocaleDateString(i18n.language, { timeZone: "UTC" });
  };

  const yesNo = (v: boolean | null | undefined) => {
    if (v === true) return t("common.yes");
    if (v === false) return t("common.no");
    return "-";
  };

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
                <p className="text-sm text-muted-foreground">{t("job_details.fields.openings")}</p>
                <p className="font-medium">{job?.openings ?? "-"}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t("job_details.fields.salary")}</p>
                <p className="font-medium">{formatSalary(job?.salary ?? null)}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t("job_details.fields.overtime")}</p>
                <p className="font-medium">
                  {job?.overtime_salary ? `$${Number(job.overtime_salary).toFixed(2)}/h` : "-"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t("job_details.fields.weekly_hours")}</p>
                <p className="font-medium">{job?.weekly_hours ? `${job.weekly_hours}h` : "-"}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t("job_details.fields.posted_date")}</p>
                <p className="font-medium inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {formatDate(job?.posted_date)}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t("job_details.fields.start_date")}</p>
                <p className="font-medium inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {formatDate(job?.start_date)}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t("job_details.fields.end_date")}</p>
                <p className="font-medium inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {formatDate(job?.end_date)}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t("job_details.fields.experience")}</p>
                <p className="font-medium">
                  {job?.experience_months != null
                    ? t("job_details.values.months", { count: job.experience_months })
                    : "-"}
                </p>
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("job_details.sections.contact")}</h3>
              <div className="rounded-md border p-3">
                <div className="flex flex-col gap-2">
                  <div className="inline-flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{job?.email}</span>
                  </div>

                  {job?.phone && (
                    <div className="inline-flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{job.phone}</span>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {t("job_details.fields.job_id")}: <span className="font-mono">{job?.job_id}</span>
                  </p>
                </div>
              </div>
            </section>

            {(job?.worksite_address || job?.worksite_zip) && (
              <>
                <Separator />
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">{t("job_details.sections.worksite")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {job.worksite_address}
                    {job.worksite_zip ? ` — ${job.worksite_zip}` : ""}
                  </p>
                </section>
              </>
            )}

            {(job?.description || job?.requirements || job?.education_required || job?.job_duties || job?.job_min_special_req) && (
              <>
                <Separator />
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold">{t("job_details.sections.details")}</h3>

                  {job?.education_required && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("job_details.fields.education")}</p>
                      <p className="text-sm">{job.education_required}</p>
                    </div>
                  )}

                  {job?.requirements && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("job_details.fields.requirements")}</p>
                      <p className="text-sm whitespace-pre-wrap">{job.requirements}</p>
                    </div>
                  )}

                  {job?.job_min_special_req && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("job_details.fields.special_requirements")}</p>
                      <p className="text-sm whitespace-pre-wrap">{job.job_min_special_req}</p>
                    </div>
                  )}

                  {job?.job_duties && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("job_details.fields.job_duties")}</p>
                      <p className="text-sm whitespace-pre-wrap">{job.job_duties}</p>
                    </div>
                  )}

                  {job?.description && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("job_details.fields.description")}</p>
                      <p className="text-sm whitespace-pre-wrap">{job.description}</p>
                    </div>
                  )}
                </section>
              </>
            )}

            {(job?.wage_additional || job?.rec_pay_deductions) && (
              <>
                <Separator />
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold">{t("job_details.sections.compensation")}</h3>

                  {job?.wage_additional && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("job_details.fields.wage_additional")}</p>
                      <p className="text-sm whitespace-pre-wrap">{job.wage_additional}</p>
                    </div>
                  )}

                  {job?.rec_pay_deductions && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("job_details.fields.pay_deductions")}</p>
                      <p className="text-sm whitespace-pre-wrap">{job.rec_pay_deductions}</p>
                    </div>
                  )}
                </section>
              </>
            )}

            {(planSettings.job_db_access === "text_only" ||
              planSettings.job_db_access === "visual_premium") && (
              <>
                <Separator />
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">{t("job_details.sections.benefits")}</h3>

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
                          <p className="text-sm font-medium">{t("job_details.fields.housing")}</p>
                          <p className="text-sm text-muted-foreground">
                            {isH2A
                              ? job?.housing_info || t("job_details.values.housing_required_h2a")
                              : job?.housing_info || t("job_details.values.not_provided")}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border p-3">
                      <div className="flex items-start gap-2">
                        {planSettings.show_housing_icons && <Bus className="h-4 w-4 mt-0.5 text-muted-foreground" />}
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{t("job_details.fields.transport")}</p>
                          <p className="text-sm text-muted-foreground">
                            {yesNo(job?.transport_provided)}
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
                          <p className="text-sm font-medium">{t("job_details.fields.tools")}</p>
                          <p className="text-sm text-muted-foreground">{yesNo(job?.tools_provided)}</p>
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
            {t("job_details.actions.add_to_queue")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
