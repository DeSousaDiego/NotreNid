/** "Aujourd'hui" / "Hier" / date longue française — pied des cartes "Ajouts récents".
 * `now` n'existe que pour des tests déterministes (jamais de vraie horloge). */
export function formatRelativeDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
