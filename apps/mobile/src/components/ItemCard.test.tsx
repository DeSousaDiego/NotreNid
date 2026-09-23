import { fireEvent } from '@testing-library/react-native';

import { mockItem } from '../test-utils/mockItem';
import { renderWithTheme } from '../test-utils/renderWithTheme';

import { itemCardAccessibilityLabel, ItemCard } from './ItemCard';

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

  it('expose un accessibilityLabel enrichi sur le Pressable, jamais seulement titre + catégorie', async () => {
    const item = mockItem({ rating: 4 });
    const view = await renderWithTheme(<ItemCard item={item} onPress={jest.fn()} />);

    expect(view.getByRole('button').props.accessibilityLabel).toBe(
      itemCardAccessibilityLabel(item),
    );
  });
});

describe('itemCardAccessibilityLabel', () => {
  it('reprend titre, catégorie, état et le propriétaire unique par défaut', () => {
    const item = mockItem();

    expect(itemCardAccessibilityLabel(item)).toBe(
      'Les Misérables, Livre, Bon état, propriétaire Alix',
    );
  });

  it('ajoute la note (virgule française) lorsqu’elle est renseignée', () => {
    const item = mockItem({ rating: 3.5 });

    expect(itemCardAccessibilityLabel(item)).toContain('note 3,5 sur 5');
  });

  it('omet tout segment de note lorsqu’elle est absente', () => {
    const item = mockItem({ rating: null });

    expect(itemCardAccessibilityLabel(item)).not.toContain('note');
  });

  it('nomme les deux propriétaires quand il y en a exactement deux', () => {
    const item = mockItem({
      owners: [
        {
          id: 'user-1',
          email: 'a@example.com',
          displayName: 'Alix',
          avatarUrl: null,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'user-2',
          email: 'b@example.com',
          displayName: 'Sam',
          avatarUrl: null,
          createdAt: '',
          updatedAt: '',
        },
      ],
    });

    expect(itemCardAccessibilityLabel(item)).toContain('propriétaires Alix et Sam');
  });

  it('reste concis (un compte, pas une liste de noms) à partir de trois propriétaires', () => {
    const item = mockItem({
      owners: [
        {
          id: 'user-1',
          email: 'a@example.com',
          displayName: 'Alix',
          avatarUrl: null,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'user-2',
          email: 'b@example.com',
          displayName: 'Sam',
          avatarUrl: null,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'user-3',
          email: 'c@example.com',
          displayName: 'Jo',
          avatarUrl: null,
          createdAt: '',
          updatedAt: '',
        },
      ],
    });

    expect(itemCardAccessibilityLabel(item)).toContain('3 propriétaires');
    expect(itemCardAccessibilityLabel(item)).not.toContain('Jo');
  });

  it('n’ajoute aucun segment propriétaire quand il n’y en a aucun', () => {
    const item = mockItem({ owners: [] });

    expect(itemCardAccessibilityLabel(item)).toBe('Les Misérables, Livre, Bon état');
  });
});
