import type { PropsWithChildren, ReactNode } from 'react';

import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/components/ui/theme';

interface ScreenProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  scroll?: boolean;
}

export function Screen({ children, footer, scroll = true, subtitle, title }: ScreenProps) {
  const content = (
    <View style={styles.container}>
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
      <View style={styles.content}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: undefined })}
        style={styles.flex}
      >
        {scroll ? (
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 20,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
  },
  content: {
    gap: 16,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 8,
  },
});
