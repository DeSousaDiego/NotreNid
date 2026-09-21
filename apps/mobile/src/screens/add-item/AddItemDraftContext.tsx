import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { ItemFormValues } from '../item-form/schema';

export interface AddItemDraft {
  categoryId: string | null;
  values: Partial<ItemFormValues> | null;
  /** Vrai quand le dernier scan barcode a renvoyé `status: 'partial'` (DVD
   * identifié physiquement par UPCitemdb, film non résolu par TMDB) — sert
   * uniquement à afficher un bandeau d'information inline sur le formulaire
   * (`ItemFormScreen.infoMessage`, voir `add-item/form.tsx`), jamais à
   * bloquer la saisie ni la soumission. Reste vrai pendant toute l'édition du
   * brouillon (une frappe normale ne l'efface pas — voir `setValues`) : remis
   * à `false` uniquement par `setCategory`/`clearDraft`, l'utilisateur doit
   * avoir eu l'occasion de relire tout le formulaire, pas seulement le champ
   * qu'il vient de modifier. */
  partialWarning: boolean;
}

export interface AddItemDraftContextValue {
  draft: AddItemDraft;
  /** Fixe la catégorie du brouillon en cours. Change de catégorie ⇒ efface les
   * valeurs déjà saisies (elles ne s'appliquent qu'à l'ancienne catégorie). */
  setCategory: (categoryId: string) => void;
  /**
   * Fusionne `values` dans le brouillon — ne remplace jamais tout l'objet.
   * `metadata`/`customMetadata` sont fusionnés champ par champ (un niveau de
   * profondeur), tous les autres champs sont remplacés tels quels. Utilisé par
   * `ItemFormScreen.onValuesChange` (qui envoie systématiquement l'objet
   * `metadata` complet — la fusion champ par champ y équivaut donc à un
   * remplacement, sans changement de comportement) et par l'écran de scan
   * (Bloc 3A), qui n'envoie qu'un sous-ensemble de `metadata` (ex. seulement
   * les champs livre) sans devoir connaître ni écraser les champs déjà saisis
   * à la main.
   *
   * `options.partial` : à passer `true` uniquement depuis l'écran de scan sur
   * un résultat `status: 'partial'` — jamais depuis `ItemFormScreen`
   * (`onValuesChange` n'en a pas besoin, `undefined` préserve la valeur
   * courante de `partialWarning`, ne la remet jamais à `false` en cours de
   * frappe).
   */
  setValues: (values: Partial<ItemFormValues>, options?: { partial?: boolean }) => void;
  clearDraft: () => void;
  /** Vrai si des champs significatifs ont déjà été saisis (sert la confirmation
   * avant un changement de catégorie destructeur). */
  hasMeaningfulData: boolean;
}

const EMPTY_DRAFT: AddItemDraft = { categoryId: null, values: null, partialWarning: false };

const AddItemDraftContext = createContext<AddItemDraftContextValue | null>(null);

/**
 * Vrai si `values` contient au moins un champ que l'utilisateur a manifestement
 * renseigné lui-même — sert uniquement à décider d'afficher une confirmation avant
 * de perdre le brouillon (Bloc 2, section 6), pas une validation métier.
 */
export function isDraftMeaningful(values: Partial<ItemFormValues> | null): boolean {
  if (!values) return false;
  if (values.title?.trim()) return true;
  if (values.description?.trim()) return true;
  if (values.notes?.trim()) return true;
  if (values.coverImageUrl?.trim()) return true;
  if (values.rating != null) return true;
  if (values.countryCodes && values.countryCodes.length > 0) return true;
  if (values.ownerIds && values.ownerIds.length > 0) return true;
  if (values.metadata && Object.values(values.metadata).some((v) => v?.trim())) return true;
  if (values.customMetadata && Object.values(values.customMetadata).some((v) => v?.trim())) {
    return true;
  }
  return false;
}

export function AddItemDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<AddItemDraft>(EMPTY_DRAFT);

  const setCategory = useCallback((categoryId: string) => {
    setDraft((prev) =>
      prev.categoryId === categoryId ? prev : { categoryId, values: null, partialWarning: false },
    );
  }, []);

  const setValues = useCallback(
    (values: Partial<ItemFormValues>, options?: { partial?: boolean }) => {
      setDraft((prev) => ({
        ...prev,
        partialWarning: options?.partial ?? prev.partialWarning,
        values: {
          ...prev.values,
          ...values,
          // Fusion ciblée d'un niveau : un scan qui ne renseigne que `book.isbn`
          // (par exemple) ne doit jamais effacer un `metadata.author` déjà saisi
          // à la main. Ne s'applique qu'aux clés réellement présentes dans
          // `values.metadata`/`customMetadata` — une clé absente là n'écrase rien.
          ...(values.metadata || prev.values?.metadata
            ? { metadata: { ...prev.values?.metadata, ...values.metadata } }
            : null),
          ...(values.customMetadata || prev.values?.customMetadata
            ? { customMetadata: { ...prev.values?.customMetadata, ...values.customMetadata } }
            : null),
        },
      }));
    },
    [],
  );

  const clearDraft = useCallback(() => setDraft(EMPTY_DRAFT), []);

  const hasMeaningfulData = useMemo(() => isDraftMeaningful(draft.values), [draft.values]);

  const value = useMemo<AddItemDraftContextValue>(
    () => ({ draft, setCategory, setValues, clearDraft, hasMeaningfulData }),
    [draft, setCategory, setValues, clearDraft, hasMeaningfulData],
  );

  return <AddItemDraftContext.Provider value={value}>{children}</AddItemDraftContext.Provider>;
}

export function useAddItemDraft(): AddItemDraftContextValue {
  const ctx = useContext(AddItemDraftContext);
  if (!ctx)
    throw new Error('useAddItemDraft doit être utilisé à l’intérieur de <AddItemDraftProvider>.');
  return ctx;
}
