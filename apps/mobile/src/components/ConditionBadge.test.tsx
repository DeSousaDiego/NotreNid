import { renderWithTheme } from '../test-utils/renderWithTheme';

import { ConditionBadge } from './ConditionBadge';

describe('ConditionBadge', () => {
  it('affiche toujours un libellé textuel, jamais uniquement une couleur', async () => {
    const view = await renderWithTheme(<ConditionBadge condition="VERY_GOOD" />);

    expect(view.getByText('Très bon état')).toBeTruthy();
  });

  it('affiche un libellé différent pour chaque état', async () => {
    const view = await renderWithTheme(<ConditionBadge condition="POOR" />);

    expect(view.getByText('État moyen')).toBeTruthy();
  });
});
