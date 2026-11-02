import { resolveHouseholdGate } from './householdGate';

describe('resolveHouseholdGate', () => {
  it('shows an error with retry — never "create your nest" — when /households fails with no data', () => {
    expect(
      resolveHouseholdGate({ hasData: false, isError: true, householdCount: 0, householdId: null }),
    ).toBe('error');
  });

  it('shows the loader while the first response is pending', () => {
    expect(
      resolveHouseholdGate({
        hasData: false,
        isError: false,
        householdCount: 0,
        householdId: null,
      }),
    ).toBe('loading');
  });

  it('shows "no household" only for a valid, empty response', () => {
    expect(
      resolveHouseholdGate({ hasData: true, isError: false, householdCount: 0, householdId: null }),
    ).toBe('empty');
  });

  it('keeps the app when data is present, even if a later refetch failed', () => {
    expect(
      resolveHouseholdGate({ hasData: true, isError: true, householdCount: 1, householdId: 'h1' }),
    ).toBe('ready');
  });

  it('asks to pick a household when several exist and none is selected', () => {
    expect(
      resolveHouseholdGate({ hasData: true, isError: false, householdCount: 2, householdId: null }),
    ).toBe('select');
  });
});
