import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppTheme } from "./app-theme";

type LoginGateProps = {
  loading: boolean;
  label: string;
  onLogin: () => void;
};

export function LoginGate({ loading, label, onLogin }: LoginGateProps) {
  return (
    <View style={styles.wrap}>
      <Pressable style={styles.loginButton} onPress={onLogin}>
        <View style={styles.loginButtonInner}>
          {loading ? <ActivityIndicator color={AppTheme.text} /> : null}
          <Text style={styles.loginButtonText}>Login</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    padding: 20,
  },
  loginButton: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignSelf: "center",
    minWidth: 180,
  },
  loginButtonInner: {
    minHeight: 48,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loginButtonText: {
    color: AppTheme.text,
    fontSize: 14,
    fontWeight: "800",
  },
});
