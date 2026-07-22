import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Category, ServiceRequestType, ServiceRequestUrgency } from '@casaticket/types';
import type { CreateServiceRequestInput } from '@casaticket/validation';
import { getServiceRequestTypeLabel, getServiceRequestUrgencyLabel } from '@casaticket/domain';
import { createServiceRequestSchema } from '@casaticket/validation';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CategorySelector } from '@/components/ui/category-selector';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { TextInput } from '@/components/ui/text-input';
import { colors } from '@/components/ui/theme';
import { DatePickerField } from '@/features/jobs/date-picker-field';

interface ServiceRequestFormProps {
  categories: Category[];
  categoriesError?: string | undefined;
  categoriesLoading?: boolean | undefined;
  initialValues: CreateServiceRequestInput;
  loading?: boolean;
  onRetryCategories?: (() => void) | undefined;
  onSubmit: (values: CreateServiceRequestInput) => Promise<void>;
}

const requestTypes: ServiceRequestType[] = [
  'quote',
  'diagnostic_visit',
  'specific_task',
  'unsure',
];
const urgencies: ServiceRequestUrgency[] = ['flexible', 'scheduled', 'soon', 'urgent'];

function ChoiceGroup<TValue extends string>({
  onChange,
  options,
  value,
}: {
  onChange: (value: TValue) => void;
  options: Array<{ label: string; value: TValue }>;
  value: TValue;
}) {
  return (
    <View style={styles.choiceGroup}>
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.choice, selected ? styles.choiceSelected : null]}
          >
            <Text style={[styles.choiceLabel, selected ? styles.choiceLabelSelected : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ServiceRequestForm({
  categories,
  categoriesError,
  categoriesLoading = false,
  initialValues,
  loading = false,
  onRetryCategories,
  onSubmit,
}: ServiceRequestFormProps) {
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    setValue,
    watch,
  } = useForm<CreateServiceRequestInput>({
    defaultValues: initialValues,
    resolver: zodResolver(createServiceRequestSchema),
  });
  const saving = loading || isSubmitting;
  const selectedCategoryId = watch('categoryId');
  const unsureCategory = watch('unsureCategory');

  return (
    <Card>
      <Controller
        control={control}
        name="title"
        render={({ field: { onBlur, onChange, value } }) => (
          <FormField error={errors.title?.message} label="Título breve">
            <TextInput
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Ejemplo: Pérdida debajo de la bacha"
              value={value}
            />
          </FormField>
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field: { onBlur, onChange, value } }) => (
          <FormField error={errors.description?.message} label="Descripción">
            <TextInput
              multiline
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Contá qué pasa, dónde ocurre y cualquier detalle útil."
              value={value}
            />
          </FormField>
        )}
      />
      <Controller
        control={control}
        name="categoryId"
        render={() => (
          <FormField error={errors.categoryId?.message} label="Categoría">
            <CategorySelector
              categories={categories}
              error={categoriesError}
              loading={categoriesLoading}
              onRetry={onRetryCategories}
              onToggle={(categoryId) => {
                setValue('categoryId', categoryId === selectedCategoryId ? null : categoryId, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                setValue('unsureCategory', false, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
              selectedIds={selectedCategoryId ? [selectedCategoryId] : []}
            />
          </FormField>
        )}
      />
      <Pressable
        onPress={() => {
          setValue('unsureCategory', !unsureCategory, {
            shouldDirty: true,
            shouldValidate: true,
          });
          setValue('categoryId', null, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }}
        style={[styles.unsure, unsureCategory ? styles.unsureSelected : null]}
      >
        <Text style={[styles.unsureText, unsureCategory ? styles.unsureTextSelected : null]}>
          No estoy seguro de la categoría
        </Text>
      </Pressable>
      {categoriesError ? (
        <ErrorState
          message="Podés reintentar cargar categorías o marcar que no estás seguro."
          onRetry={onRetryCategories}
          title="No pudimos cargar categorías"
        />
      ) : null}
      <Controller
        control={control}
        name="requestType"
        render={({ field: { onChange, value } }) => (
          <FormField error={errors.requestType?.message} label="Tipo de solicitud">
            <ChoiceGroup
              onChange={onChange}
              options={requestTypes.map((requestType) => ({
                label: getServiceRequestTypeLabel(requestType),
                value: requestType,
              }))}
              value={value}
            />
          </FormField>
        )}
      />
      <Controller
        control={control}
        name="urgency"
        render={({ field: { onChange, value } }) => (
          <FormField error={errors.urgency?.message} label="Urgencia">
            <ChoiceGroup
              onChange={onChange}
              options={urgencies.map((urgency) => ({
                label: getServiceRequestUrgencyLabel(urgency),
                value: urgency,
              }))}
              value={value}
            />
          </FormField>
        )}
      />
      <Controller
        control={control}
        name="addressText"
        render={({ field: { onBlur, onChange, value } }) => (
          <FormField error={errors.addressText?.message} label="Dirección">
            <TextInput onBlur={onBlur} onChangeText={onChange} value={value} />
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
        name="preferredDate"
        render={({ field: { onChange, value } }) => (
          <FormField error={errors.preferredDate?.message} label="Fecha preferida opcional">
            <DatePickerField
              allowClear
              disablePast
              onChange={onChange}
              placeholder="Seleccionar fecha preferida"
              value={value ?? null}
            />
          </FormField>
        )}
      />
      <Controller
        control={control}
        name="preferredTimeText"
        render={({ field: { onBlur, onChange, value } }) => (
          <FormField error={errors.preferredTimeText?.message} label="Horario opcional">
            <TextInput
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Ejemplo: mañanas, después de las 18"
              value={value ?? ''}
            />
          </FormField>
        )}
      />
      <Controller
        control={control}
        name="availabilityNotes"
        render={({ field: { onBlur, onChange, value } }) => (
          <FormField error={errors.availabilityNotes?.message} label="Notas de disponibilidad">
            <TextInput
              multiline
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Opcional: portero, mascotas, horarios a evitar, etc."
              value={value ?? ''}
            />
          </FormField>
        )}
      />
      <Button disabled={saving} onPress={handleSubmit(onSubmit)}>
        {saving ? 'Publicando...' : 'Publicar solicitud'}
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  choiceGroup: {
    gap: 10,
  },
  choice: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  choiceSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  choiceLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  choiceLabelSelected: {
    color: colors.accent,
  },
  unsure: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  unsureSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  unsureText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  unsureTextSelected: {
    color: colors.accent,
  },
});
