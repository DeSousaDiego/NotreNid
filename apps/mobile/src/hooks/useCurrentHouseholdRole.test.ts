import { renderHook } from '@testing-library/react-native';

import { useCurrentHouseholdRole } from './useCurrentHouseholdRole';

let mockHouseholdId: string | null = 'h1';
const mockHouseholds = [
  { id: 'h1', name: 'Le Nid', role: 'OWNER' },
  { id: 'h2', name: 'Le Chalet', role: 'ADMIN' },
  { id: 'h3', name: 'Chez Sam', role: 'MEMBER' },
];

jest.mock('../providers/HouseholdProvider', () => ({
  useHousehold: () => ({ householdId: mockHouseholdId, households: mockHouseholds }),
}));

describe('useCurrentHouseholdRole', () => {
  it.each([
    ['h1', { role: 'OWNER', isAdmin: true, isOwner: true }],
    ['h2', { role: 'ADMIN', isAdmin: true, isOwner: false }],
    ['h3', { role: 'MEMBER', isAdmin: false, isOwner: false }],
  ])('derives the role of the selected household %s', async (householdId, expected) => {
    mockHouseholdId = householdId;
    const { result } = await renderHook(() => useCurrentHouseholdRole());
    expect(result.current).toEqual(expected);
  });

  it('grants nothing without a selected household', async () => {
    mockHouseholdId = null;
    const { result } = await renderHook(() => useCurrentHouseholdRole());
    expect(result.current).toEqual({ role: undefined, isAdmin: false, isOwner: false });
  });
});
