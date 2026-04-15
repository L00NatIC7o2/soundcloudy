import React, { createContext, useContext, useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";

import { DEFAULT_API_URL } from "@/constants/config";

WebBrowser.maybeCompleteAuthSession();

type AuthState = {
  authenticated: boolean;
  loading: boolean;
  label: string;
  refresh: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("Checking session...");

  const refresh = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${DEFAULT_API_URL}/api/auth/check`);
      if (!response.ok) {
        setAuthenticated(false);
        setLabel("Sign in with SoundCloud to unlock the app.");
        return false;
      }

      let username = "Connected";
      try {
        const sessionResponse = await fetch(`${DEFAULT_API_URL}/api/auth/session`);
        if (sessionResponse.ok) {
          const session = await sessionResponse.json();
          username =
            session?.user?.username ||
            session?.username ||
            session?.user?.permalink ||
            "Connected";
        }
      } catch {
        // Keep generic connected label if session enrichment fails.
      }

      setAuthenticated(true);
      setLabel(username);
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
        if (!completeBody?.tokens) {
          throw new Error("Missing completed auth tokens.");
        }

        const consumeResponse = await fetch(`${DEFAULT_API_URL}/api/auth/consume`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(completeBody.tokens),
        });

        if (!consumeResponse.ok) {
          throw new Error(`Consume failed (${consumeResponse.status})`);
        }

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
      });
    } catch {
      // Even if logout request fails, reset local auth gate state.
    } finally {
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
