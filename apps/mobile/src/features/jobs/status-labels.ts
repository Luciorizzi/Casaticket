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
    case 'payment_pending':
      return 'Pendiente de pago';
    case 'quote_rejected':
      return 'Presupuesto rechazado';
    case 'quote_accepted':
      return 'Presupuesto aceptado';
    case 'ready_to_start':
      return 'Listo para iniciar';
    case 'in_progress':
      return 'Trabajo en curso';
    case 'review_pending':
      return 'Revisión del cliente';
    case 'completion_pending':
      return 'Esperando confirmación';
    case 'completed':
      return 'Trabajo completado';
    case 'disputed':
      return 'Problema reportado';
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
