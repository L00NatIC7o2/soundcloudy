import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = () => {
    const clientId = "uhlkXHnXoaAxIjoziy18peYV5eSwuMLz";
    const redirectUri = `${window.location.origin}/oauth-callback`;

    const authUrl = new URL("https://soundcloud.com/oauth");
    authUrl.searchParams.append("client_id", clientId);
    authUrl.searchParams.append("redirect_uri", redirectUri);
    authUrl.searchParams.append("response_type", "token");
    authUrl.searchParams.append("scope", "non-expiring");

    window.location.href = authUrl.toString();
  };

  useEffect(() => {
    const { error } = router.query;
    if (error) {
      setError(`Login error: ${error}`);
    }
  }, [router.query]);

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>🎵 Soundcloudy</h1>
        <p>Your personal SoundCloud player</p>

        {error && <div className="login-error">{error}</div>}

        <button
          className="login-button"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login with SoundCloud"}
        </button>

        <p className="login-note">
          You'll be redirected to SoundCloud to authorize access
        </p>
      </div>
    </div>
  );
}
