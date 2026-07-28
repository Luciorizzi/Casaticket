import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');
  const MockTabs = ({ children }: { children: unknown }) => React.createElement(View, null, children);
  MockTabs.Screen = ({ name, options }: { name: string; options: Record<string, unknown> }) => {
    if (options.href === null) return null;
    const renderIcon = options.tabBarIcon;
    return React.createElement(
      View,
      null,
      React.createElement(Text, null, String(options.title ?? name)),
      typeof renderIcon === 'function'
        ? renderIcon({ color: '#bb5e3c', focused: true, size: 24 })
        : null,
      typeof renderIcon === 'function'
        ? renderIcon({ color: '#8c929b', focused: false, size: 24 })
        : null,
    );
  };
  return { Tabs: MockTabs };
});

import ProfessionalLayout from '@/../app/(professional)/_layout';

describe('professional tab bar', () => {
  it('renders four clear tabs with active icons', () => {
    render(<ProfessionalLayout />);

    expect(screen.getByText('Inicio')).toBeTruthy();
    expect(screen.getByText('Oportunidades')).toBeTruthy();
    expect(screen.getByText('Mis trabajos')).toBeTruthy();
    expect(screen.getByText('Perfil')).toBeTruthy();
    expect(screen.getByTestId('icon-home')).toBeTruthy();
    expect(screen.getByTestId('icon-home-outline')).toBeTruthy();
    expect(screen.getByTestId('icon-briefcase')).toBeTruthy();
    expect(screen.getByTestId('icon-briefcase-outline')).toBeTruthy();
    expect(screen.getByTestId('icon-hammer')).toBeTruthy();
    expect(screen.getByTestId('icon-hammer-outline')).toBeTruthy();
    expect(screen.getByTestId('icon-person-circle')).toBeTruthy();
    expect(screen.getByTestId('icon-person-circle-outline')).toBeTruthy();
  });
});
