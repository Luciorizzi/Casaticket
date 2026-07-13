import { mobilePlaceholderLinks } from '@casaticket/ui';

import { PlaceholderScreen } from '@/features/navigation/placeholder-screen';

export default function LoginScreen() {
  return (
    <PlaceholderScreen
      title="Inicio de sesion"
      subtitle="Placeholder de autenticacion. Supabase Auth se conectara en una fase siguiente."
      badge="Auth"
      links={mobilePlaceholderLinks}
    />
  );
}

