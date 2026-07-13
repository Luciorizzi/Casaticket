import { mobilePlaceholderLinks } from '@casaticket/ui';

import { PlaceholderScreen } from '@/features/navigation/placeholder-screen';

export default function ProfileScreen() {
  return (
    <PlaceholderScreen
      title="Perfil"
      subtitle="Pantalla base para datos personales, rol y estado de onboarding."
      badge="Perfil"
      links={mobilePlaceholderLinks}
    />
  );
}

