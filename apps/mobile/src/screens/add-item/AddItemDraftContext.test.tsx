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

  it('setValues merges shallowly rather than replacing the whole draft', async () => {
    const { result } = await renderHook(() => useAddItemDraft(), { wrapper: AddItemDraftProvider });

    await act(async () => result.current.setValues({ title: 'Discovery' }));
    await act(async () => result.current.setValues({ ownerIds: ['user-1'] }));

    expect(result.current.draft.values).toEqual({ title: 'Discovery', ownerIds: ['user-1'] });
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
