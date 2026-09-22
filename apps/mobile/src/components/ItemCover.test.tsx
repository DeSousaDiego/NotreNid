import { act } from '@testing-library/react-native';

import { renderWithTheme } from '../test-utils/renderWithTheme';

import { ItemCover } from './ItemCover';

type MockImageProps = { source?: { uri: string }; onError?: () => void } | null;
let lastImageProps: MockImageProps = null;
jest.mock('expo-image', () => ({
  Image: (props: MockImageProps) => {
    lastImageProps = props;
    return null;
  },
}));

type MockIllustrationProps = { slug: string; size: number } | null;
let lastIllustrationProps: MockIllustrationProps = null;
jest.mock('./CategoryIllustration', () => ({
  CategoryIllustration: (props: MockIllustrationProps) => {
    lastIllustrationProps = props;
    return null;
  },
}));

describe('ItemCover', () => {
  beforeEach(() => {
    lastImageProps = null;
    lastIllustrationProps = null;
  });

  it('shows the category illustration when there is no uri', async () => {
    await renderWithTheme(<ItemCover uri={null} categorySlug="book" illustrationSize={40} />);

    expect(lastImageProps).toBeNull();
    expect(lastIllustrationProps).toEqual({ slug: 'book', size: 40 });
  });

  it('shows the category illustration for an empty-string uri (same as no cover)', async () => {
    await renderWithTheme(<ItemCover uri="" categorySlug="cd" illustrationSize={32} />);

    expect(lastImageProps).toBeNull();
    expect(lastIllustrationProps).toEqual({ slug: 'cd', size: 32 });
  });

  it('shows the image when a valid uri is provided', async () => {
    await renderWithTheme(
      <ItemCover uri="https://example.test/cover.jpg" categorySlug="book" illustrationSize={40} />,
    );

    expect(lastIllustrationProps).toBeNull();
    expect(lastImageProps?.source).toEqual({ uri: 'https://example.test/cover.jpg' });
  });

  it('falls back to the category illustration when the image fails to load', async () => {
    await renderWithTheme(
      <ItemCover uri="https://example.test/broken.jpg" categorySlug="dvd" illustrationSize={64} />,
    );
    expect(lastImageProps?.onError).toBeTruthy();

    await act(async () => {
      lastImageProps!.onError!();
    });

    expect(lastIllustrationProps).toEqual({ slug: 'dvd', size: 64 });
  });

  it('gives the image another chance once the uri changes after a previous failure', async () => {
    const view = await renderWithTheme(
      <ItemCover uri="https://example.test/broken.jpg" categorySlug="dvd" illustrationSize={64} />,
    );
    await act(async () => {
      lastImageProps!.onError!();
    });
    expect(lastIllustrationProps).toEqual({ slug: 'dvd', size: 64 });

    lastIllustrationProps = null;
    await view.rerender(
      <ItemCover
        uri="https://example.test/new-cover.jpg"
        categorySlug="dvd"
        illustrationSize={64}
      />,
    );

    expect(lastIllustrationProps).toBeNull();
    expect(lastImageProps?.source).toEqual({ uri: 'https://example.test/new-cover.jpg' });
  });
});
