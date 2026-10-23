import type { ColorToken } from '../theme';
import { colors } from '../theme/colors';
import { ITEM_THUMBNAIL_HEIGHT, ITEM_THUMBNAIL_WIDTH } from '../components/ItemThumbnail';

interface Queryable {
  getAllByTestId: (testID: string) => { props: { style?: unknown } }[];
}

/** Styles aplatis de chaque miniature de liste (`ItemThumbnail`) rendue. */
export function thumbnailStyles(view: Queryable): Record<string, unknown>[] {
  return view
    .getAllByTestId('item-thumbnail')
    .map((node) => Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean)));
}

/** Ce que doit montrer toute miniature de liste : 48×64 sur la teinte attendue. */
export function expectedThumbnail(tint: ColorToken) {
  return expect.objectContaining({
    width: ITEM_THUMBNAIL_WIDTH,
    height: ITEM_THUMBNAIL_HEIGHT,
    backgroundColor: colors[tint],
  });
}
