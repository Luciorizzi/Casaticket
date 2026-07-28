import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');
  const MockTabs = ({ children }: { children: unknown }) => React.createElement(View, null, children);
  MockTabs.Screen = ({ name, options }: { name: string; options: Record<string, unknown> }) => {
    if (options.href === null) return null;
    const renderIcon = options.tabBarIcon;
    return React.createElement(View, null,
      React.createElement(Text, null, String(options.title ?? name)),
      typeof renderIcon === 'function' ? renderIcon({ color: '#bb5e3c', focused: true, size: 24 }) : null,
      typeof renderIcon === 'function' ? renderIcon({ color: '#8c929b', focused: false, size: 24 }) : null,
    );
  };
  return { Tabs: MockTabs };
});

import CustomerLayout from '@/../app/(customer)/_layout';

describe('customer tab bar', () => {
  it('uses the shared active and inactive icon system for its four tabs', () => {
    render(<CustomerLayout />);
    expect(screen.getByText('Inicio')).toBeTruthy();
    expect(screen.getByText('Crear solicitud')).toBeTruthy();
    expect(screen.getByText('Mis solicitudes')).toBeTruthy();
    expect(screen.getByText('Perfil')).toBeTruthy();
    expect(screen.getByTestId('icon-home')).toBeTruthy();
    expect(screen.getByTestId('icon-add-circle-outline')).toBeTruthy();
    expect(screen.getByTestId('icon-receipt')).toBeTruthy();
    expect(screen.getByTestId('icon-person-circle-outline')).toBeTruthy();
  });
});
