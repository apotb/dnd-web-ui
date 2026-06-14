/** Resolve a select menu's display label from option value (Base UI Select shows raw values otherwise). */
export function optionLabel(
  options: readonly { value: string; label: string }[],
  value: string | undefined,
  fallback = ""
): string {
  if (!value) return fallback;
  return options.find((o) => o.value === value)?.label ?? (fallback || value);
}
