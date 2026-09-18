import type { ResolveBarcodeInput } from '@notre-nid/api-client';
import { useMutation } from '@tanstack/react-query';

import { useApiClient } from '../providers/AuthProvider';

/** Recherche externe en lecture seule — ne crée ni ne modifie jamais rien, donc
 * aucune invalidation de cache React Query à déclencher au succès. */
export function useResolveBarcode() {
  const apiClient = useApiClient();

  return useMutation({
    mutationFn: (input: ResolveBarcodeInput) => apiClient.items.resolveBarcode(input),
  });
}
