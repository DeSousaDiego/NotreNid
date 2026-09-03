import type { UpdateProfileInput } from '@notre-nid/api-client';
import type { PublicUser } from '@notre-nid/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';

import { queryKeys } from '../lib/queryKeys';
import { useApiClient, useAuth } from '../providers/AuthProvider';
import { useHousehold } from '../providers/HouseholdProvider';

/**
 * Le nom/la photo de l'utilisateur courant apparaissent dans plusieurs requêtes déjà
 * en cache indépendamment de la session (membres, propriétaires/auteurs d'items) —
 * chacune embarque un instantané `PublicUser` capturé au moment de son propre fetch,
 * qui ne se met pas à jour tout seul (Bloc 4, docs/PHASE_STATUS.md). `refreshUser`
 * met à jour la session ; ceci invalide en plus les vues du household courant qui
 * affichent cet utilisateur.
 */
function useInvalidateProfileCaches() {
  const queryClient = useQueryClient();
  const { householdId } = useHousehold();
  const { user } = useAuth();

  return () => {
    if (!householdId || !user) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.members(user.id, householdId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.itemsRoot(user.id, householdId) });
  };
}

export function useUpdateProfile() {
  const apiClient = useApiClient();
  const { refreshUser } = useAuth();
  const invalidate = useInvalidateProfileCaches();

  return useMutation<PublicUser, unknown, UpdateProfileInput>({
    mutationFn: (input) => apiClient.users.updateProfile(input),
    onSuccess: async (user) => {
      await refreshUser(user);
      invalidate();
    },
  });
}

export function useUploadAvatar() {
  const apiClient = useApiClient();
  const { refreshUser } = useAuth();
  const invalidate = useInvalidateProfileCaches();

  return useMutation<PublicUser, unknown, { uri: string }>({
    mutationFn: ({ uri }) => {
      const formData = new FormData();
      // Voir useUploads.ts : un vrai `File` (expo-file-system), pas l'ancienne
      // pseudo-partie React Native `{ uri, name, type }`.
      formData.append('file', new File(uri));
      return apiClient.users.uploadAvatar(formData);
    },
    onSuccess: async (user) => {
      await refreshUser(user);
      invalidate();
    },
  });
}

export function useRemoveAvatar() {
  const apiClient = useApiClient();
  const { refreshUser } = useAuth();
  const invalidate = useInvalidateProfileCaches();

  return useMutation<PublicUser, unknown, void>({
    mutationFn: () => apiClient.users.removeAvatar(),
    onSuccess: async (user) => {
      await refreshUser(user);
      invalidate();
    },
  });
}
