import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ApplicationProposalType } from '@casaticket/types';
import type { CreateApplicationInput } from '@casaticket/validation';
import { getApplicationProposalTypeLabel } from '@casaticket/domain';
import { createApplicationSchema } from '@casaticket/validation';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { TextInput } from '@/components/ui/text-input';
import { colors } from '@/components/ui/theme';

interface ApplicationFormProps {
  loading?: boolean;
  onSubmit: (values: CreateApplicationInput) => Promise<void>;
}

const proposalTypes: ApplicationProposalType[] = [
  'diagnostic_visit',
  'preliminary_quote',
  'ask_for_details',
  'direct_service',
];

function parseOptionalPrice(text: string): number | null {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return null;
  }

  const parsedValue = Number(trimmedText.replace(',', '.'));

  return Number.isFinite(parsedValue) ? parsedValue : Number.NaN;
}

export function ApplicationForm({ loading = false, onSubmit }: ApplicationFormProps) {
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
  } = useForm<CreateApplicationInput>({
    defaultValues: {
      message: '',
      proposalType: 'diagnostic_visit',
      visitPrice: null,
      estimatedPrice: null,
      estimatedDurationText: null,
      availabilityText: '',
    },
    resolver: zodResolver(createApplicationSchema),
  });
  const submitting = loading || isSubmitting;

  return (
    <Card>
      <Controller
        control={control}
        name="message"
        render={({ field: { onBlur, onChange, value } }) => (
          <FormField error={errors.message?.message} label="Mensaje para el cliente">
            <TextInput
              multiline
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Contá cómo podés ayudar y qué información necesitás."
              value={value}
            />
          </FormField>
        )}
      />
      <Controller
        control={control}
        name="proposalType"
        render={({ field: { onChange, value } }) => (
          <FormField error={errors.proposalType?.message} label="Tipo de propuesta">
            <View style={styles.choiceGroup}>
              {proposalTypes.map((proposalType) => {
                const selected = proposalType === value;

                return (
                  <Pressable
                    key={proposalType}
                    onPress={() => onChange(proposalType)}
                    style={[styles.choice, selected ? styles.choiceSelected : null]}
                  >
                    <Text style={[styles.choiceLabel, selected ? styles.choiceLabelSelected : null]}>
                      {getApplicationProposalTypeLabel(proposalType)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </FormField>
        )}
      />
      <Controller
        control={control}
        name="availabilityText"
        render={({ field: { onBlur, onChange, value } }) => (
          <FormField error={errors.availabilityText?.message} label="Disponibilidad">
            <TextInput
              multiline
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Ejemplo: puedo pasar martes o jueves por la tarde."
              value={value}
            />
          </FormField>
        )}
      />
      <Controller
        control={control}
        name="visitPrice"
        render={({ field: { onBlur, onChange, value } }) => (
          <FormField error={errors.visitPrice?.message} label="Precio de visita opcional">
            <TextInput
              keyboardType="decimal-pad"
              onBlur={onBlur}
              onChangeText={(text) => onChange(parseOptionalPrice(text))}
              placeholder="Ejemplo: 5000"
              value={value === null ? '' : String(value)}
            />
          </FormField>
        )}
      />
      <Controller
        control={control}
        name="estimatedPrice"
        render={({ field: { onBlur, onChange, value } }) => (
          <FormField error={errors.estimatedPrice?.message} label="Precio estimado opcional">
            <TextInput
              keyboardType="decimal-pad"
              onBlur={onBlur}
              onChangeText={(text) => onChange(parseOptionalPrice(text))}
              placeholder="Ejemplo: 25000"
              value={value === null ? '' : String(value)}
            />
          </FormField>
        )}
      />
      <Controller
        control={control}
        name="estimatedDurationText"
        render={({ field: { onBlur, onChange, value } }) => (
          <FormField error={errors.estimatedDurationText?.message} label="Duración estimada">
            <TextInput
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Ejemplo: 2 horas o media jornada"
              value={value ?? ''}
            />
          </FormField>
        )}
      />
      <Button disabled={submitting} onPress={handleSubmit(onSubmit)}>
        {submitting ? 'Enviando...' : 'Enviar postulación'}
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
});
