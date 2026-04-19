export function toNumberOrNull(raw = ""): number | null {
  const value = String(raw ?? "").trim();
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
