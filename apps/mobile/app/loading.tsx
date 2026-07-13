import { mobilePlaceholderLinks } from '@casaticket/ui';

import { PlaceholderScreen } from '@/features/navigation/placeholder-screen';

export default function LoadingScreen() {
  return (
    <PlaceholderScreen
      title="Fundacion tecnica lista"
      subtitle="Pantalla inicial para validar navegacion antes de conectar autenticacion, onboarding y datos reales."
      badge="Carga"
      links={mobilePlaceholderLinks}
    />
  );
}

