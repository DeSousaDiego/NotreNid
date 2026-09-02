import { renderWithTheme } from '../test-utils/renderWithTheme';

import { CategoryIllustration } from './CategoryIllustration';

let lastImageSource: unknown;
jest.mock('expo-image', () => ({
  Image: (props: { source: unknown }) => {
    lastImageSource = props.source;
    return null;
  },
}));

describe('CategoryIllustration', () => {
  beforeEach(() => {
    lastImageSource = undefined;
  });

  it('renders the official illustration for each system category', async () => {
    await renderWithTheme(<CategoryIllustration slug="book" size={40} />);
    expect(lastImageSource).toBeTruthy();

    lastImageSource = undefined;
    await renderWithTheme(<CategoryIllustration slug="cd" size={40} />);
    expect(lastImageSource).toBeTruthy();

    lastImageSource = undefined;
    await renderWithTheme(<CategoryIllustration slug="dvd" size={40} />);
    expect(lastImageSource).toBeTruthy();
  });

  it('falls back to the generic icon for a custom category with no dedicated illustration', async () => {
    const view = await renderWithTheme(<CategoryIllustration slug="board-games" size={40} />);

    expect(lastImageSource).toBeUndefined();
    // Aucun crash, un repli visuel (icône générique) est bien rendu à la place.
    expect(view.toJSON()).toBeTruthy();
  });
});
