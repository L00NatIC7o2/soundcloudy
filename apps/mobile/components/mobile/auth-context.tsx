import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";

import { DEFAULT_API_URL } from "@/constants/config";

WebBrowser.maybeCompleteAuthSession();

const TOKENS_STORAGE_KEY = "soundcloudy_mobile_tokens";

type StoredTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
};

type AuthState = {
  authenticated: boolean;
  loading: boolean;
  label: string;
  refresh: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  authHeaders: Record<string, string>;
};

const AuthContext = createContext<AuthState | null>(null);

function buildAuthHeaders(tokens: StoredTokens | null) {
  if (!tokens?.accessToken) return {};

  return {
    Authorization: `Bearer ${tokens.accessToken}`,
    ...(tokens.refreshToken
      ? { "x-soundcloud-refresh-token": tokens.refreshToken }
      : {}),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("Checking session...");
  const [tokens, setTokens] = useState<StoredTokens | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      let storedTokens = tokens;
      if (!storedTokens) {
        const raw = await AsyncStorage.getItem(TOKENS_STORAGE_KEY);
        if (raw) {
          storedTokens = JSON.parse(raw);
          setTokens(storedTokens);
        }
      }

      const response = await fetch(`${DEFAULT_API_URL}/api/auth/check`, {
        headers: buildAuthHeaders(storedTokens),
      });

      if (!response.ok) {
        setAuthenticated(false);
        setLabel("Sign in with SoundCloud to unlock the app.");
        return false;
      }

      setAuthenticated(true);
      setLabel("Connected");
      return true;
    } catch {
      setAuthenticated(false);
      setLabel("Unable to reach the backend right now.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    setLoading(true);
    setLabel("Starting SoundCloud login...");

    try {
      const bridgeResponse = await fetch(`${DEFAULT_API_URL}/api/auth/bridge`, {
        method: "POST",
      });

      if (!bridgeResponse.ok) {
        throw new Error(`Bridge failed (${bridgeResponse.status})`);
      }

      const bridgeBody = await bridgeResponse.json();
      const connectCode = bridgeBody?.connect_code;

      if (!connectCode) {
        throw new Error("Missing connect code from backend.");
      }

      const startUrl = `${DEFAULT_API_URL}/api/auth/start?connect_code=${encodeURIComponent(connectCode)}`;
      setLabel("Waiting for SoundCloud login...");
      await WebBrowser.openBrowserAsync(startUrl);

      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const completeResponse = await fetch(
          `${DEFAULT_API_URL}/api/auth/complete?connect_code=${encodeURIComponent(connectCode)}`,
        );

        if (completeResponse.status === 202) {
          continue;
        }

        if (!completeResponse.ok) {
          throw new Error(`Complete failed (${completeResponse.status})`);
        }

        const completeBody = await completeResponse.json();
        if (!completeBody?.tokens?.access_token) {
          throw new Error("Missing completed auth tokens.");
        }

        const nextTokens: StoredTokens = {
          accessToken: completeBody.tokens.access_token,
          refreshToken:
            typeof completeBody.tokens.refresh_token === "string"
              ? completeBody.tokens.refresh_token
              : undefined,
          expiresIn:
            typeof completeBody.tokens.expires_in === "number"
              ? completeBody.tokens.expires_in
              : Number(completeBody.tokens.expires_in) || 3600,
        };

        setTokens(nextTokens);
        await AsyncStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(nextTokens));

        const success = await refresh();
        if (success) {
          return;
        }
      }

      throw new Error("SoundCloud login timed out.");
    } catch (error) {
      setAuthenticated(false);
      setLabel(
        error instanceof Error ? error.message : "Unable to complete SoundCloud login.",
      );
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await fetch(`${DEFAULT_API_URL}/api/auth/logout`, {
        method: "POST",
        headers: buildAuthHeaders(tokens),
      });
    } catch {
      // Even if logout request fails, reset local auth gate state.
    } finally {
      setTokens(null);
      await AsyncStorage.removeItem(TOKENS_STORAGE_KEY);
      setAuthenticated(false);
      setLabel("Sign in with SoundCloud to unlock the app.");
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        authenticated,
        loading,
        label,
        refresh,
        login,
        logout,
        authHeaders: buildAuthHeaders(tokens),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
