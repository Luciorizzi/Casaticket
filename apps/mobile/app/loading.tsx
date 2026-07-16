import { Text } from 'react-native';

import { Card } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/loading-state';
import { Screen } from '@/components/ui/screen';
import { useAuthSession } from '@/features/auth/auth-provider';

export default function LoadingScreen() {
  const { sessionState } = useAuthSession();
  const message =
    sessionState.status === 'authenticated' && sessionState.error
      ? sessionState.error
      : 'Estamos preparando tu sesión para que entres sin vueltas.';

  return (
    <Screen
      scroll={false}
      subtitle="Restauramos tu sesión y resolvemos tu acceso según el perfil guardado."
      title="CasaTicket"
    >
      <Card>
        <LoadingState message="Cargando tu experiencia…" />
        <Text style={{ color: '#675a49', fontSize: 15, lineHeight: 22 }}>{message}</Text>
      </Card>
    </Screen>
  );
}
