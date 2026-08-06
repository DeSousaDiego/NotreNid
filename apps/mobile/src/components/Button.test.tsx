import { fireEvent } from '@testing-library/react-native';

import { renderWithTheme } from '../test-utils/renderWithTheme';

import { Button } from './Button';

describe('Button', () => {
  it('appelle onPress lorsqu’il est pressé', async () => {
    const onPress = jest.fn();
    const view = await renderWithTheme(<Button label="Ajouter" onPress={onPress} />);

    await fireEvent.press(view.getByRole('button', { name: 'Ajouter' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('n’appelle pas onPress lorsqu’il est désactivé', async () => {
    const onPress = jest.fn();
    const view = await renderWithTheme(<Button label="Ajouter" onPress={onPress} disabled />);

    await fireEvent.press(view.getByRole('button', { name: 'Ajouter' }));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('n’appelle pas onPress pendant le chargement', async () => {
    const onPress = jest.fn();
    const view = await renderWithTheme(<Button label="Ajouter" onPress={onPress} loading />);

    await fireEvent.press(view.getByRole('button'));

    expect(onPress).not.toHaveBeenCalled();
  });
});
