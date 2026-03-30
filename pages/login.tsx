import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { getClientApiBase } from "../src/lib/runtimeConfig";

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const handleLogin = async () => {
    if (connecting) return;

    const isElectron = Boolean((window as any)?.electronAPI?.openExternal);
    const apiBase = getClientApiBase(window.location.origin);

    if (isElectron) {
      setError(null);
      setConnecting(true);
      try {
        const bridgeResponse = await fetch(`/api/auth/bridge`, {
          method: "POST",
        });
        if (!bridgeResponse.ok) {
          throw new Error("Failed to start Electron login");
        }

        const bridgeData = await bridgeResponse.json();
        const connectCode = bridgeData.connect_code;
        if (!connectCode) {
          throw new Error("Missing connect code");
        }

        const loginUrl = `${apiBase}/api/auth/start?connect_code=${encodeURIComponent(connectCode)}`;
        await (window as any).electronAPI.openExternal(loginUrl);

        let completed = false;
        for (let attempt = 0; attempt < 90; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const completionResponse = await fetch(
            `/api/auth/complete?connect_code=${encodeURIComponent(connectCode)}`,
          );

          if (completionResponse.status === 202) {
            continue;
          }

          if (!completionResponse.ok) {
            const body = await completionResponse.json().catch(() => null);
            throw new Error(body?.error || "Electron login failed");
          }

          const completionBody = await completionResponse.json();
          const consumeResponse = await fetch(`/api/auth/consume`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(completionBody.tokens || {}),
          });

          if (!consumeResponse.ok) {
            const body = await consumeResponse.json().catch(() => null);
            throw new Error(body?.error || "Failed to import SoundCloud session");
          }

          window.location.href = "/";
          completed = true;
          break;
        }

        if (!completed) {
          throw new Error("Timed out waiting for SoundCloud login");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to log in");
        setConnecting(false);
      }
      return;
    }

    const loginUrl = `${apiBase}/api/auth/login`;
    window.location.href = loginUrl;
  };

  useEffect(() => {
    const errorParam = router.query.error;
    if (errorParam) {
      setError(typeof errorParam === "string" ? errorParam : "Unknown error");
    }
  }, [router.query]);

  return (
    <div
      className="login-page"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
      }}
    >
      {error && <div className="login-error">Error: {error}</div>}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <button className="login-button-glass" onClick={handleLogin}>
          {connecting ? "Connecting..." : "Login"}
        </button>
        <div
          style={{
            marginTop: 16,
            color: "#d14b7a",
            fontWeight: 600,
            fontSize: "1.1rem",
            cursor: "pointer",
            textDecoration: "underline",
          }}
          onClick={() => router.push("/girlfriend")}
        >
          hi
        </div>
      </div>
    </div>
  );
}
