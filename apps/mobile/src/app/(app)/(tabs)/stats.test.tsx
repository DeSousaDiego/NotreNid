import { renderWithTheme } from '../../../test-utils/renderWithTheme';

import StatsScreen from './stats';

jest.mock('expo-image', () => ({ Image: () => null }));

describe('StatsScreen', () => {
  it('shows the title, the "coming soon" badge and the placeholder copy', async () => {
    const view = await renderWithTheme(<StatsScreen />);

    expect(view.getByText('Statistiques')).toBeTruthy();
    expect(view.getByText('À venir')).toBeTruthy();
    expect(view.getByText('Cette section est encore en préparation.')).toBeTruthy();
    expect(
      view.getByText(
        'Bientôt, vous pourrez y découvrir votre collection sous un nouvel angle, avec de nouvelles façons de la parcourir et de mieux la comprendre.',
      ),
    ).toBeTruthy();
    expect(
      view.getByText(
        'Encore un peu de patience, cette partie de Notre Nid arrivera prochainement.',
      ),
    ).toBeTruthy();
  });

  it('never mentions search, so no residual "Recherche" wording leaks into the new tab', async () => {
    const view = await renderWithTheme(<StatsScreen />);

    expect(view.queryByText(/recherch/i)).toBeNull();
  });
});
