import { Tabs } from 'expo-router';
import { createTabIcon, sharedTabScreenOptions } from '@/components/ui/app-tab-bar';

export default function CustomerLayout() {
  return (
    <Tabs screenOptions={sharedTabScreenOptions}>
      <Tabs.Screen name="home" options={{ tabBarIcon: createTabIcon('home-outline', 'home'), title: 'Inicio' }} />
      <Tabs.Screen name="create-request" options={{ tabBarIcon: createTabIcon('add-circle-outline', 'add-circle'), title: 'Crear solicitud' }} />
      <Tabs.Screen name="requests" options={{ tabBarIcon: createTabIcon('receipt-outline', 'receipt'), title: 'Mis solicitudes' }} />
      <Tabs.Screen name="requests/[id]" options={{ href: null, title: 'Detalle' }} />
      <Tabs.Screen name="requests/[id]/details" options={{ href: null, title: 'Detalles' }} />
      <Tabs.Screen name="requests/[id]/applications/[applicationId]" options={{ href: null, title: 'Propuesta' }} />
      <Tabs.Screen name="jobs/[jobId]" options={{ href: null, title: 'Progreso' }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: createTabIcon('person-circle-outline', 'person-circle'), title: 'Perfil' }} />
      <Tabs.Screen name="profile/personal" options={{ href: null, title: 'Datos personales' }} />
      <Tabs.Screen name="profile/location" options={{ href: null, title: 'Ubicación' }} />
    </Tabs>
  );
}
