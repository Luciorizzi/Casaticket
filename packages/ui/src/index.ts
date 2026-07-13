export interface MobilePlaceholderLink {
  href: string;
  label: string;
}

export interface AdminModuleLink {
  href: string;
  label: string;
  description: string;
}

export const mobilePlaceholderLinks: MobilePlaceholderLink[] = [
  { href: '/(auth)/login', label: 'Iniciar sesion' },
  { href: '/(auth)/register', label: 'Registrarse' },
  { href: '/(onboarding)/role-selection', label: 'Elegir rol' },
  { href: '/(customer)/home', label: 'Home cliente' },
  { href: '/(professional)/home', label: 'Home profesional' },
  { href: '/profile', label: 'Perfil' },
];

export const adminModuleLinks: AdminModuleLink[] = [
  { href: '/', label: 'Dashboard', description: 'Vista general del panel.' },
  { href: '/users', label: 'Usuarios', description: 'Moderacion y revision de usuarios.' },
  {
    href: '/professionals',
    label: 'Profesionales',
    description: 'Validacion y seguimiento de profesionales.',
  },
  { href: '/categories', label: 'Categorias', description: 'Configuracion de rubros.' },
  { href: '/requests', label: 'Solicitudes', description: 'Revision de solicitudes futuras.' },
  { href: '/claims', label: 'Reclamos', description: 'Gestion de reclamos y reportes.' },
  { href: '/settings', label: 'Configuracion', description: 'Ajustes operativos iniciales.' },
];

