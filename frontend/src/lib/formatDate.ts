/**
 * Formats a date string using the user's profile timezone.
 * Falls back to browser local time if timezone is invalid.
 */
export function formatDateTz(
  dateStr: string,
  lang: string,
  timezone?: string,
  options?: { short?: boolean }
): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const locale = lang === "pt" ? "pt-BR" : lang === "es" ? "es" : "en-US";
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (options?.short) {
      return date.toLocaleString(locale, {
        timeZone: tz,
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: lang === "en",
      });
    }

    return date.toLocaleString(locale, {
      timeZone: tz,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: lang === "en",
    });
  } catch {
    return dateStr;
  }
}
