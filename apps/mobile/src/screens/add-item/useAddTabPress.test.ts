import { renderHook } from '@testing-library/react-native';

import { useAddTabPress } from './useAddTabPress';

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

describe('useAddTabPress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('always prevents the default tab switch — the "add" tab must never actually gain focus', async () => {
    const { result } = await renderHook(() => useAddTabPress());
    const preventDefault = jest.fn();

    result.current({ preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('navigates to the category screen on press', async () => {
    const { result } = await renderHook(() => useAddTabPress());

    result.current({ preventDefault: jest.fn() });

    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/add-item/category');
    expect(mockRouterPush).toHaveBeenCalledTimes(1);
  });

  it('ignores a repeat press within the debounce window — regression: a double-tap must never stack two instances of the flow', async () => {
    const { result } = await renderHook(() => useAddTabPress());

    result.current({ preventDefault: jest.fn() });
    result.current({ preventDefault: jest.fn() });
    result.current({ preventDefault: jest.fn() });

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
  });

  it('allows navigating again once the debounce window has elapsed', async () => {
    // `Date.now` espionné directement plutôt que `jest.useFakeTimers()` : cette
    // version de RNTL fait reposer `renderHook`/`render` sur de vrais timers en
    // interne (ils renvoient une Promise) — les fake timers de Jest interfèrent avec
    // ce mécanisme et empêchent le rendu de se stabiliser correctement.
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(0);
    const { result } = await renderHook(() => useAddTabPress());

    result.current({ preventDefault: jest.fn() });
    dateNowSpy.mockReturnValue(1000);
    result.current({ preventDefault: jest.fn() });

    expect(mockRouterPush).toHaveBeenCalledTimes(2);
    dateNowSpy.mockRestore();
  });
});
