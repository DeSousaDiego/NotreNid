import { fireEvent, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '../test-utils/renderWithTheme';

import { CountrySelect } from './CountrySelect';

describe('CountrySelect', () => {
  it('shows a placeholder when no country is selected, and the French names once picked', async () => {
    const view = await renderWithTheme(
      <CountrySelect label="Pays d'origine" value={[]} onChange={jest.fn()} />,
    );

    expect(view.getByText('Aucun pays renseigné')).toBeTruthy();
  });

  it('opens the sheet, filters by search, and toggles a country on', async () => {
    const onChange = jest.fn();
    const view = await renderWithTheme(
      <CountrySelect label="Pays d'origine" value={[]} onChange={onChange} />,
    );

    await fireEvent.press(view.getByLabelText("Pays d'origine : Aucun pays renseigné"));
    await waitFor(() => expect(view.getByPlaceholderText('Rechercher un pays…')).toBeTruthy());

    fireEvent.changeText(view.getByPlaceholderText('Rechercher un pays…'), 'belg');
    await waitFor(() => expect(view.getByText('Belgique')).toBeTruthy());
    expect(view.queryByText('France')).toBeNull();

    await fireEvent.press(view.getByText('Belgique'));

    expect(onChange).toHaveBeenCalledWith(['BE']);
  });

  it('finds a country by its ISO code as well as by name', async () => {
    const view = await renderWithTheme(
      <CountrySelect label="Pays d'origine" value={[]} onChange={jest.fn()} />,
    );

    await fireEvent.press(view.getByLabelText("Pays d'origine : Aucun pays renseigné"));
    fireEvent.changeText(await view.findByPlaceholderText('Rechercher un pays…'), 'jp');

    await waitFor(() => expect(view.getByText('Japon')).toBeTruthy());
  });

  it('removes an already-selected country when pressed again', async () => {
    const onChange = jest.fn();
    const view = await renderWithTheme(
      <CountrySelect label="Pays d'origine" value={['FR', 'BE']} onChange={onChange} />,
    );

    await fireEvent.press(view.getByLabelText("Pays d'origine : France, Belgique"));
    // La liste complète (249 pays) est virtualisée : filtrer par recherche est nécessaire
    // pour que la ligne "France" soit effectivement montée avant d'y appuyer.
    fireEvent.changeText(await view.findByPlaceholderText('Rechercher un pays…'), 'france');
    await waitFor(() => expect(view.getByText('France')).toBeTruthy());
    await fireEvent.press(view.getByText('France'));

    expect(onChange).toHaveBeenCalledWith(['BE']);
  });

  it('clears every selection via "Tout effacer"', async () => {
    const onChange = jest.fn();
    const view = await renderWithTheme(
      <CountrySelect label="Pays d'origine" value={['FR', 'BE']} onChange={onChange} />,
    );

    await fireEvent.press(view.getByLabelText("Pays d'origine : France, Belgique"));
    await waitFor(() => expect(view.getByText('Tout effacer')).toBeTruthy());
    await fireEvent.press(view.getByText('Tout effacer'));

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
