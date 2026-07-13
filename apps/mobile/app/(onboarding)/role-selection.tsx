import { mobilePlaceholderLinks } from '@casaticket/ui';

import { MOBILE_SELECTABLE_ROLES } from '@casaticket/domain';

import { PlaceholderScreen } from '@/features/navigation/placeholder-screen';

export default function RoleSelectionScreen() {
  return (
    <PlaceholderScreen
      title="Seleccion de rol"
      subtitle={`Roles habilitados en la app: ${MOBILE_SELECTABLE_ROLES.join(' y ')}.`}
      badge="Onboarding"
      links={mobilePlaceholderLinks}
    />
  );
}

