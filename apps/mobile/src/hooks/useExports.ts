import { useMutation } from '@tanstack/react-query';

import { shareExportFile, type ExportFormat } from '../lib/exportFile';
import { useApiClient } from '../providers/AuthProvider';

export function useExportCollection(householdId: string | null, householdName: string) {
  const apiClient = useApiClient();

  return useMutation({
    mutationFn: async (format: ExportFormat) => {
      const content =
        format === 'json'
          ? JSON.stringify(await apiClient.exports.json(householdId as string), null, 2)
          : await apiClient.exports.csv(householdId as string);
      await shareExportFile(householdName, format, content);
    },
  });
}
