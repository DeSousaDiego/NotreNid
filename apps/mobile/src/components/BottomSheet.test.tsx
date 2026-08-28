import { fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderWithTheme } from '../test-utils/renderWithTheme';

import { BottomSheet } from './BottomSheet';

describe('BottomSheet', () => {
  it('renders the title and children when visible', async () => {
    const view = await renderWithTheme(
      <BottomSheet visible onClose={jest.fn()} title="Filtres et tri">
        <Text>Contenu du panneau</Text>
      </BottomSheet>,
    );

    expect(view.getByText('Filtres et tri')).toBeTruthy();
    expect(view.getByText('Contenu du panneau')).toBeTruthy();
  });

  it('renders nothing visible when not visible', async () => {
    const view = await renderWithTheme(
      <BottomSheet visible={false} onClose={jest.fn()} title="Filtres et tri">
        <Text>Contenu du panneau</Text>
      </BottomSheet>,
    );

    expect(view.queryByText('Contenu du panneau')).toBeNull();
  });

  it('calls onClose when the close button is pressed', async () => {
    const onClose = jest.fn();
    const view = await renderWithTheme(
      <BottomSheet visible onClose={onClose} title="Filtres et tri">
        <Text>Contenu du panneau</Text>
      </BottomSheet>,
    );

    await fireEvent.press(view.getByLabelText('Fermer'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is pressed', async () => {
    const onClose = jest.fn();
    const view = await renderWithTheme(
      <BottomSheet visible onClose={onClose} title="Filtres et tri">
        <Text>Contenu du panneau</Text>
      </BottomSheet>,
    );

    await fireEvent.press(view.getByLabelText('Fermer le panneau'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders children directly (no nested ScrollView) when scrollable is false, e.g. a FlatList child', async () => {
    const view = await renderWithTheme(
      <BottomSheet visible onClose={jest.fn()} title="Catégorie" scrollable={false}>
        <Text>Option unique</Text>
      </BottomSheet>,
    );

    expect(view.getByText('Option unique')).toBeTruthy();
  });
});
