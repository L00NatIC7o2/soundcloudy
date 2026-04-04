import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppTheme } from "./app-theme";

export function ScreenScroll({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  alt = false,
}: {
  children: React.ReactNode;
  alt?: boolean;
}) {
  return <View style={[styles.card, alt && styles.cardAlt]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function HelperText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.helperText}>{children}</Text>;
}

export function PrimaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.primaryButton} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function AppInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={AppTheme.textSoft}
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  pageContent: {
    padding: 18,
    gap: 14,
  },
  card: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: AppTheme.panel,
    borderWidth: 1,
    borderColor: AppTheme.line,
    gap: 12,
  },
  cardAlt: {
    backgroundColor: AppTheme.panelAlt,
  },
  sectionTitle: {
    color: AppTheme.text,
    fontSize: 18,
    fontWeight: "700",
  },
  helperText: {
    color: AppTheme.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.accent,
  },
  primaryButtonText: {
    color: AppTheme.text,
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1c1b20",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  secondaryButtonText: {
    color: AppTheme.text,
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    backgroundColor: AppTheme.input,
    color: AppTheme.text,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
});
