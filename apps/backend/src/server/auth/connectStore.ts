type ConnectEntry = {
  createdAt: number;
  expires_in: number;
  status?: "pending" | "complete";
  tokens?: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    [key: string]: unknown;
  };
};

declare global {
  var __SC_CONNECT_CODES: Map<string, ConnectEntry> | undefined;
}

export type { ConnectEntry };

export const getConnectStore = () => {
  if (!globalThis.__SC_CONNECT_CODES) {
    globalThis.__SC_CONNECT_CODES = new Map<string, ConnectEntry>();
  }

  return globalThis.__SC_CONNECT_CODES;
};
