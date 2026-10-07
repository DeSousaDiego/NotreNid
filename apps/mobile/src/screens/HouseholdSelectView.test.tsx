import { fireEvent, render } from '@testing-library/react-native';

import { ThemeProvider } from '../theme';

import { HouseholdSelectView } from './HouseholdSelectView';

// expo-image's module-level analytics-integration probing isn't compatible with this
// jest environment; the components barrel pulls it in via ItemCard.
jest.mock('expo-image', () => ({ Image: () => null }));

const BASE = {
  createdById: 'user-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const HOUSEHOLDS = [
  { ...BASE, id: 'h1', name: 'Le Nid', role: 'OWNER' as const },
  {
    ...BASE,
    id: 'h2',
    name: 'La maison de famille au bord du lac, celle des grands étés',
    role: 'MEMBER' as const,
  },
];

describe('HouseholdSelectView', () => {
  it('lists each household with its human role, never a technical role name', async () => {
    const view = await render(
      <ThemeProvider fontsLoaded={false}>
        <HouseholdSelectView households={HOUSEHOLDS} onSelect={jest.fn()} />
      </ThemeProvider>,
    );

    expect(view.getByText('Choisissez votre nid')).toBeTruthy();
    expect(view.getByText('Le Nid')).toBeTruthy();
    expect(view.getByText('Responsable du foyer')).toBeTruthy();
    expect(view.getByText('Membre du foyer')).toBeTruthy();
    expect(view.queryByText('OWNER')).toBeNull();
  });

  it('selects the pressed household', async () => {
    const onSelect = jest.fn();
    const view = await render(
      <ThemeProvider fontsLoaded={false}>
        <HouseholdSelectView households={HOUSEHOLDS} onSelect={onSelect} />
      </ThemeProvider>,
    );

    await fireEvent.press(
      view.getByRole('button', {
        name: 'La maison de famille au bord du lac, celle des grands étés, Membre du foyer',
      }),
    );

    expect(onSelect).toHaveBeenCalledWith('h2');
  });
});
