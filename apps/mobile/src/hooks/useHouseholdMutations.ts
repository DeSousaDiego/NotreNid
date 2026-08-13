import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import { useApiClient } from '../providers/AuthProvider';

/** Créer un household (docs/NOTRE_NID_PRD.md section 2, point 4). */
export function useCreateHousehold() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => apiClient.households.create(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.households });
    },
  });
}
