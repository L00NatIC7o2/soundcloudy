import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = () => {
    setLoading(true);
    setError(null);

    try {
      const clientId = "uhlkXHnXoaAxIjoziy18peYV5eSwuMLz";
      const redirectUri = encodeURIComponent(
        `${window.location.origin}/api/auth/callback`,
      );

      const authUrl = `https://soundcloud.com/oauth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=non-expiring`;

      window.location.href = authUrl;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    const { error } = router.query;
    if (error) {
      setError(`Login error: ${error}`);
      setLoading(false);
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
