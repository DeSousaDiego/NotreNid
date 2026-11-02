import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemeProvider } from '../theme';

import { AppErrorBoundary } from './AppErrorBoundary';

let shouldThrow = true;

function FragileScreen() {
  if (shouldThrow) {
    throw new Error('boom');
  }
  return <Text>Contenu de l’écran</Text>;
}

function renderInBoundary() {
  return render(
    <ThemeProvider fontsLoaded={false}>
      <AppErrorBoundary>
        <FragileScreen />
      </AppErrorBoundary>
    </ThemeProvider>,
  );
}

describe('AppErrorBoundary', () => {
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    shouldThrow = true;
    // React journalise lui-même l'erreur capturée : on garde la sortie de test lisible.
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('shows a Notre Nid fallback instead of a blank screen when a child throws while rendering', async () => {
    const view = await renderInBoundary();

    expect(view.getByTestId('app-error-boundary')).toBeTruthy();
    expect(view.getByText('Un petit souci dans le nid')).toBeTruthy();
    expect(view.queryByText('boom')).toBeNull();
  });

  it('renders the children again on "Réessayer" once the problem is gone', async () => {
    const view = await renderInBoundary();

    shouldThrow = false;
    await fireEvent.press(view.getByText('Réessayer'));

    expect(view.getByText('Contenu de l’écran')).toBeTruthy();
    expect(view.queryByTestId('app-error-boundary')).toBeNull();
  });

  it('comes back to the fallback if the child still fails after retrying', async () => {
    const view = await renderInBoundary();

    await fireEvent.press(view.getByText('Réessayer'));

    expect(view.getByTestId('app-error-boundary')).toBeTruthy();
  });

  it('renders the children untouched when nothing throws', async () => {
    shouldThrow = false;
    const view = await renderInBoundary();

    expect(view.getByText('Contenu de l’écran')).toBeTruthy();
  });
});
