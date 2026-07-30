export function supportsRemotePushRegistration(appOwnership: string | null | undefined): boolean {
  return appOwnership !== 'expo';
}
