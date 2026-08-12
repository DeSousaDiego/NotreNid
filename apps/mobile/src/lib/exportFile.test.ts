import { shareExportFile, SharingUnavailableError } from './exportFile';

const mockFileInstance = {
  exists: false,
  uri: 'file:///cache/notre-nid-le-nid.json',
  delete: jest.fn(),
  create: jest.fn(),
  write: jest.fn(),
};

// A plain `function` (not `class`) constructor: babel-preset-expo lowers
// `class` to a `var`-hoisted IIFE, and babel-plugin-jest-hoist moves the
// require() that triggers this factory above that initializer — the class
// would read as `undefined` at call time. Function declarations don't have
// that problem (fully hoisted).
function MockFile() {
  return mockFileInstance;
}

jest.mock('expo-file-system', () => ({
  File: MockFile,
  Paths: { cache: 'file:///cache/' },
}));

const mockIsAvailableAsync = jest.fn();
const mockShareAsync = jest.fn();
jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => mockIsAvailableAsync(),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

describe('shareExportFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileInstance.exists = false;
  });

  it('writes the content to a cache file and opens the native share sheet', async () => {
    mockIsAvailableAsync.mockResolvedValue(true);

    await shareExportFile('Le Nid', 'json', '{"items":[]}');

    expect(mockFileInstance.create).toHaveBeenCalled();
    expect(mockFileInstance.write).toHaveBeenCalledWith('{"items":[]}');
    expect(mockShareAsync).toHaveBeenCalledWith(mockFileInstance.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Exporter la collection (JSON)',
    });
  });

  it('deletes a pre-existing file with the same name before recreating it', async () => {
    mockFileInstance.exists = true;
    mockIsAvailableAsync.mockResolvedValue(true);

    await shareExportFile('Le Nid', 'csv', 'id,title\n');

    expect(mockFileInstance.delete).toHaveBeenCalled();
    expect(mockFileInstance.create).toHaveBeenCalled();
  });

  it('throws SharingUnavailableError instead of reporting a silent success when sharing is unsupported', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);

    await expect(shareExportFile('Le Nid', 'json', '{}')).rejects.toBeInstanceOf(
      SharingUnavailableError,
    );
    expect(mockShareAsync).not.toHaveBeenCalled();
  });
});
