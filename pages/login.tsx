import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleLogin = () => {
    const isElectron = Boolean((window as any)?.electronAPI?.openExternal);
    const redirectUri = `${window.location.origin}/api/auth/callback`;
    const loginUrl = isElectron
      ? `${window.location.origin}/api/auth/login?state=electron`
      : `${window.location.origin}/api/auth/login?redirect_uri=${encodeURIComponent(redirectUri)}`;

    if (isElectron) {
      (window as any).electronAPI.openExternal(loginUrl);
      return;
    }

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
          Login
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
