import type { PropsWithChildren, ReactNode } from 'react';
import { useState } from 'react';

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { colors } from '@/components/ui/theme';

interface ScreenHeaderProps {
  backAction?: ReactNode;
  subtitle?: string;
  title: string;
  trailingAction?: ReactNode;
}

interface StatusHeaderProps {
  actionLabel?: string;
  description: string;
  status: string;
  tone?: 'accent' | 'neutral' | 'success' | 'warning';
}

interface SummaryCardProps {
  actionLabel?: string;
  icon?: string;
  onAction?: () => void;
  secondaryText?: string;
  title: string;
  value: string;
}

interface InfoRowProps {
  label: string;
  value: string;
}

interface SectionCardProps extends PropsWithChildren {
  action?: ReactNode;
  title: string;
}

interface CollapsibleSectionProps extends PropsWithChildren {
  initiallyExpanded?: boolean;
  preview?: string;
  title: string;
}

interface PrimaryActionBarProps {
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
}

interface ProcessTimelineProps {
  currentStep: string;
  steps: Array<{ key: string; label: string }>;
}

export function ScreenHeader({ backAction, subtitle, title, trailingAction }: ScreenHeaderProps) {
  return (
    <View style={styles.screenHeader}>
      {backAction ? <View>{backAction}</View> : null}
      <View style={styles.screenHeaderCopy}>
        <Text style={styles.screenTitle}>{title}</Text>
        {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
      </View>
      {trailingAction ? <View>{trailingAction}</View> : null}
    </View>
  );
}

export function StatusHeader({
  actionLabel,
  description,
  status,
  tone = 'neutral',
}: StatusHeaderProps) {
  return (
    <View style={styles.statusHeader}>
      <StatusBadge tone={tone} value={status} />
      <Text style={styles.statusDescription}>{description}</Text>
      {actionLabel ? <Text style={styles.nextAction}>Siguiente: {actionLabel}</Text> : null}
    </View>
  );
}

export function SummaryCard({
  actionLabel,
  icon,
  onAction,
  secondaryText,
  title,
  value,
}: SummaryCardProps) {
  return (
    <Card>
      <View style={styles.summaryHeader}>
        {icon ? <Text style={styles.summaryIcon}>{icon}</Text> : null}
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>{title}</Text>
          <Text numberOfLines={2} style={styles.summaryValue}>
            {value}
          </Text>
          {secondaryText ? (
            <Text numberOfLines={2} style={styles.summarySecondary}>
              {secondaryText}
            </Text>
          ) : null}
        </View>
      </View>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.inlineAction}>
          <Text style={styles.inlineActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

export function InfoRow({ label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function SectionCard({ action, children, title }: SectionCardProps) {
  return (
    <Card>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </Card>
  );
}

export function CollapsibleSection({
  children,
  initiallyExpanded = false,
  preview,
  title,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded);

  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        onPress={() => setExpanded((current) => !current)}
        style={styles.collapsibleHeader}
      >
        <View style={styles.summaryCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {!expanded && preview ? (
            <Text numberOfLines={2} style={styles.summarySecondary}>
              {preview}
            </Text>
          ) : null}
        </View>
        <Text style={styles.inlineActionText}>{expanded ? 'Ocultar' : 'Ver detalles'}</Text>
      </Pressable>
      {expanded ? <View style={styles.sectionBody}>{children}</View> : null}
    </Card>
  );
}

export function PrimaryActionBar({ primaryAction, secondaryAction }: PrimaryActionBarProps) {
  return (
    <View style={styles.actionBar}>
      {primaryAction}
      {secondaryAction}
    </View>
  );
}

export function ProcessTimeline({ currentStep, steps }: ProcessTimelineProps) {
  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === currentStep),
  );

  return (
    <View style={styles.timeline}>
      {steps.map((step, index) => {
        const complete = index < activeIndex;
        const active = index === activeIndex;

        return (
          <View key={step.key} style={styles.timelineItem}>
            <View
              style={[
                styles.timelineDot,
                complete ? styles.timelineDotDone : null,
                active ? styles.timelineDotActive : null,
              ]}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.timelineLabel,
                active || complete ? styles.timelineLabelActive : null,
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screenHeader: {
    gap: 12,
  },
  screenHeaderCopy: {
    gap: 6,
  },
  screenTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  screenSubtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  statusHeader: {
    gap: 10,
  },
  statusDescription: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
  },
  nextAction: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  summaryHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryIcon: {
    fontSize: 24,
  },
  summaryCopy: {
    flex: 1,
    gap: 4,
  },
  summaryTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 23,
  },
  summarySecondary: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  inlineAction: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  inlineActionText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: 14,
  },
  infoValue: {
    color: colors.text,
    flex: 1.2,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
  },
  sectionBody: {
    gap: 10,
  },
  collapsibleHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  actionBar: {
    gap: 10,
  },
  timeline: {
    flexDirection: 'row',
    gap: 8,
  },
  timelineItem: {
    flex: 1,
    gap: 5,
  },
  timelineDot: {
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  timelineDotDone: {
    backgroundColor: colors.success,
  },
  timelineDotActive: {
    backgroundColor: colors.accent,
  },
  timelineLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  timelineLabelActive: {
    color: colors.text,
  },
});
