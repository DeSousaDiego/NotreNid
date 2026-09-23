import { fireEvent } from '@testing-library/react-native';

import { renderWithTheme } from '../test-utils/renderWithTheme';

import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('shows no badge when badgeCount is omitted', async () => {
    const view = await renderWithTheme(
      <IconButton name="options-outline" accessibilityLabel="Filtres" />,
    );

    expect(view.queryByText('0')).toBeNull();
  });

  it('shows no badge when badgeCount is 0', async () => {
    const view = await renderWithTheme(
      <IconButton name="options-outline" accessibilityLabel="Filtres" badgeCount={0} />,
    );

    expect(view.queryByText('0')).toBeNull();
  });

  it('shows the exact count for 1-9', async () => {
    const view = await renderWithTheme(
      <IconButton name="options-outline" accessibilityLabel="Filtres" badgeCount={3} />,
    );

    expect(view.getByText('3')).toBeTruthy();
  });

  it('caps the display at "9+" beyond 9, without touching accessibilityLabel', async () => {
    const view = await renderWithTheme(
      <IconButton
        name="options-outline"
        accessibilityLabel="Filtres (12 actifs)"
        badgeCount={12}
      />,
    );

    expect(view.getByText('9+')).toBeTruthy();
    expect(view.getByRole('button').props.accessibilityLabel).toBe('Filtres (12 actifs)');
  });

  it('keeps a 44×44 touch target regardless of the badge', async () => {
    const view = await renderWithTheme(
      <IconButton name="options-outline" accessibilityLabel="Filtres" badgeCount={3} />,
    );

    const button = view.getByRole('button');
    const flattenedStyle = [button.props.style].flat();
    const sized = flattenedStyle.find(
      (entry: { width?: number } | ((state: { pressed: boolean }) => { width?: number })) =>
        typeof entry === 'function' ? entry({ pressed: false }).width === 44 : entry?.width === 44,
    );
    expect(sized).toBeTruthy();
  });

  it('still fires onPress with a badge shown', async () => {
    const onPress = jest.fn();
    const view = await renderWithTheme(
      <IconButton
        name="options-outline"
        accessibilityLabel="Filtres"
        badgeCount={2}
        onPress={onPress}
      />,
    );

    await fireEvent.press(view.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
