import { act, renderHook } from '@testing-library/react-native';

import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('retourne la valeur initiale immédiatement', async () => {
    const { result } = await renderHook(() => useDebouncedValue('a', 300));
    expect(result.current).toBe('a');
  });

  it('ne met à jour la valeur qu’après le délai', async () => {
    const { result, rerender } = await renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 300),
      {
        initialProps: { value: 'a' },
      },
    );

    await rerender({ value: 'ab' });
    expect(result.current).toBe('a');

    await act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current).toBe('a');

    await act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe('ab');
  });

  it('annule le délai précédent si la valeur change à nouveau avant son terme', async () => {
    const { result, rerender } = await renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 300),
      {
        initialProps: { value: 'a' },
      },
    );

    await rerender({ value: 'ab' });
    await act(() => {
      jest.advanceTimersByTime(200);
    });
    await rerender({ value: 'abc' });
    await act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current).toBe('a');

    await act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe('abc');
  });
});
