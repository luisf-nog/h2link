export function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  // Standardize thousand separator to dot (e.g., 9.999) across the app.
  // We keep it fixed to pt-BR to match the requested grouping style.
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(value);
}
