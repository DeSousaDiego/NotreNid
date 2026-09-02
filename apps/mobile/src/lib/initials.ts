/** Initiales (prénom + nom) utilisées comme repli d'avatar quand aucune photo n'est disponible. */
export function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '?';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${second}`.toUpperCase();
}
