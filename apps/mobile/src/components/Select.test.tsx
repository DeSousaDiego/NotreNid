import { fireEvent, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '../test-utils/renderWithTheme';

import { Select } from './Select';

const OPTIONS = [
  { value: 'book', label: 'Livres' },
  { value: 'cd', label: 'CD' },
];

describe('Select', () => {
  it('opens the bottom sheet and renders every provided option', async () => {
    const onChange = jest.fn();
    const view = await renderWithTheme(
      <Select
        label="Catégorie"
        value={undefined}
        options={OPTIONS}
        onChange={onChange}
        allowClear={false}
        placeholder="Choisissez une catégorie"
      />,
    );

    await fireEvent.press(view.getByLabelText('Catégorie : Choisissez une catégorie'));

    await waitFor(() => expect(view.getByText('Livres')).toBeTruthy());
    expect(view.getByText('CD')).toBeTruthy();
  });

  it('calls onChange with the picked value and closes the sheet', async () => {
    const onChange = jest.fn();
    const view = await renderWithTheme(
      <Select
        label="Catégorie"
        value={undefined}
        options={OPTIONS}
        onChange={onChange}
        allowClear={false}
        placeholder="Choisissez une catégorie"
      />,
    );

    await fireEvent.press(view.getByLabelText('Catégorie : Choisissez une catégorie'));
    await waitFor(() => expect(view.getByText('Livres')).toBeTruthy());
    await fireEvent.press(view.getByText('Livres'));

    expect(onChange).toHaveBeenCalledWith('book');
  });

  it('shows an explicit empty message instead of a blank sheet when there are no options and no clear entry', async () => {
    const view = await renderWithTheme(
      <Select
        label="Catégorie"
        value={undefined}
        options={[]}
        onChange={jest.fn()}
        allowClear={false}
        placeholder="Choisissez une catégorie"
      />,
    );

    await fireEvent.press(view.getByLabelText('Catégorie : Choisissez une catégorie'));

    await waitFor(() =>
      expect(view.getByText('Aucune option disponible pour le moment.')).toBeTruthy(),
    );
  });

  it('still offers the clear/placeholder entry when allowClear is true, even with no options', async () => {
    const view = await renderWithTheme(
      <Select label="État" value={undefined} options={[]} onChange={jest.fn()} allowClear />,
    );

    await fireEvent.press(view.getByLabelText('État : Tous'));

    await waitFor(() => expect(view.getAllByText('Tous').length).toBeGreaterThan(0));
    expect(view.queryByText('Aucune option disponible pour le moment.')).toBeNull();
  });
});
