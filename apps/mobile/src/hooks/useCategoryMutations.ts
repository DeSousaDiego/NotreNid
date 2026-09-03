import type { CreateCategoryInput, UpdateCategoryInput } from '@notre-nid/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import { useApiClient, useAuth } from '../providers/AuthProvider';

export function useCreateCategory(householdId: string | null) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? '__none__';

  return useMutation({
    mutationFn: (input: CreateCategoryInput) =>
      apiClient.categories.create(householdId as string, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.categories(userId, householdId as string),
      });
    },
  });
}

export function useUpdateCategory(householdId: string | null) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? '__none__';

  return useMutation({
    mutationFn: ({ categoryId, input }: { categoryId: string; input: UpdateCategoryInput }) =>
      apiClient.categories.update(householdId as string, categoryId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.categories(userId, householdId as string),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.itemsRoot(userId, householdId as string),
      });
    },
  });
}

export function useDeleteCategory(householdId: string | null) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? '__none__';

  return useMutation({
    mutationFn: (categoryId: string) =>
      apiClient.categories.remove(householdId as string, categoryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.categories(userId, householdId as string),
      });
    },
  });
}
