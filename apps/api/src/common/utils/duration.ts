const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Parse des durées simples type "15m", "30d", "1h" (utilisées par les TTL JWT_*). */
export function parseDurationToMs(value: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/i.exec(value.trim());
  if (!match) {
    throw new Error(`Durée invalide : "${value}". Formats acceptés : 15m, 30d, 1h, 3600s.`);
  }
  const amount = Number(match[1]);
  const unit = (match[2] ?? '').toLowerCase();
  const unitMs = UNIT_MS[unit];
  if (unitMs === undefined) {
    throw new Error(`Unité de durée inconnue dans "${value}".`);
  }
  return amount * unitMs;
}
