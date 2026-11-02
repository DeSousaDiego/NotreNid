/**
 * Aplatit des pages paginées en gardant la première occurrence de chaque `id`.
 *
 * Défense en profondeur (Release 0B) : l'API trie désormais de façon déterministe (départage
 * par `id`), mais un objet peut encore changer de page entre deux requêtes (ajout, archivage
 * ou modification par un autre membre). Sans ce filtre, une même carte apparaîtrait deux fois
 * et React signalerait des clés dupliquées dans la FlatList.
 */
export function uniqueById<T extends { id: string }>(pages: readonly (readonly T[])[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const page of pages) {
    for (const entry of page) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        result.push(entry);
      }
    }
  }
  return result;
}
