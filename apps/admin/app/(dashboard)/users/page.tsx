import { PlaceholderPage } from '@/components/placeholder-page';

export default function UsersPage() {
  return (
    <PlaceholderPage
      title="Usuarios"
      eyebrow="Modulo placeholder"
      description="Espacio reservado para moderacion de usuarios, revision de perfiles y acciones de soporte."
      bullets={[
        'Listado y filtros se definiran en la siguiente fase.',
        'El modelo ya contempla roles y perfiles desacoplados de la interfaz.',
      ]}
    />
  );
}

