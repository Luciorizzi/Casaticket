import { mobilePlaceholderLinks } from '@casaticket/ui';

import { PlaceholderScreen } from '@/features/navigation/placeholder-screen';

export default function RegisterScreen() {
  return (
    <PlaceholderScreen
      title="Registro"
      subtitle="Base visual para alta de usuarios y profesionales independientes."
      badge="Auth"
      links={mobilePlaceholderLinks}
    />
  );
}

