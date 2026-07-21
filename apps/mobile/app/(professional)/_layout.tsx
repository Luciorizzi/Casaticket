import { Tabs } from 'expo-router';

export default function ProfessionalLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#bb5e3c' }}>
      <Tabs.Screen name="home" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="opportunities" options={{ title: 'Oportunidades' }} />
      <Tabs.Screen name="opportunities/[id]" options={{ href: null, title: 'Detalle' }} />
      <Tabs.Screen name="jobs" options={{ title: 'Mis trabajos' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
