import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';

import type { ForgotPasswordInput, SignInInput, SignUpInput } from '@casaticket/validation';
import {
  forgotPasswordSchema,
  signInSchema,
  signUpSchema,
} from '@casaticket/validation';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Screen } from '@/components/ui/screen';
import { TextInput } from '@/components/ui/text-input';
import { colors } from '@/components/ui/theme';
import { useAuthSession } from '@/features/auth/auth-provider';

function PasswordAdornment({
  onPress,
  visible,
}: {
  onPress: () => void;
  visible: boolean;
}) {
  return (
    <Pressable onPress={onPress}>
      <Text style={styles.linkText}>{visible ? 'Ocultar' : 'Mostrar'}</Text>
    </Pressable>
  );
}

export function LoginScreen() {
  const { sessionState, signIn } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const sessionNotice = sessionState.status === 'unauthenticated' ? sessionState.error : null;
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    defaultValues: {
      email: '',
      password: '',
    },
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await signIn(values);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'No pudimos ingresar.');
    }
  });

  return (
    <Screen
      subtitle="Ingresá con tu correo para continuar con tu perfil y tus próximos trabajos."
      title="CasaTicket"
    >
      <Card>
        <Text style={styles.cardTitle}>Iniciar sesión</Text>
        <Controller
          control={control}
          name="email"
          render={({ field: { onBlur, onChange, value } }) => (
            <FormField error={errors.email?.message} label="Correo">
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="tucorreo@mail.com"
                returnKeyType="next"
                value={value}
              />
            </FormField>
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { onBlur, onChange, value } }) => (
            <FormField
              error={errors.password?.message}
              label="Contraseña"
              rightAdornment={
                <PasswordAdornment
                  onPress={() => setPasswordVisible((current) => !current)}
                  visible={passwordVisible}
                />
              }
            >
              <TextInput
                autoCapitalize="none"
                autoComplete="password"
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="Ingresá tu contraseña"
                secureTextEntry={!passwordVisible}
                value={value}
              />
            </FormField>
          )}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!error && sessionNotice ? <Text style={styles.error}>{sessionNotice}</Text> : null}
        <Button loading={isSubmitting} onPress={onSubmit}>
          Ingresar
        </Button>
      </Card>

      <View style={styles.linkGroup}>
        <Link href="/(auth)/register" style={styles.linkText}>
          Crear una cuenta
        </Link>
        <Link href="/(auth)/forgot-password" style={styles.linkText}>
          Recuperar contraseña
        </Link>
      </View>
    </Screen>
  );
}

export function RegisterScreen() {
  const { signUp } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await signUp(values);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'No pudimos crear tu cuenta.',
      );
    }
  });

  return (
    <Screen
      subtitle="Registrate para publicar tareas o para ofrecer tus servicios dentro de CasaTicket."
      title="Crear cuenta"
    >
      <Card>
        <Controller
          control={control}
          name="email"
          render={({ field: { onBlur, onChange, value } }) => (
            <FormField error={errors.email?.message} label="Correo">
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="tucorreo@mail.com"
                value={value}
              />
            </FormField>
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { onBlur, onChange, value } }) => (
            <FormField
              error={errors.password?.message}
              label="Contraseña"
              rightAdornment={
                <PasswordAdornment
                  onPress={() => setPasswordVisible((current) => !current)}
                  visible={passwordVisible}
                />
              }
            >
              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="Mínimo 8 caracteres"
                secureTextEntry={!passwordVisible}
                value={value}
              />
            </FormField>
          )}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onBlur, onChange, value } }) => (
            <FormField
              error={errors.confirmPassword?.message}
              label="Confirmar contraseña"
              rightAdornment={
                <PasswordAdornment
                  onPress={() => setConfirmPasswordVisible((current) => !current)}
                  visible={confirmPasswordVisible}
                />
              }
            >
              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="Repetí tu contraseña"
                secureTextEntry={!confirmPasswordVisible}
                value={value}
              />
            </FormField>
          )}
        />
        <Controller
          control={control}
          name="acceptTerms"
          render={({ field: { onChange, value } }) => (
            <Pressable onPress={() => onChange(!value)} style={styles.termsRow}>
              <View style={[styles.checkbox, value ? styles.checkboxSelected : null]} />
              <Text style={styles.termsText}>
                Acepto los términos y condiciones provisorios de la fase actual.
              </Text>
            </Pressable>
          )}
        />
        {errors.acceptTerms?.message ? (
          <Text style={styles.error}>{errors.acceptTerms.message}</Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button loading={isSubmitting} onPress={onSubmit}>
          Registrarme
        </Button>
      </Card>

      <Link href="/(auth)/login" style={styles.linkText}>
        Ya tengo cuenta
      </Link>
    </Screen>
  );
}

export function ForgotPasswordScreen() {
  const { sendPasswordReset } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    defaultValues: {
      email: '',
    },
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setSuccess(null);

    try {
      await sendPasswordReset(values);
      setSuccess(
        'Si el correo existe, te enviamos instrucciones para recuperar la contraseña. El deep link final todavía queda pendiente para una fase siguiente.',
      );
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'No pudimos enviar el correo de recuperación.',
      );
    }
  });

  return (
    <Screen
      subtitle="Te preparamos el envío del correo. El restablecimiento completo por deep link queda documentado para una fase siguiente."
      title="Recuperar contraseña"
    >
      <Card>
        <Controller
          control={control}
          name="email"
          render={({ field: { onBlur, onChange, value } }) => (
            <FormField error={errors.email?.message} label="Correo">
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="tucorreo@mail.com"
                value={value}
              />
            </FormField>
          )}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}
        <Button loading={isSubmitting} onPress={onSubmit}>
          Enviar correo
        </Button>
      </Card>

      <Link href="/(auth)/login" style={styles.linkText}>
        Volver al inicio de sesión
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  linkGroup: {
    gap: 12,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.danger,
  },
  success: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.success,
  },
  termsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    marginTop: 2,
  },
  checkboxSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
});
