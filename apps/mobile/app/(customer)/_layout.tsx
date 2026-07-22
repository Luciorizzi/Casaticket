import { Tabs } from 'expo-router';

export default function CustomerLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#bb5e3c' }}>
      <Tabs.Screen name="home" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="create-request" options={{ title: 'Crear solicitud' }} />
      <Tabs.Screen name="requests" options={{ title: 'Mis solicitudes' }} />
      <Tabs.Screen name="requests/[id]" options={{ href: null, title: 'Detalle' }} />
      <Tabs.Screen name="requests/[id]/details" options={{ href: null, title: 'Detalles' }} />
      <Tabs.Screen name="requests/[id]/applications/[applicationId]" options={{ href: null, title: 'Propuesta' }} />
      <Tabs.Screen name="jobs/[jobId]" options={{ href: null, title: 'Progreso' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
