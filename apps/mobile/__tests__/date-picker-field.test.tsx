import { fireEvent, render, screen } from '@testing-library/react-native';

let mockDatePickerDate = new Date(2099, 6, 22);

jest.mock('@react-native-community/datetimepicker', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    __esModule: true,
    default: ({ onChange }: { onChange: (event: { type: string }, date?: Date) => void }) => (
      <Pressable onPress={() => onChange({ type: 'set' }, mockDatePickerDate)} testID="mock-date-time-picker">
        <Text>Mock calendar</Text>
      </Pressable>
    ),
  };
});

import { DatePickerField, datePickerTestUtils } from '@/features/jobs/date-picker-field';

describe('DatePickerField', () => {
  beforeEach(() => {
    mockDatePickerDate = new Date(2099, 6, 22);
  });

  it('returns dates as YYYY-MM-DD and displays them localized in Spanish', () => {
    const onChange = jest.fn();

    render(<DatePickerField onChange={onChange} value={null} />);

    fireEvent.press(screen.getByText('📅 Seleccionar fecha'));
    fireEvent.press(screen.getByTestId('mock-date-time-picker'));

    expect(onChange).toHaveBeenCalledWith('2099-07-22');
    expect(datePickerTestUtils.formatDate('2099-07-22', 'Seleccionar fecha')).toContain('julio');
  });

  it('allows optional dates to be cleared', () => {
    const onChange = jest.fn();

    render(<DatePickerField allowClear onChange={onChange} value="2099-07-22" />);

    fireEvent.press(screen.getByText('Limpiar fecha'));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
