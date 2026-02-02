import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isSupportedLanguage, type SupportedLanguage } from "@/i18n";
import { useTranslation } from "react-i18next";

type Props = {
  value?: SupportedLanguage;
  onChange?: (next: SupportedLanguage) => void;
  className?: string;
};

export function LanguageSwitcher({ value, onChange, className }: Props) {
  const { t, i18n } = useTranslation();

  const current = isSupportedLanguage(value)
    ? value
    : isSupportedLanguage(i18n.language)
      ? (i18n.language as SupportedLanguage)
      : "en";

  return (
    <Select
      value={current}
      onValueChange={(v) => {
        if (!isSupportedLanguage(v)) return;
        onChange?.(v);
      }}
    >
      <SelectTrigger className={className} aria-label={t("common.language")}> 
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="en">{t("common.languages.en")}</SelectItem>
        <SelectItem value="pt">{t("common.languages.pt")}</SelectItem>
        <SelectItem value="es">{t("common.languages.es")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
