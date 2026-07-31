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

import { DatePickerField, TimePickerField, datePickerTestUtils } from '@/features/jobs/date-picker-field';

describe('DatePickerField', () => {
  beforeEach(() => {
    mockDatePickerDate = new Date(2099, 6, 22);
  });

  it('returns dates as YYYY-MM-DD and displays them localized in Spanish', () => {
    const onChange = jest.fn();

    render(<DatePickerField onChange={onChange} value={null} />);

    fireEvent.press(screen.getByText('📅 Seleccionar fecha'));
    expect(screen.getByTestId('date-picker-surface')).toBeTruthy();
    fireEvent.press(screen.getByTestId('mock-date-time-picker'));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('Listo'));
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

describe('TimePickerField', () => {
  it('uses the native picker and normalizes the selected local time', () => {
    mockDatePickerDate = new Date(2026, 6, 31, 18, 5);
    const onChange = jest.fn();
    render(<TimePickerField onChange={onChange} value={null} />);
    fireEvent.press(screen.getByLabelText('Seleccionar horario'));
    fireEvent.press(screen.getByTestId('mock-date-time-picker'));
    expect(onChange).toHaveBeenCalledWith('18:05:00');
    expect(datePickerTestUtils.formatTime('18:05:00')).toBe('18:05');
    expect(datePickerTestUtils.formatTime('18:00pm')).toBe('Seleccionar horario');
  });

  it('keeps calendar dates in local time without converting through UTC', () => {
    const lateLocalDate = new Date(2026, 6, 31, 23, 59, 59);
    expect(datePickerTestUtils.toDateString(lateLocalDate)).toBe('2026-07-31');
  });

  it('preserves and displays a previously selected time', () => {
    render(<TimePickerField onChange={jest.fn()} value="09:30:00" />);
    expect(screen.getByText('09:30')).toBeTruthy();
  });
});
