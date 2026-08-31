import { fireEvent } from '@testing-library/react-native';

import { mockItem } from '../test-utils/mockItem';
import { renderWithTheme } from '../test-utils/renderWithTheme';

import { ItemCard } from './ItemCard';

jest.mock('expo-image', () => {
  const { Image } = jest.requireActual('react-native');
  return { Image };
});

describe('ItemCard', () => {
  it('affiche le titre, l’information secondaire et déclenche onPress', async () => {
    const onPress = jest.fn();
    const item = mockItem();
    const view = await renderWithTheme(<ItemCard item={item} onPress={onPress} />);

    expect(view.getByText('Les Misérables')).toBeTruthy();
    expect(view.getByText('Victor Hugo')).toBeTruthy();

    await fireEvent.press(view.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('n’affiche aucune information secondaire lorsqu’elle est absente', async () => {
    const item = mockItem({ book: null, cd: null, dvd: null });
    const view = await renderWithTheme(<ItemCard item={item} onPress={jest.fn()} />);

    expect(view.queryByText('Victor Hugo')).toBeNull();
  });

  it('affiche la note lorsqu’elle est renseignée', async () => {
    const item = mockItem({ rating: 3.5 });
    const view = await renderWithTheme(<ItemCard item={item} onPress={jest.fn()} />);

    expect(view.getByLabelText('Note : 3.5 sur 5')).toBeTruthy();
  });

  it('n’affiche aucune étoile lorsque la note est absente', async () => {
    const item = mockItem({ rating: null });
    const view = await renderWithTheme(<ItemCard item={item} onPress={jest.fn()} />);

    expect(view.queryByLabelText(/Note :/)).toBeNull();
  });
});
