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
  name: string;
  dial: string;
};

const COUNTRIES: CountryOption[] = [
  { code: "US", name: "United States", dial: "+1" },
  { code: "BR", name: "Brasil", dial: "+55" },
  { code: "MX", name: "México", dial: "+52" },
  { code: "CO", name: "Colombia", dial: "+57" },
  { code: "DO", name: "República Dominicana", dial: "+1" },
  { code: "GT", name: "Guatemala", dial: "+502" },
  { code: "HN", name: "Honduras", dial: "+504" },
  { code: "SV", name: "El Salvador", dial: "+503" },
  { code: "NI", name: "Nicaragua", dial: "+505" },
  { code: "PA", name: "Panamá", dial: "+507" },
  { code: "PE", name: "Perú", dial: "+51" },
  { code: "AR", name: "Argentina", dial: "+54" },
  { code: "CL", name: "Chile", dial: "+56" },
  { code: "ES", name: "España", dial: "+34" },
  { code: "PT", name: "Portugal", dial: "+351" },
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

  const triggerLabel = useMemo(() => {
    const opt = COUNTRIES.find((c) => c.code === country);
    if (!opt) return country;
    // keep the trigger compact so the phone input has enough room
    return `${opt.code} ${opt.dial}`;
  }, [country]);

  const smartPlaceholder = useMemo(() => {
    // Visual guidance only (doesn't affect E.164 value)
    switch (country) {
      case "BR":
        return "+55 11 9XXXX-XXXX";
      case "US":
        return "+1 (201) 555-0123";
      case "MX":
        return "+52 55 1234-5678";
      case "CO":
        return "+57 300 123 4567";
      case "AR":
        return "+54 11 1234-5678";
      case "CL":
        return "+56 9 1234 5678";
      case "ES":
        return "+34 612 34 56 78";
      case "PT":
        return "+351 912 345 678";
      default: {
        const opt = COUNTRIES.find((c) => c.code === country);
        return opt ? `${opt.dial} …` : "+…";
      }
    }
  }, [country]);

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
      <div className="grid min-w-0 grid-cols-[minmax(0,92px)_minmax(0,1fr)] gap-2">
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
          <SelectTrigger className={"w-full min-w-0 px-2 " + (triggerClassName ?? "bg-background/30")}>
            <SelectValue aria-label={triggerLabel}>{triggerLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name} ({c.dial})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          id={id}
          type="tel"
          inputMode="tel"
          className={"w-full min-w-0 " + (inputClassName ?? "")}
          value={display}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? smartPlaceholder}
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

