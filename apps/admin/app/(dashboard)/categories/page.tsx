import { PlaceholderPage } from '@/components/placeholder-page';

export default function CategoriesPage() {
  return (
    <PlaceholderPage
      title="Categorias"
      eyebrow="Configuracion"
      description="Base del modulo donde se administraran los rubros configurables del marketplace."
      bullets={[
        'Las categorias viven en base de datos y no como constantes de interfaz.',
        'La fase actual deja listo el esqueleto tecnico del modulo.',
      ]}
    />
  );
}

