import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';

import type { ProfessionalOnboardingInput } from '@casaticket/validation';
import { professionalOnboardingSchema } from '@casaticket/validation';

import { AvailabilitySelector } from '@/components/ui/availability-selector';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CategorySelector } from '@/components/ui/category-selector';
import { FormField } from '@/components/ui/form-field';
import { ProgressIndicator } from '@/components/ui/progress-indicator';
import { RadiusSelector } from '@/components/ui/radius-selector';
import { TextInput } from '@/components/ui/text-input';
import { listActiveCategories } from '@/features/categories/api';

interface ProfessionalProfileFormProps {
  initialValues: ProfessionalOnboardingInput;
  loading?: boolean;
  onSubmit: (values: ProfessionalOnboardingInput) => Promise<void>;
  submitLabel: string;
}

const steps = [
  ['firstName', 'lastName', 'phone', 'city', 'province'] as const,
  ['bio', 'yearsExperience', 'baseCity'] as const,
  ['categoryIds'] as const,
  ['serviceRadiusKm', 'availabilityStatus'] as const,
  [] as const,
];

export function ProfessionalProfileForm({
  initialValues,
  loading = false,
  onSubmit,
  submitLabel,
}: ProfessionalProfileFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    setValue,
    trigger,
    watch,
  } = useForm<ProfessionalOnboardingInput>({
    defaultValues: initialValues,
    resolver: zodResolver(professionalOnboardingSchema),
  });

  const categoryQuery = useQuery({
    queryKey: ['categories'],
    queryFn: listActiveCategories,
  });

  const categoryIds = watch('categoryIds');
  const availabilityStatus = watch('availabilityStatus');
  const serviceRadiusKm = watch('serviceRadiusKm');
  const preview = watch();

  const selectedCategoryLabels = useMemo(
    () =>
      (categoryQuery.data ?? [])
        .filter((category) => categoryIds.includes(category.id))
        .map((category) => category.name),
    [categoryIds, categoryQuery.data],
  );

  const nextStep = async () => {
    const fields = steps[currentStep] ?? [];
    if (fields.length > 0) {
      const stepIsValid = await trigger(fields);
      if (!stepIsValid) {
        return;
      }
    }

    setCurrentStep((value) => Math.min(value + 1, steps.length - 1));
  };

  const previousStep = () => {
    setCurrentStep((value) => Math.max(value - 1, 0));
  };

  return (
    <Card>
      <ProgressIndicator currentStep={currentStep + 1} totalSteps={steps.length} />
      {currentStep === 0 ? (
        <View style={styles.step}>
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
        </View>
      ) : null}

      {currentStep === 1 ? (
        <View style={styles.step}>
          <Controller
            control={control}
            name="bio"
            render={({ field: { onBlur, onChange, value } }) => (
              <FormField
                error={errors.bio?.message}
                hint="Contá tu experiencia, tus rubros y cómo trabajás."
                label="Descripción profesional"
              >
                <TextInput
                  multiline
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="Describí tu experiencia con al menos 40 caracteres."
                  value={value}
                />
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="yearsExperience"
            render={({ field: { onBlur, onChange, value } }) => (
              <FormField error={errors.yearsExperience?.message} label="Años de experiencia">
                <TextInput
                  keyboardType="number-pad"
                  onBlur={onBlur}
                  onChangeText={(text) => onChange(Number(text || 0))}
                  value={String(value)}
                />
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="baseCity"
            render={({ field: { onBlur, onChange, value } }) => (
              <FormField error={errors.baseCity?.message} label="Ciudad base">
                <TextInput onBlur={onBlur} onChangeText={onChange} value={value} />
              </FormField>
            )}
          />
        </View>
      ) : null}

      {currentStep === 2 ? (
        <View style={styles.step}>
          <FormField error={errors.categoryIds?.message} label="Rubros">
            <CategorySelector
              categories={categoryQuery.data ?? []}
              error={categoryQuery.error instanceof Error ? categoryQuery.error.message : undefined}
              loading={categoryQuery.isPending}
              onRetry={() => categoryQuery.refetch()}
              onToggle={(categoryId) => {
                const nextIds = categoryIds.includes(categoryId)
                  ? categoryIds.filter((item) => item !== categoryId)
                  : [...categoryIds, categoryId];
                setValue('categoryIds', nextIds, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
              selectedIds={categoryIds}
            />
          </FormField>
        </View>
      ) : null}

      {currentStep === 3 ? (
        <View style={styles.step}>
          <FormField error={errors.serviceRadiusKm?.message} label="Radio de trabajo">
            <RadiusSelector
              onChange={(value) =>
                setValue('serviceRadiusKm', value, { shouldDirty: true, shouldValidate: true })
              }
              value={serviceRadiusKm}
            />
          </FormField>
          <FormField error={errors.availabilityStatus?.message} label="Disponibilidad">
            <AvailabilitySelector
              onChange={(value) =>
                setValue('availabilityStatus', value, { shouldDirty: true, shouldValidate: true })
              }
              value={availabilityStatus}
            />
          </FormField>
        </View>
      ) : null}

      {currentStep === 4 ? (
        <View style={styles.step}>
          <Text style={styles.summaryTitle}>Confirmación</Text>
          <Text style={styles.summaryText}>
            Revisá que todo esté correcto antes de guardar tu perfil profesional.
          </Text>
          <View style={styles.summaryList}>
            <Text style={styles.summaryItem}>
              Nombre: {preview.firstName} {preview.lastName}
            </Text>
            <Text style={styles.summaryItem}>Teléfono: {preview.phone}</Text>
            <Text style={styles.summaryItem}>Ciudad: {preview.city}</Text>
            <Text style={styles.summaryItem}>Ciudad base: {preview.baseCity}</Text>
            <Text style={styles.summaryItem}>Radio: {preview.serviceRadiusKm} km</Text>
            <Text style={styles.summaryItem}>
              Rubros: {selectedCategoryLabels.join(', ') || 'Sin rubros seleccionados'}
            </Text>
          </View>
          <Text style={styles.avatarNote}>
            El avatar sigue siendo opcional y queda pendiente hasta completar una estrategia segura
            de carga de archivos para Expo Go.
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button disabled={currentStep === 0} onPress={previousStep} variant="secondary">
          Volver
        </Button>
        {currentStep < steps.length - 1 ? (
          <Button onPress={nextStep}>Continuar</Button>
        ) : (
          <Button loading={loading || isSubmitting} onPress={handleSubmit(onSubmit)}>
            {submitLabel}
          </Button>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  step: {
    gap: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1d1811',
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#675a49',
  },
  summaryList: {
    gap: 8,
  },
  summaryItem: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1d1811',
  },
  avatarNote: {
    fontSize: 13,
    lineHeight: 19,
    color: '#675a49',
  },
});
