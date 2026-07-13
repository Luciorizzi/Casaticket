import { render, screen } from '@testing-library/react-native';

import { PlaceholderScreen } from '@/features/navigation/placeholder-screen';

describe('PlaceholderScreen', () => {
  it('renders the title and navigation links', () => {
    render(
      <PlaceholderScreen
        badge="Test"
        title="Pantalla base"
        subtitle="Descripcion de prueba"
        links={[
          { href: '/loading', label: 'Ir a carga' },
          { href: '/profile', label: 'Ir a perfil' },
        ]}
      />,
    );

    expect(screen.getByText('Pantalla base')).toBeTruthy();
    expect(screen.getByText('Ir a carga')).toBeTruthy();
    expect(screen.getByText('Ir a perfil')).toBeTruthy();
  });
});
