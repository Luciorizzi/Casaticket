import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StyleSheet, Text } from 'react-native';

import type { CustomerOnboardingInput } from '@casaticket/validation';
import { customerOnboardingSchema } from '@casaticket/validation';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { TextInput } from '@/components/ui/text-input';

interface CustomerProfileFormProps {
  initialValues: CustomerOnboardingInput;
  loading?: boolean;
  onSubmit: (values: CustomerOnboardingInput) => Promise<void>;
  submitLabel: string;
}

export function CustomerProfileForm({
  initialValues,
  loading = false,
  onSubmit,
  submitLabel,
}: CustomerProfileFormProps) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerOnboardingInput>({
    defaultValues: initialValues,
    resolver: zodResolver(customerOnboardingSchema),
  });

  return (
    <Card>
      <Controller
        control={control}
        name="firstName"
        render={({ field: { onBlur, onChange, value } }) => (
          <FormField error={errors.firstName?.message} label="Nombre">
            <TextInput onBlur={onBlur} onChangeText={onChange} value={value} />
          </FormField>
        )}
      />
      <Controller
        control={control}
        name="lastName"
        render={({ field: { onBlur, onChange, value } }) => (
          <FormField error={errors.lastName?.message} label="Apellido">
            <TextInput onBlur={onBlur} onChangeText={onChange} value={value} />
          </FormField>
        )}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field: { onBlur, onChange, value } }) => (
          <FormField error={errors.phone?.message} label="Teléfono">
            <TextInput
              keyboardType="phone-pad"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          </FormField>
        )}
      />
      <Controller
        control={control}
        name="city"
        render={({ field: { onBlur, onChange, value } }) => (
          <FormField error={errors.city?.message} label="Ciudad">
            <TextInput onBlur={onBlur} onChangeText={onChange} value={value} />
          </FormField>
        )}
      />
      <Controller
        control={control}
        name="province"
        render={({ field: { onBlur, onChange, value } }) => (
          <FormField error={errors.province?.message} label="Provincia">
            <TextInput onBlur={onBlur} onChangeText={onChange} value={value} />
          </FormField>
        )}
      />
      <Controller
        control={control}
        name="initialAddress"
        render={({ field: { onBlur, onChange, value } }) => (
          <FormField
            error={errors.initialAddress?.message}
            hint="Opcional en esta fase. Si la completás, la guardamos como dirección inicial."
            label="Dirección inicial"
          >
            <TextInput
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Ejemplo: Calle 123, piso 2"
              value={value}
            />
          </FormField>
        )}
      />
      <Text style={styles.helperText}>
        La carga de avatar queda pendiente hasta cerrar una estrategia segura de selección y
        subida de archivos para Expo Go.
      </Text>
      <Button loading={loading || isSubmitting} onPress={handleSubmit(onSubmit)}>
        {submitLabel}
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  helperText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#675a49',
  },
});
