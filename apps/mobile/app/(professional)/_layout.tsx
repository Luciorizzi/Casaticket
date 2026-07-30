import { Tabs } from 'expo-router';
import { createTabIcon, sharedTabScreenOptions } from '@/components/ui/app-tab-bar';

export default function ProfessionalLayout() {
  return (
    <Tabs
      screenOptions={sharedTabScreenOptions}
    >
      <Tabs.Screen
        name="home"
        options={{ tabBarIcon: createTabIcon('home-outline', 'home'), title: 'Inicio' }}
      />
      <Tabs.Screen
        name="opportunities"
        options={{ tabBarIcon: createTabIcon('briefcase-outline', 'briefcase'), title: 'Oportunidades' }}
      />
      <Tabs.Screen name="opportunities/[id]" options={{ href: null, title: 'Detalle' }} />
      <Tabs.Screen
        name="jobs"
        options={{ tabBarIcon: createTabIcon('hammer-outline', 'hammer'), title: 'Mis trabajos' }}
      />
      <Tabs.Screen name="jobs/[jobId]" options={{ href: null, title: 'Trabajo' }} />
      <Tabs.Screen name="jobs/[jobId]/visit" options={{ href: null, title: 'Visita' }} />
      <Tabs.Screen name="jobs/[jobId]/diagnosis" options={{ href: null, title: 'Diagnóstico' }} />
      <Tabs.Screen name="jobs/[jobId]/quote" options={{ href: null, title: 'Presupuesto' }} />
      <Tabs.Screen name="jobs/[jobId]/payment" options={{ href: null, title: 'Pago' }} />
      <Tabs.Screen name="jobs/[jobId]/execution" options={{ href: null, title: 'Ejecución' }} />
      <Tabs.Screen name="jobs/[jobId]/completion" options={{ href: null, title: 'Finalización' }} />
      <Tabs.Screen
        name="profile"
        options={{ tabBarIcon: createTabIcon('person-circle-outline', 'person-circle'), title: 'Perfil' }}
      />
      <Tabs.Screen name="profile/personal" options={{ href: null, title: 'Datos personales' }} />
      <Tabs.Screen name="profile/categories" options={{ href: null, title: 'Rubros y especialidades' }} />
      <Tabs.Screen name="profile/work-area" options={{ href: null, title: 'Zona de trabajo' }} />
      <Tabs.Screen name="profile/availability" options={{ href: null, title: 'Disponibilidad' }} />
      <Tabs.Screen name="profile/description" options={{ href: null, title: 'Descripción profesional' }} />
      <Tabs.Screen name="profile/avatar" options={{ href: null, title: 'Foto de perfil' }} />
      <Tabs.Screen name="profile/portfolio" options={{ href: null, title: 'Portfolio' }} />
    </Tabs>
  );
}
