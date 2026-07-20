const errorDictionary: Array<[string, string]> = [
  ['invalid login credentials', 'Revisa tu correo y contrasena e intenta de nuevo.'],
  ['email not confirmed', 'Todavia tenes que confirmar tu correo antes de ingresar.'],
  ['user already registered', 'Ya existe una cuenta registrada con ese correo.'],
  ['signup requires a valid password', 'La contrasena no cumple con los requisitos minimos.'],
  ['network', 'No pudimos conectarnos. Verifica tu conexion e intenta otra vez.'],
];

interface SupabaseErrorMetadata {
  code?: string | undefined;
  message?: string | undefined;
  details?: string | null | undefined;
  hint?: string | null | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getSupabaseErrorMetadata(error: unknown): SupabaseErrorMetadata {
  if (!isRecord(error)) {
    return {};
  }

  return {
    code: typeof error.code === 'string' ? error.code : undefined,
    message: typeof error.message === 'string' ? error.message : undefined,
    details: typeof error.details === 'string' || error.details === null ? error.details : undefined,
    hint: typeof error.hint === 'string' || error.hint === null ? error.hint : undefined,
  };
}

export function getUserFacingErrorMessage(error: unknown, fallback: string): string {
  const metadata = getSupabaseErrorMetadata(error);

  if (!metadata.message && !(error instanceof Error)) {
    return fallback;
  }

  const rawMessage = metadata.message ?? (error instanceof Error ? error.message : fallback);
  const normalizedMessage = rawMessage.toLowerCase();

  for (const [pattern, message] of errorDictionary) {
    if (normalizedMessage.includes(pattern)) {
      return message;
    }
  }

  return fallback;
}

export function logDevelopmentSupabaseError(context: string, error: unknown): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const metadata = getSupabaseErrorMetadata(error);

  console.error(`[${context}] Supabase error`, {
    code: metadata.code ?? null,
    message: metadata.message ?? null,
    details: metadata.details ?? null,
    hint: metadata.hint ?? null,
  });
}
