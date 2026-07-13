import { mobilePlaceholderLinks } from '@casaticket/ui';

import { PlaceholderScreen } from '@/features/navigation/placeholder-screen';

export default function ProfessionalHomeScreen() {
  return (
    <PlaceholderScreen
      title="Home profesional"
      subtitle="Placeholder navegable para oportunidades, radio de trabajo y disponibilidad."
      badge="Profesional"
      links={mobilePlaceholderLinks}
    />
  );
}

