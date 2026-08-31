import { fireEvent } from '@testing-library/react-native';

import { renderWithTheme } from '../test-utils/renderWithTheme';

import { InvitationCodeField } from './InvitationCodeField';

describe('InvitationCodeField', () => {
  it('formats a typed code with a separator and uppercases it', async () => {
    const onChangeText = jest.fn();
    const view = await renderWithTheme(
      <InvitationCodeField value="" onChangeText={onChangeText} />,
    );

    fireEvent.changeText(view.getByLabelText("Code d'invitation"), '7k4p2q9d');

    expect(onChangeText).toHaveBeenCalledWith('7K4P-2Q9D');
  });

  it('strips a pasted display prefix and existing separators before reformatting', async () => {
    const onChangeText = jest.fn();
    const view = await renderWithTheme(
      <InvitationCodeField value="" onChangeText={onChangeText} />,
    );

    fireEvent.changeText(view.getByLabelText("Code d'invitation"), 'NID-7k4p-2q9d');

    expect(onChangeText).toHaveBeenCalledWith('7K4P-2Q9D');
  });

  it('clears the value entirely rather than leaving a stray separator', async () => {
    const onChangeText = jest.fn();
    const view = await renderWithTheme(
      <InvitationCodeField value="7K4P-2Q9D" onChangeText={onChangeText} />,
    );

    fireEvent.changeText(view.getByLabelText("Code d'invitation"), '');

    expect(onChangeText).toHaveBeenCalledWith('');
  });
});
