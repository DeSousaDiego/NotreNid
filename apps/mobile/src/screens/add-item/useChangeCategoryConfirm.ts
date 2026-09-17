import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAddItemDraft } from './AddItemDraftContext';

export interface ChangeCategoryConfirmDialogProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Logique partagée par `mode.tsx` et `form.tsx` (section 6, Bloc 2) : revenir à
 * l'écran « Choisir une catégorie » sans confirmation si le brouillon est vide,
 * avec confirmation (et effacement du brouillon) sinon. `router.dismissTo` revient
 * à l'écran déjà monté dans la pile plutôt que d'en empiler un nouveau.
 */
export function useChangeCategoryConfirm(): {
  requestChangeCategory: () => void;
  confirmDialogProps: ChangeCategoryConfirmDialogProps;
} {
  const draft = useAddItemDraft();
  const [visible, setVisible] = useState(false);

  const requestChangeCategory = useCallback(() => {
    if (draft.hasMeaningfulData) {
      setVisible(true);
    } else {
      router.dismissTo('/(app)/add-item/category');
    }
  }, [draft.hasMeaningfulData]);

  const onConfirm = useCallback(() => {
    draft.clearDraft();
    setVisible(false);
    router.dismissTo('/(app)/add-item/category');
  }, [draft]);

  const onCancel = useCallback(() => setVisible(false), []);

  return { requestChangeCategory, confirmDialogProps: { visible, onConfirm, onCancel } };
}
