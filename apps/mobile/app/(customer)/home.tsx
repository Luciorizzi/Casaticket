import { mobilePlaceholderLinks } from '@casaticket/ui';

import { PlaceholderScreen } from '@/features/navigation/placeholder-screen';

export default function CustomerHomeScreen() {
  return (
    <PlaceholderScreen
      title="Home cliente"
      subtitle="Placeholder navegable para el flujo del usuario que publica solicitudes."
      badge="Cliente"
      links={mobilePlaceholderLinks}
    />
  );
}

