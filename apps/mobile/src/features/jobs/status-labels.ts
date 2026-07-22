import type { JobStatus, ServiceRequestStatus } from '@casaticket/types';

export function getMobileJobStatusLabel(status: JobStatus): string {
  switch (status) {
    case 'coordination_pending':
      return 'Coordinando visita';
    case 'visit_proposed':
      return 'Visita propuesta';
    case 'visit_confirmed':
      return 'Visita confirmada';
    case 'diagnosis_pending':
      return 'Diagnóstico pendiente';
    case 'quote_pending':
      return 'Presupuesto pendiente';
    case 'quote_sent':
      return 'Presupuesto enviado';
    case 'quote_rejected':
      return 'Presupuesto rechazado';
    case 'quote_accepted':
      return 'Presupuesto aceptado';
    case 'cancelled':
      return 'Cancelada';
  }
}

export function getMobileServiceRequestStatusLabel(status: ServiceRequestStatus): string {
  switch (status) {
    case 'draft':
      return 'Borrador';
    case 'published':
      return 'Publicada';
    case 'receiving_applications':
      return 'Recibiendo postulaciones';
    case 'professional_selected':
      return 'Profesional seleccionado';
    case 'cancelled':
      return 'Cancelada';
  }
}
