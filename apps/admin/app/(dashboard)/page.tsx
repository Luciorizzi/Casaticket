import { PlaceholderPage } from '@/components/placeholder-page';

export default function DashboardPage() {
  return (
    <PlaceholderPage
      title="Dashboard inicial"
      eyebrow="Estado operativo"
      description="Tablero de arranque para moderacion, auditoria y seguimiento de modulos aun no implementados."
      bullets={[
        'Resumen tecnico del ecosistema CasaTicket.',
        'Accesos a modulos administrativos placeholder.',
        'Base preparada para permisos, auditoria y flujos operativos.',
      ]}
    />
  );
}

