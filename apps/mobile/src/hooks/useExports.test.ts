import { act, renderHook } from '@testing-library/react-native';

import { createMockApiClient } from '../test-utils/mockApiClient';
import { createQueryWrapper } from '../test-utils/queryWrapper';

import { useExportCollection } from './useExports';

const mockApiClient = createMockApiClient();

jest.mock('../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
}));

const mockShareExportFile = jest.fn();
jest.mock('../lib/exportFile', () => ({
  shareExportFile: (...args: unknown[]) => mockShareExportFile(...args),
}));

const HOUSEHOLD_ID = 'h1';

describe('useExportCollection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports JSON as pretty-printed text and shares it', async () => {
    (mockApiClient.exports.json as jest.Mock).mockResolvedValue([{ id: 'item-1', title: 'Dune' }]);
    const { wrapper } = createQueryWrapper();

    const { result } = await renderHook(() => useExportCollection(HOUSEHOLD_ID, 'Le Nid'), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('json');
    });

    expect(mockApiClient.exports.json).toHaveBeenCalledWith(HOUSEHOLD_ID);
    expect(mockShareExportFile).toHaveBeenCalledWith(
      'Le Nid',
      'json',
      JSON.stringify([{ id: 'item-1', title: 'Dune' }], null, 2),
    );
  });

  it('exports CSV as raw text and shares it', async () => {
    (mockApiClient.exports.csv as jest.Mock).mockResolvedValue('id,title\nitem-1,Dune\n');
    const { wrapper } = createQueryWrapper();

    const { result } = await renderHook(() => useExportCollection(HOUSEHOLD_ID, 'Le Nid'), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('csv');
    });

    expect(mockApiClient.exports.csv).toHaveBeenCalledWith(HOUSEHOLD_ID);
    expect(mockShareExportFile).toHaveBeenCalledWith('Le Nid', 'csv', 'id,title\nitem-1,Dune\n');
  });
});
