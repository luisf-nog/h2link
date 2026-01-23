import { useEffect, useMemo, useState } from "react";
import { AsYouType, parsePhoneNumberFromString } from "libphonenumber-js";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CountryOption = {
  code: string;
  label: string;
};

const COUNTRIES: CountryOption[] = [
  { code: "US", label: "United States (+1)" },
  { code: "BR", label: "Brasil (+55)" },
  { code: "MX", label: "México (+52)" },
  { code: "CO", label: "Colombia (+57)" },
  { code: "DO", label: "República Dominicana (+1)" },
  { code: "GT", label: "Guatemala (+502)" },
  { code: "HN", label: "Honduras (+504)" },
  { code: "SV", label: "El Salvador (+503)" },
  { code: "NI", label: "Nicaragua (+505)" },
  { code: "PA", label: "Panamá (+507)" },
  { code: "PE", label: "Perú (+51)" },
  { code: "AR", label: "Argentina (+54)" },
  { code: "CL", label: "Chile (+56)" },
  { code: "ES", label: "España (+34)" },
  { code: "PT", label: "Portugal (+351)" },
];

function bestEffortToE164(input: string, country: string): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return "";

  // If user already typed "+", keep it and sanitize.
  if (trimmed.startsWith("+")) {
    return "+" + trimmed.replace(/\D/g, "");
  }

  // Otherwise, attempt to parse with selected country.
  const pn = parsePhoneNumberFromString(trimmed, country as any);
  if (pn?.number) return pn.number;

  // Fallback: keep only digits (will fail validation if too short/long)
  return "+" + trimmed.replace(/\D/g, "");
}

export function PhoneE164Input({
  id,
  name,
  defaultValue,
  required,
  placeholder,
  invalidHint,
  className,
  inputClassName,
  triggerClassName,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  invalidHint?: string;
  className?: string;
  inputClassName?: string;
  triggerClassName?: string;
}) {
  const initialCountry = useMemo(() => {
    const locale = navigator.language || "en-US";
    const maybeCountry = locale.split("-")[1]?.toUpperCase();
    return COUNTRIES.some((c) => c.code === maybeCountry) ? maybeCountry : "US";
  }, []);

  const [country, setCountry] = useState<string>(initialCountry);
  const [display, setDisplay] = useState<string>("");
  const [e164, setE164] = useState<string>(defaultValue ?? "");

  useEffect(() => {
    if (!defaultValue) return;
    // Try to infer country from the E.164 number; if not, keep initial.
    const pn = parsePhoneNumberFromString(defaultValue);
    if (pn?.country) setCountry(String(pn.country));
    setDisplay(defaultValue);
    setE164(defaultValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isValid = useMemo(() => {
    if (!e164) return !required;
    const pn = parsePhoneNumberFromString(e164);
    return Boolean(pn?.isValid());
  }, [e164, required]);

  const onChange = (value: string) => {
    const formatted = new AsYouType(country as any).input(value);
    setDisplay(formatted);
    setE164(bestEffortToE164(formatted, country));
  };

  return (
    <div className={"space-y-2 " + (className ?? "")}>
      <div className="grid min-w-0 grid-cols-[minmax(0,160px)_minmax(0,1fr)] gap-2">
        <Select
          value={country}
          onValueChange={(v) => {
            setCountry(v);
            // Reformat with new country context
            setDisplay((prev) => {
              const next = new AsYouType(v as any).input(prev);
              setE164(bestEffortToE164(next, v));
              return next;
            });
          }}
        >
          <SelectTrigger className={"min-w-0 " + (triggerClassName ?? "bg-background/30")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          id={id}
          type="tel"
          inputMode="tel"
          className={"min-w-0 " + (inputClassName ?? "")}
          value={display}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={!isValid}
        />
      </div>

      {/* hidden field used by FormData (always E.164) */}
      <input type="hidden" name={name} value={e164} />

      {!isValid ? (
        <p className="text-xs text-muted-foreground">{invalidHint ?? "Invalid phone format."}</p>
      ) : null}
    </div>
  );
}

