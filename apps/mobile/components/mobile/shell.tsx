import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import { AppTheme } from "./app-theme";

type MobileShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function MobileShell({ title, subtitle, children }: MobileShellProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.content}>{children}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppTheme.bg,
  },
  container: {
    flex: 1,
    backgroundColor: AppTheme.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.line,
  },
  title: {
    color: AppTheme.text,
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: AppTheme.textSoft,
    fontSize: 12,
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
});
