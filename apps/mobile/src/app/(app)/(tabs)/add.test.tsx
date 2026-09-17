import { render } from '@testing-library/react-native';

import AddItemTabFallback from './add';

const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockRouterReplace(...args) },
}));

describe('AddItemTabFallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects to the category-choice screen on mount, as a deep-link safety net', async () => {
    await render(<AddItemTabFallback />);

    expect(mockRouterReplace).toHaveBeenCalledWith('/(app)/add-item/category');
    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
  });

  it('never redirects again on a re-render — this must never be a useFocusEffect (that regression caused the Bloc 2 manual-test crash)', async () => {
    const view = await render(<AddItemTabFallback />);
    expect(mockRouterReplace).toHaveBeenCalledTimes(1);

    await view.rerender(<AddItemTabFallback />);

    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
  });
});
