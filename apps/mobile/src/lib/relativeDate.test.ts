import { formatRelativeDate } from './relativeDate';

// Dates construites en heure locale : `formatRelativeDate` compare des débuts de
// journée locaux, le test reste donc valable quel que soit le fuseau de la machine.
const NOW = new Date(2026, 8, 24, 10, 0, 0);

describe('formatRelativeDate', () => {
  it('returns "Aujourd\'hui" for any time earlier the same day', () => {
    expect(formatRelativeDate(new Date(2026, 8, 24, 0, 5).toISOString(), NOW)).toBe("Aujourd'hui");
  });

  it('returns "Hier" for the previous calendar day, even less than 24h ago', () => {
    expect(formatRelativeDate(new Date(2026, 8, 23, 23, 30).toISOString(), NOW)).toBe('Hier');
  });

  it('returns a long French date for older dates', () => {
    expect(formatRelativeDate(new Date(2026, 8, 12, 15, 0).toISOString(), NOW)).toMatch(
      /12 septembre 2026/,
    );
  });
});
