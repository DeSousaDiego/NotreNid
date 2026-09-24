import { fireEvent } from '@testing-library/react-native';

import { mockItem } from '../test-utils/mockItem';
import { renderWithTheme } from '../test-utils/renderWithTheme';

import { RecentItemRow, recentItemAccessibilityLabel } from './RecentItemRow';

jest.mock('expo-image', () => {
  const { Image } = jest.requireActual('react-native');
  return { Image };
});

describe('RecentItemRow', () => {
  it('shows title, secondary info and "Ajouté par… · date", and calls onPress', async () => {
    const onPress = jest.fn();
    const item = mockItem({ createdAt: new Date().toISOString() });
    const view = await renderWithTheme(<RecentItemRow item={item} onPress={onPress} />);

    expect(view.getByText('Les Misérables')).toBeTruthy();
    expect(view.getByText('Victor Hugo')).toBeTruthy();
    expect(view.getByText("Ajouté par Alix · Aujourd'hui")).toBeTruthy();

    await fireEvent.press(view.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows the category badge next to a real cover', async () => {
    const item = mockItem({ coverImageUrl: 'https://cdn.test/cover.jpg' });
    const view = await renderWithTheme(<RecentItemRow item={item} onPress={jest.fn()} />);

    expect(view.getByText('Livre')).toBeTruthy();
  });

  it('omits the category badge when the cover fallback already shows the category illustration', async () => {
    const item = mockItem({ coverImageUrl: null });
    const view = await renderWithTheme(<RecentItemRow item={item} onPress={jest.fn()} />);

    expect(view.queryByText('Livre')).toBeNull();
  });

  it('exposes a concise accessible label with title, category, author, creator and date', async () => {
    const item = mockItem({ createdAt: new Date().toISOString() });
    const view = await renderWithTheme(<RecentItemRow item={item} onPress={jest.fn()} />);

    expect(
      view.getByLabelText("Les Misérables, Livre, Victor Hugo, ajouté par Alix, aujourd'hui"),
    ).toBeTruthy();
  });

  it('skips the secondary info in the label when there is none, and formats older dates', () => {
    const now = new Date(2026, 8, 24, 10, 0);
    const item = mockItem({
      book: null,
      createdAt: new Date(2026, 8, 23, 18, 0).toISOString(),
    });

    expect(recentItemAccessibilityLabel(item, now)).toBe(
      'Les Misérables, Livre, ajouté par Alix, hier',
    );
  });
});
