import { fireEvent } from '@testing-library/react-native';

import { renderWithTheme } from '../test-utils/renderWithTheme';

import { formatRatingLabel, StarRating } from './StarRating';

describe('formatRatingLabel', () => {
  it('formats whole numbers without a decimal', () => {
    expect(formatRatingLabel(3)).toBe('3');
  });

  it('formats half values with a French comma', () => {
    expect(formatRatingLabel(3.5)).toBe('3,5');
  });
});

describe('StarRating', () => {
  it('read-only: exposes the rating as a single accessible summary, with no buttons', async () => {
    const view = await renderWithTheme(<StarRating value={3.5} readOnly />);

    expect(view.getByLabelText('Note : 3,5 sur 5')).toBeTruthy();
    expect(view.queryAllByRole('button')).toHaveLength(0);
  });

  it('read-only: announces "Pas de note" when there is no value', async () => {
    const view = await renderWithTheme(<StarRating value={null} readOnly />);
    expect(view.getByLabelText('Pas de note')).toBeTruthy();
  });

  it('editable: tapping the right half of a star sets the full-star value', async () => {
    const onChange = jest.fn();
    const view = await renderWithTheme(<StarRating value={null} onChange={onChange} />);

    fireEvent.press(view.getByLabelText('3 sur 5'));

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('editable: tapping the left half of a star sets the half-star value', async () => {
    const onChange = jest.fn();
    const view = await renderWithTheme(<StarRating value={null} onChange={onChange} />);

    fireEvent.press(view.getByLabelText('2,5 sur 5'));

    expect(onChange).toHaveBeenCalledWith(2.5);
  });

  it('editable: tapping the currently-selected value again clears the rating', async () => {
    const onChange = jest.fn();
    const view = await renderWithTheme(<StarRating value={4} onChange={onChange} />);

    fireEvent.press(view.getByLabelText('4 sur 5'));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
