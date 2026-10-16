import type { PublicUser } from '@notre-nid/shared';
import { fireEvent } from '@testing-library/react-native';

import { mockItem } from '../test-utils/mockItem';
import { renderWithTheme } from '../test-utils/renderWithTheme';

import { itemCardAccessibilityLabel, ItemCard } from './ItemCard';

jest.mock('expo-image', () => {
  const { Image } = jest.requireActual('react-native');
  return { Image };
});

function user(id: string, displayName: string): PublicUser {
  return {
    id,
    email: `${id}@example.com`,
    displayName,
    avatarUrl: null,
    createdAt: '',
    updatedAt: '',
  };
}

const flatStyle = (node: { props: { style?: unknown } }) =>
  Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));

describe('ItemCard', () => {
  it('affiche le titre, le créateur et déclenche onPress', async () => {
    const onPress = jest.fn();
    const view = await renderWithTheme(<ItemCard item={mockItem()} onPress={onPress} />);

    expect(view.getByText('Les Misérables')).toBeTruthy();
    expect(view.getByText('Victor Hugo')).toBeTruthy();

    await fireEvent.press(view.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('laisse le titre tenir sur deux lignes au plus, jamais une seule', async () => {
    const title = 'Le Seigneur des anneaux : La Communauté de l’anneau, édition illustrée';
    const view = await renderWithTheme(<ItemCard item={mockItem({ title })} onPress={jest.fn()} />);

    expect(view.getByText(title).props.numberOfLines).toBe(2);
  });

  it('affiche « créateur · année » quand les deux sont connus', async () => {
    const base = mockItem();
    const item = mockItem({ book: { ...base.book!, publicationYear: 1862 } });
    const view = await renderWithTheme(<ItemCard item={item} onPress={jest.fn()} />);

    expect(view.getByText('Victor Hugo · 1862')).toBeTruthy();
  });

  it('montre l’artiste et l’année pour un CD', async () => {
    const item = mockItem({
      title: 'The Dark Side of the Moon',
      category: { ...mockItem().category, id: 'category-cd', slug: 'cd', name: 'CD' },
      book: null,
      cd: { itemId: 'item-1', artist: 'Pink Floyd', releaseYear: 1973, label: null, format: null },
    });
    const view = await renderWithTheme(<ItemCard item={item} onPress={jest.fn()} />);

    expect(view.getByText('Pink Floyd · 1973')).toBeTruthy();
  });

  it('n’invente aucune ligne secondaire lorsqu’elle est absente', async () => {
    const item = mockItem({ book: null, cd: null, dvd: null });
    const view = await renderWithTheme(<ItemCard item={item} onPress={jest.fn()} />);

    expect(view.queryByText('Victor Hugo')).toBeNull();
    expect(view.queryByText(/·/)).toBeNull();
  });

  it('nomme le ou les propriétaires en toutes lettres', async () => {
    const single = await renderWithTheme(<ItemCard item={mockItem()} onPress={jest.fn()} />);
    expect(single.getByText('À Alix')).toBeTruthy();

    const two = await renderWithTheme(
      <ItemCard
        item={mockItem({ owners: [user('u1', 'Julie'), user('u2', 'Diego')] })}
        onPress={jest.fn()}
      />,
    );
    expect(two.getByText('À Julie et Diego')).toBeTruthy();
  });

  it('résume au-delà de deux propriétaires pour garder une ligne courte', async () => {
    const view = await renderWithTheme(
      <ItemCard
        item={mockItem({
          owners: [user('u1', 'Julie'), user('u2', 'Diego'), user('u3', 'Sam')],
        })}
        onPress={jest.fn()}
      />,
    );

    expect(view.getByText('À Julie et 2 autres')).toBeTruthy();
  });

  it('affiche une note compacte lorsqu’elle est renseignée, et rien sinon', async () => {
    const rated = await renderWithTheme(
      <ItemCard item={mockItem({ rating: 3.5 })} onPress={jest.fn()} />,
    );
    expect(rated.getByTestId('item-card-rating')).toBeTruthy();
    expect(rated.getByText('3,5')).toBeTruthy();

    const unrated = await renderWithTheme(
      <ItemCard item={mockItem({ rating: null })} onPress={jest.fn()} />,
    );
    expect(unrated.queryByTestId('item-card-rating')).toBeNull();
  });

  it('n’affiche plus ni badge d’état ni badge de catégorie', async () => {
    const view = await renderWithTheme(<ItemCard item={mockItem()} onPress={jest.fn()} />);

    expect(view.queryByLabelText(/^État : /)).toBeNull();
    expect(view.queryByText('Bon état')).toBeNull();
    expect(view.queryByLabelText(/^Catégorie : /)).toBeNull();
  });

  it('garde la ligne basse en flexWrap pour le texte agrandi', async () => {
    const view = await renderWithTheme(
      <ItemCard item={mockItem({ rating: 4 })} onPress={jest.fn()} />,
    );

    expect(flatStyle(view.getByTestId('item-card-footer'))).toEqual(
      expect.objectContaining({ flexDirection: 'row', flexWrap: 'wrap' }),
    );
  });

  it('expose un accessibilityLabel complet sur le Pressable', async () => {
    const item = mockItem({ rating: 4 });
    const view = await renderWithTheme(<ItemCard item={item} onPress={jest.fn()} />);

    expect(view.getByRole('button').props.accessibilityLabel).toBe(
      itemCardAccessibilityLabel(item),
    );
  });
});

describe('itemCardAccessibilityLabel', () => {
  it('reprend titre, créateur, catégorie et propriétaire, sans l’état', () => {
    expect(itemCardAccessibilityLabel(mockItem())).toBe(
      'Les Misérables, Victor Hugo, Livre, appartient à Alix',
    );
  });

  it('sépare créateur et année par une virgule plutôt que le point médian', () => {
    const base = mockItem();
    const item = mockItem({ book: { ...base.book!, publicationYear: 1862 } });

    expect(itemCardAccessibilityLabel(item)).toContain('Victor Hugo, 1862');
  });

  it('ajoute la note (virgule française) lorsqu’elle est renseignée', () => {
    expect(itemCardAccessibilityLabel(mockItem({ rating: 3.5 }))).toContain('note 3,5 sur 5');
  });

  it('omet tout segment de note lorsqu’elle est absente', () => {
    expect(itemCardAccessibilityLabel(mockItem({ rating: null }))).not.toContain('note');
  });

  it('nomme jusqu’à trois propriétaires, puis résume', () => {
    expect(
      itemCardAccessibilityLabel(mockItem({ owners: [user('u1', 'Alix'), user('u2', 'Sam')] })),
    ).toContain('appartient à Alix et Sam');
    expect(
      itemCardAccessibilityLabel(
        mockItem({
          owners: [user('u1', 'Alix'), user('u2', 'Sam'), user('u3', 'Jo'), user('u4', 'Lou')],
        }),
      ),
    ).toContain('appartient à Alix, Sam et 2 autres');
  });
});
