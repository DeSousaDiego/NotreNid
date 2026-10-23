import { renderWithTheme } from '../test-utils/renderWithTheme';
import { colors } from '../theme/colors';

import { ItemThumbnail, ITEM_THUMBNAIL_HEIGHT, ITEM_THUMBNAIL_WIDTH } from './ItemThumbnail';

jest.mock('expo-image', () => {
  const { Image } = jest.requireActual('react-native');
  return { Image };
});

type Node = { type: string; props: { style?: unknown; source?: unknown }; children?: unknown };

const flatStyle = (node: Node) =>
  Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));

function images(node: Node): Node[] {
  const own = node.type === 'Image' ? [node] : [];
  const children = Array.isArray(node.children) ? (node.children as Node[]) : [];
  return [...own, ...children.filter((c) => typeof c === 'object').flatMap(images)];
}

const CASES = [
  { slug: 'book', tint: colors.tintSage },
  { slug: 'cd', tint: colors.tintPeach },
  { slug: 'dvd', tint: colors.tintHoney },
  { slug: 'jeux-de-societe', tint: colors.tintLinen },
];

describe('ItemThumbnail', () => {
  it.each(CASES)(
    'uses the same portrait container on the $slug tint, with or without an image',
    async ({ slug, tint }) => {
      for (const uri of [null, 'https://example.com/cover.jpg']) {
        const view = await renderWithTheme(<ItemThumbnail uri={uri} categorySlug={slug} />);
        const root = view.toJSON() as Node;

        expect(flatStyle(root)).toEqual(
          expect.objectContaining({
            width: ITEM_THUMBNAIL_WIDTH,
            height: ITEM_THUMBNAIL_HEIGHT,
            backgroundColor: tint,
          }),
        );
      }
    },
  );

  it('shows the real image inside the tinted container when there is one', async () => {
    const view = await renderWithTheme(
      <ItemThumbnail uri="https://example.com/cd.jpg" categorySlug="cd" />,
    );

    const found = images(view.toJSON() as Node);
    expect(found).toHaveLength(1);
    expect(found[0]!.props.source).toEqual({ uri: 'https://example.com/cd.jpg' });
  });

  it('keeps the category illustration on the tint when there is no image', async () => {
    const view = await renderWithTheme(<ItemThumbnail uri={null} categorySlug="book" />);

    const found = images(view.toJSON() as Node);
    expect(found).toHaveLength(1);
    expect(found[0]!.props.source).not.toEqual(expect.objectContaining({ uri: expect.anything() }));
  });
});
