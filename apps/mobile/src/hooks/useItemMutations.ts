import type { CreateItemInput, UpdateItemInput } from '@notre-nid/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import { useApiClient, useAuth } from '../providers/AuthProvider';

export function useCreateItem(householdId: string | null) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? '__none__';

  return useMutation({
    mutationFn: (input: CreateItemInput) => apiClient.items.create(householdId as string, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.itemsRoot(userId, householdId as string),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.stats(userId, householdId as string),
      });
    },
  });
}

export function useUpdateItem(householdId: string | null) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? '__none__';

  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: UpdateItemInput }) =>
      apiClient.items.update(householdId as string, itemId, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.item(userId, householdId as string, updated.id), updated);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.itemsRoot(userId, householdId as string),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.stats(userId, householdId as string),
      });
    },
  });
}

export function useArchiveItem(householdId: string | null) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? '__none__';

  return useMutation({
    mutationFn: (itemId: string) => apiClient.items.archive(householdId as string, itemId),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.item(userId, householdId as string, updated.id), updated);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.itemsRoot(userId, householdId as string),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.stats(userId, householdId as string),
      });
    },
  });
}

export function useRestoreItem(householdId: string | null) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? '__none__';

  return useMutation({
    mutationFn: (itemId: string) => apiClient.items.restore(householdId as string, itemId),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.item(userId, householdId as string, updated.id), updated);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.itemsRoot(userId, householdId as string),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.stats(userId, householdId as string),
      });
    },
  });
}
