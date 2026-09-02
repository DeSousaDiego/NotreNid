import { act } from '@testing-library/react-native';

import { renderWithTheme } from '../test-utils/renderWithTheme';

import { Avatar } from './Avatar';

let mockOnError: (() => void) | undefined;
jest.mock('expo-image', () => ({
  Image: (props: { onError?: () => void }) => {
    mockOnError = props.onError;
    return null;
  },
}));

describe('Avatar', () => {
  it('falls back to initials when no avatarUrl is set', async () => {
    const view = await renderWithTheme(<Avatar displayName="Alix Barbosa" avatarUrl={null} />);

    expect(view.getByText('AB')).toBeTruthy();
  });

  it('falls back to a single initial for a one-word name', async () => {
    const view = await renderWithTheme(<Avatar displayName="Alix" avatarUrl={undefined} />);

    expect(view.getByText('A')).toBeTruthy();
  });

  it('renders the photo instead of initials when avatarUrl is set', async () => {
    const view = await renderWithTheme(
      <Avatar displayName="Alix Barbosa" avatarUrl="https://cdn.test/alix.jpg" />,
    );

    expect(view.queryByText('AB')).toBeNull();
  });

  it('falls back to initials if the remote image fails to load', async () => {
    const view = await renderWithTheme(
      <Avatar displayName="Alix Barbosa" avatarUrl="https://cdn.test/broken.jpg" />,
    );
    expect(view.queryByText('AB')).toBeNull();

    await act(async () => {
      mockOnError?.();
    });

    expect(view.getByText('AB')).toBeTruthy();
  });
});
