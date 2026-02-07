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
    <div className="login-page">
      {error && <div className="login-error">Error: {error}</div>}

      <button className="login-button-glass" onClick={handleLogin}>
        <img
          src="/logo.png"
          alt="Soundcloudy"
          className="login-logo"
          loading="eager"
          decoding="async"
        />
      </button>
    </div>
  );
}
