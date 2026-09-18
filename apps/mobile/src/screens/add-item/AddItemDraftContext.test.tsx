import { renderHook, act } from '@testing-library/react-native';

import { AddItemDraftProvider, isDraftMeaningful, useAddItemDraft } from './AddItemDraftContext';

describe('useAddItemDraft', () => {
  it('throws when used outside AddItemDraftProvider', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useAddItemDraft())).rejects.toThrow(
      'useAddItemDraft doit être utilisé à l’intérieur de <AddItemDraftProvider>.',
    );
    consoleError.mockRestore();
  });

  it('starts empty', async () => {
    const { result } = await renderHook(() => useAddItemDraft(), { wrapper: AddItemDraftProvider });
    expect(result.current.draft).toEqual({ categoryId: null, values: null });
    expect(result.current.hasMeaningfulData).toBe(false);
  });

  it('setCategory sets the categoryId and clears values on an actual category change', async () => {
    const { result } = await renderHook(() => useAddItemDraft(), { wrapper: AddItemDraftProvider });

    await act(async () => result.current.setCategory('cat-cd'));
    await act(async () => result.current.setValues({ title: 'Discovery' }));
    expect(result.current.draft).toEqual({ categoryId: 'cat-cd', values: { title: 'Discovery' } });

    // Même catégorie reposée : ne doit pas effacer les valeurs déjà saisies.
    await act(async () => result.current.setCategory('cat-cd'));
    expect(result.current.draft.values).toEqual({ title: 'Discovery' });

    // Changement réel de catégorie : efface les valeurs (elles ne s'appliquent qu'à
    // l'ancienne catégorie).
    await act(async () => result.current.setCategory('cat-book'));
    expect(result.current.draft).toEqual({ categoryId: 'cat-book', values: null });
  });

  it('setValues merges top-level fields rather than replacing the whole draft', async () => {
    const { result } = await renderHook(() => useAddItemDraft(), { wrapper: AddItemDraftProvider });

    await act(async () => result.current.setValues({ title: 'Discovery' }));
    await act(async () => result.current.setValues({ ownerIds: ['user-1'] }));

    expect(result.current.draft.values).toEqual({ title: 'Discovery', ownerIds: ['user-1'] });
  });

  it('setValues merges metadata field by field — a scan filling only some fields never erases a field already typed by hand', async () => {
    const { result } = await renderHook(() => useAddItemDraft(), { wrapper: AddItemDraftProvider });

    await act(async () =>
      result.current.setValues({ metadata: { author: 'Frank Herbert', publisher: 'Gallimard' } }),
    );
    // Un résultat de scan ne renseigne que l'ISBN — ne doit pas écraser `author`/`publisher`.
    await act(async () => result.current.setValues({ metadata: { isbn: '9782070368228' } }));

    expect(result.current.draft.values?.metadata).toEqual({
      author: 'Frank Herbert',
      publisher: 'Gallimard',
      isbn: '9782070368228',
    });
  });

  it('setValues metadata merge overwrites only the keys explicitly present in the new value', async () => {
    const { result } = await renderHook(() => useAddItemDraft(), { wrapper: AddItemDraftProvider });

    await act(async () => result.current.setValues({ metadata: { author: 'Frank Herbert' } }));
    await act(async () => result.current.setValues({ metadata: { author: 'Corrected Author' } }));

    expect(result.current.draft.values?.metadata).toEqual({ author: 'Corrected Author' });
  });

  it('setValues without a metadata key leaves the existing metadata untouched', async () => {
    const { result } = await renderHook(() => useAddItemDraft(), { wrapper: AddItemDraftProvider });

    await act(async () => result.current.setValues({ metadata: { author: 'Frank Herbert' } }));
    await act(async () => result.current.setValues({ title: 'Dune' }));

    expect(result.current.draft.values).toEqual({
      title: 'Dune',
      metadata: { author: 'Frank Herbert' },
    });
  });

  it('setValues merges customMetadata field by field, same as metadata', async () => {
    const { result } = await renderHook(() => useAddItemDraft(), { wrapper: AddItemDraftProvider });

    await act(async () => result.current.setValues({ customMetadata: { color: 'red' } }));
    await act(async () => result.current.setValues({ customMetadata: { size: 'M' } }));

    expect(result.current.draft.values?.customMetadata).toEqual({ color: 'red', size: 'M' });
  });

  it('clearDraft resets to the empty state', async () => {
    const { result } = await renderHook(() => useAddItemDraft(), { wrapper: AddItemDraftProvider });

    await act(async () => result.current.setCategory('cat-cd'));
    await act(async () => result.current.setValues({ title: 'Discovery' }));
    await act(async () => result.current.clearDraft());

    expect(result.current.draft).toEqual({ categoryId: null, values: null });
    expect(result.current.hasMeaningfulData).toBe(false);
  });

  it('hasMeaningfulData reflects isDraftMeaningful on the current values', async () => {
    const { result } = await renderHook(() => useAddItemDraft(), { wrapper: AddItemDraftProvider });

    expect(result.current.hasMeaningfulData).toBe(false);
    await act(async () => result.current.setValues({ title: 'Discovery' }));
    expect(result.current.hasMeaningfulData).toBe(true);
  });
});

describe('isDraftMeaningful', () => {
  it('is false for null or an empty draft', () => {
    expect(isDraftMeaningful(null)).toBe(false);
    expect(isDraftMeaningful({})).toBe(false);
    expect(isDraftMeaningful({ title: '', description: '  ' })).toBe(false);
  });

  it('is true when title, ownerIds, or a metadata field is set', () => {
    expect(isDraftMeaningful({ title: 'Dune' })).toBe(true);
    expect(isDraftMeaningful({ ownerIds: ['user-1'] })).toBe(true);
    expect(isDraftMeaningful({ metadata: { author: 'Frank Herbert' } })).toBe(true);
    expect(isDraftMeaningful({ metadata: { author: '' } })).toBe(false);
  });
});
